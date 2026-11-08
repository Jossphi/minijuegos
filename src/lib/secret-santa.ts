import type { PoolClient } from "pg";
import { query, tx } from "./db";
import { hashPin, openForGiver, PIN_LOGIN_REGEX, PIN_REGEX, sealForGiver, verifyPin } from "./crypto";
import { DrawConfigError, generateAssignments, validateRules, type DrawMode } from "./draw";

export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const TEAM_COLORS = ["red", "green", "gold", "blue", "purple", "pink"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

// ───────────────────────── Tipos ─────────────────────────

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  budget: string | null;
  exchange_date: string | null;
  message: string | null;
  is_active: boolean;
  draw_open: boolean;
};

export type PublicTeam = {
  id: string;
  name: string;
  color: TeamColor;
  participants: { id: string; name: string; drawn: boolean; answered: boolean; declined: boolean }[];
};

export type Attendance = "yes" | "no" | null;

export type AdminTeam = {
  id: string;
  name: string;
  color: TeamColor;
  draw_mode: DrawMode;
  drawn_at: string | null;
  participants: { id: string; name: string; drawn: boolean; locked: boolean; attendance: Attendance }[];
  exclusions: { a_id: string; b_id: string }[];
  forced: { giver_id: string; receiver_id: string }[];
};

export type DrawResult = {
  me: { name: string; wishlist: string | null };
  receiver: { name: string; wishlist: string | null };
};

// ───────────────────────── Utilidades ─────────────────────────

function cleanName(name: unknown, max = 60) {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!n) throw new UserError("El nombre no puede estar vacío");
  if (n.length > max) throw new UserError(`El nombre es demasiado largo (máx. ${max})`);
  return n;
}

function cleanText(text: unknown, max = 1000) {
  const t = String(text ?? "").trim();
  if (t.length > max) throw new UserError(`El texto es demasiado largo (máx. ${max} caracteres)`);
  return t || null;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function dateOnly(d: unknown): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

// ───────────────────────── Lectura pública ─────────────────────────

export async function listActiveEvents() {
  const rows = await query<EventRow & { people: number }>(
    `select e.*, (select count(*)::int from participants p join teams t on t.id = p.team_id where t.event_id = e.id) as people
       from events e where e.is_active order by e.created_at desc`,
  );
  return rows.map((r) => ({ ...r, exchange_date: dateOnly(r.exchange_date) }));
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const [e] = await query<EventRow>(`select * from events where slug = $1`, [slug]);
  return e ? { ...e, exchange_date: dateOnly(e.exchange_date) } : null;
}

export async function getPublicEvent(slug: string) {
  const event = await getEventBySlug(slug);
  if (!event || !event.is_active) return null;
  const teams = await query<{ id: string; name: string; color: TeamColor }>(
    `select id, name, color from teams where event_id = $1 order by created_at, name`,
    [event.id],
  );
  const people = await query<{ id: string; team_id: string; name: string; drawn: boolean; answered: boolean; declined: boolean }>(
    `select p.id, p.team_id, p.name, p.claimed_at is not null as drawn, p.attendance is not null as answered,
            coalesce(p.attendance = 'no', false) as declined
       from participants p join teams t on t.id = p.team_id
      where t.event_id = $1 order by p.name`,
    [event.id],
  );
  const out: PublicTeam[] = teams.map((t) => ({
    ...t,
    participants: people.filter((p) => p.team_id === t.id).map(({ id, name, drawn, answered, declined }) => ({ id, name, drawn, answered, declined })),
  }));
  return { event, teams: out };
}

// ───────────────────────── Acciones del participante ─────────────────────────

type ParticipantFull = {
  id: string;
  team_id: string;
  name: string;
  pin_salt: string | null;
  pin_hash: string | null;
  claimed_at: string | null;
  attendance: Attendance;
  wishlist: string | null;
  failed_attempts: number;
  locked_until: string | null;
};

async function loadParticipant(participantId: string, eventSlug: string) {
  const [p] = await query<ParticipantFull & { event_active: boolean; draw_open: boolean }>(
    `select p.*, e.is_active as event_active, e.draw_open
       from participants p join teams t on t.id = p.team_id join events e on e.id = t.event_id
      where p.id::text = $1 and e.slug = $2`,
    [participantId, eventSlug],
  );
  if (!p || !p.event_active) throw new UserError("Participante no encontrado", 404);
  return p;
}

async function resultFor(p: ParticipantFull): Promise<DrawResult> {
  const [a] = await query<{ ciphertext: string }>(`select ciphertext from assignments where giver_id = $1`, [p.id]);
  if (!a) throw new UserError("El sorteo de tu equipo fue reiniciado. Vuelve a sortear.", 409);
  const { r } = JSON.parse(openForGiver(p.id, a.ciphertext)) as { r: string };
  const [receiver] = await query<{ name: string; wishlist: string | null }>(
    `select name, wishlist from participants where id = $1`,
    [r],
  );
  if (!receiver) throw new UserError("Tu amigo secreto ya no está en el equipo. Avisa al organizador.", 410);
  const [me] = await query<{ name: string; wishlist: string | null }>(`select name, wishlist from participants where id = $1`, [p.id]);
  return { me, receiver };
}

/**
 * El participante pulsa "Sortear": crea su PIN y descubre a su amigo secreto.
 * Si es el primero de su equipo, aquí se genera (y cifra) el sorteo completo del equipo.
 */
export async function drawForParticipant(eventSlug: string, participantId: string, pin: string, wishlist?: string) {
  if (!PIN_REGEX.test(pin)) throw new UserError("El PIN debe tener exactamente 6 números");
  const p = await loadParticipant(participantId, eventSlug);
  if (p.claimed_at) throw new UserError("Ya sorteaste. Escribe tu PIN para volver a ver a tu amigo secreto.", 409);
  if (p.attendance === null) throw new UserError("Primero confirma tu asistencia.", 409);
  if (!p.draw_open) throw new UserError("El sorteo aún no está abierto. El organizador avisará cuando puedas sortear.", 423);
  if (p.attendance === "no")
    throw new UserError("Indicaste que no podrás asistir, así que no participas en el sorteo. Si cambias de idea, avisa al organizador.", 403);

  const { salt, hash } = await hashPin(pin);
  await tx(async (c) => {
    const team = await lockTeam(c, p.team_id);
    if (!team.drawn_at) await drawInTx(c, team);
    const r = await c.query(
      `update participants set pin_salt = $2, pin_hash = $3, claimed_at = now(), revealed_at = now(),
              wishlist = coalesce($4, wishlist), failed_attempts = 0, locked_until = null
        where id = $1 and claimed_at is null returning id`,
      [p.id, salt, hash, cleanText(wishlist)],
    );
    if (!r.rowCount) throw new UserError("Ya sorteaste. Escribe tu PIN para volver a ver a tu amigo secreto.", 409);
  });
  return resultFor(p);
}

/** Confirmación de asistencia: se responde UNA sola vez. */
export async function answerAttendance(eventSlug: string, participantId: string, answer: string) {
  if (answer !== "yes" && answer !== "no") throw new UserError("Respuesta no válida");
  const p = await loadParticipant(participantId, eventSlug);
  const r = await query(
    `update participants set attendance = $2, attendance_at = now() where id = $1 and attendance is null returning id`,
    [p.id, answer],
  );
  if (!r.length) throw new UserError("Ya respondiste esta pregunta. Si necesitas cambiarla, avisa al organizador.", 409);
  return { attendance: answer };
}

async function checkPin(p: ParticipantFull, pin: string) {
  if (!p.claimed_at || !p.pin_salt || !p.pin_hash) throw new UserError("Todavía no has sorteado.", 409);
  if (p.locked_until && new Date(p.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(p.locked_until).getTime() - Date.now()) / 60000);
    throw new UserError(`Demasiados intentos. Vuelve a intentarlo en ${mins} min.`, 429);
  }
  if (!PIN_LOGIN_REGEX.test(pin) || !(await verifyPin(pin, p.pin_salt, p.pin_hash))) {
    const [{ failed_attempts }] = await query<{ failed_attempts: number }>(
      `update participants set failed_attempts = failed_attempts + 1,
              locked_until = case when failed_attempts + 1 >= $2 then now() + ($3 || ' minutes')::interval else locked_until end
        where id = $1 returning failed_attempts`,
      [p.id, MAX_ATTEMPTS, String(LOCK_MINUTES)],
    );
    const left = MAX_ATTEMPTS - failed_attempts;
    throw new UserError(
      left > 0 ? `PIN incorrecto. Te quedan ${left} intento(s).` : `PIN incorrecto. Bloqueado por ${LOCK_MINUTES} minutos.`,
      401,
    );
  }
  if (p.failed_attempts > 0) await query(`update participants set failed_attempts = 0, locked_until = null where id = $1`, [p.id]);
}

/** Volver a ver el resultado con el PIN. */
export async function reveal(eventSlug: string, participantId: string, pin: string) {
  const p = await loadParticipant(participantId, eventSlug);
  await checkPin(p, pin);
  return resultFor(p);
}

export async function updateWishlist(eventSlug: string, participantId: string, pin: string, wishlist: string) {
  const p = await loadParticipant(participantId, eventSlug);
  await checkPin(p, pin);
  await query(`update participants set wishlist = $2 where id = $1`, [p.id, cleanText(wishlist)]);
}

// ───────────────────────── Sorteo ─────────────────────────

type TeamLock = { id: string; draw_mode: DrawMode; drawn_at: string | null };

async function lockTeam(c: PoolClient, teamId: string): Promise<TeamLock> {
  const r = await c.query<TeamLock>(`select id, draw_mode, drawn_at from teams where id::text = $1 for update`, [teamId]);
  if (!r.rowCount) throw new UserError("Equipo no encontrado", 404);
  return r.rows[0];
}

async function drawInTx(c: PoolClient, team: TeamLock) {
  const people = await c.query<{ id: string }>(`select id from participants where team_id = $1`, [team.id]);
  if (people.rowCount! < 3) throw new UserError("Tu equipo aún no está listo para sortear. Avisa al organizador.");
  const ex = await c.query<{ a_id: string; b_id: string }>(`select a_id, b_id from exclusions where team_id = $1`, [team.id]);
  const fp = await c.query<{ giver_id: string; receiver_id: string }>(`select giver_id, receiver_id from forced_pairs where team_id = $1`, [team.id]);

  let map: Map<string, string>;
  try {
    map = generateAssignments(
      people.rows.map((p) => p.id),
      ex.rows.map((e) => [e.a_id, e.b_id]),
      team.draw_mode,
      fp.rows.map((f) => [f.giver_id, f.receiver_id]),
    );
  } catch (e) {
    throw new UserError((e as Error).message);
  }

  await c.query(`delete from assignments where team_id = $1`, [team.id]);
  const givers: string[] = [];
  const ciphers: string[] = [];
  for (const [giver, receiver] of map) {
    givers.push(giver);
    ciphers.push(sealForGiver(giver, JSON.stringify({ r: receiver })));
  }
  map.clear(); // el resultado en claro no sale de esta función
  await c.query(
    `insert into assignments (giver_id, team_id, ciphertext)
     select g, $1, ct from unnest($2::uuid[], $3::text[]) as x(g, ct)`,
    [team.id, givers, ciphers],
  );
  await c.query(`update teams set drawn_at = now() where id = $1`, [team.id]);
}

async function clearClaimsInTx(c: PoolClient, teamId: string) {
  await c.query(
    `update participants set pin_salt = null, pin_hash = null, claimed_at = null, revealed_at = null,
            failed_attempts = 0, locked_until = null where team_id = $1`,
    [teamId],
  );
}

// ───────────────────────── Administración ─────────────────────────

export async function adminListEvents() {
  const rows = await query<EventRow & { teams: number; people: number; drawn: number }>(
    `select e.*,
            (select count(*)::int from teams t where t.event_id = e.id) as teams,
            (select count(*)::int from participants p join teams t on t.id = p.team_id where t.event_id = e.id) as people,
            (select count(*)::int from participants p join teams t on t.id = p.team_id where t.event_id = e.id and p.claimed_at is not null) as drawn
       from events e order by e.created_at desc`,
  );
  return rows.map((r) => ({ ...r, exchange_date: dateOnly(r.exchange_date) }));
}

export async function adminGetEvent(slug: string) {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  const teams = await query<Omit<AdminTeam, "participants" | "exclusions" | "forced">>(
    `select id, name, color, draw_mode, drawn_at from teams where event_id = $1 order by created_at, name`,
    [event.id],
  );
  const people = await query<{ id: string; team_id: string; name: string; drawn: boolean; locked: boolean; attendance: Attendance }>(
    `select p.id, p.team_id, p.name, p.claimed_at is not null as drawn,
            coalesce(p.locked_until > now(), false) as locked, p.attendance
       from participants p join teams t on t.id = p.team_id where t.event_id = $1 order by p.name`,
    [event.id],
  );
  const ex = await query<{ team_id: string; a_id: string; b_id: string }>(
    `select x.team_id, x.a_id, x.b_id from exclusions x join teams t on t.id = x.team_id where t.event_id = $1`,
    [event.id],
  );
  const fp = await query<{ team_id: string; giver_id: string; receiver_id: string }>(
    `select f.team_id, f.giver_id, f.receiver_id from forced_pairs f join teams t on t.id = f.team_id where t.event_id = $1`,
    [event.id],
  );
  const out: AdminTeam[] = teams.map((t) => ({
    ...t,
    participants: people
      .filter((p) => p.team_id === t.id)
      .map((p) => ({ id: p.id, name: p.name, drawn: p.drawn, locked: p.locked, attendance: p.attendance })),
    exclusions: ex.filter((e) => e.team_id === t.id).map(({ a_id, b_id }) => ({ a_id, b_id })),
    forced: fp.filter((f) => f.team_id === t.id).map(({ giver_id, receiver_id }) => ({ giver_id, receiver_id })),
  }));
  return { event, teams: out };
}

export async function adminCreateEvent(input: { name: string; slug?: string; budget?: string; exchange_date?: string; message?: string }) {
  const name = cleanName(input.name, 80);
  const slug = slugify(input.slug || name);
  if (!slug) throw new UserError("El enlace (slug) no es válido");
  try {
    const [e] = await query<EventRow>(
      `insert into events (slug, name, budget, exchange_date, message) values ($1,$2,$3,$4,$5) returning *`,
      [slug, name, cleanText(input.budget, 60), input.exchange_date || null, cleanText(input.message, 500)],
    );
    return e;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new UserError("Ya existe un evento con ese enlace");
    throw err;
  }
}

export async function adminUpdateEvent(
  id: string,
  input: Partial<{ name: string; budget: string; exchange_date: string; message: string; is_active: boolean; draw_open: boolean }>,
) {
  const [e] = await query<EventRow>(
    `update events set
        name = coalesce($2, name),
        budget = case when $3::boolean then $4 else budget end,
        exchange_date = case when $5::boolean then $6::date else exchange_date end,
        message = case when $7::boolean then $8 else message end,
        is_active = coalesce($9, is_active),
        draw_open = coalesce($10, draw_open)
      where id = $1 returning *`,
    [
      id,
      input.name !== undefined ? cleanName(input.name, 80) : null,
      input.budget !== undefined,
      input.budget !== undefined ? cleanText(input.budget, 60) : null,
      input.exchange_date !== undefined,
      input.exchange_date || null,
      input.message !== undefined,
      input.message !== undefined ? cleanText(input.message, 500) : null,
      input.is_active ?? null,
      typeof input.draw_open === "boolean" ? input.draw_open : null,
    ],
  );
  if (!e) throw new UserError("Evento no encontrado", 404);
  return e;
}

export async function adminDeleteEvent(id: string) {
  await query(`delete from events where id = $1`, [id]);
}

function checkColor(color: unknown): TeamColor {
  return (TEAM_COLORS as readonly string[]).includes(String(color)) ? (color as TeamColor) : "red";
}

export async function adminCreateTeam(eventId: string, input: { name: string; color?: string; draw_mode?: DrawMode }) {
  try {
    const [t] = await query(
      `insert into teams (event_id, name, color, draw_mode) values ($1,$2,$3,$4) returning id`,
      [eventId, cleanName(input.name), checkColor(input.color), input.draw_mode === "free" ? "free" : "cycle"],
    );
    return t;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new UserError("Ya hay un equipo con ese nombre");
    throw err;
  }
}

async function assertNotDrawn(teamId: string) {
  const [t] = await query<{ drawn_at: string | null }>(`select drawn_at from teams where id = $1`, [teamId]);
  if (!t) throw new UserError("Equipo no encontrado", 404);
  if (t.drawn_at)
    throw new UserError("Este equipo ya empezó a sortear. Para cambiar la lista, primero reinicia el sorteo del equipo.");
}

/** Comprueba que las reglas del equipo (con un posible cambio) sigan siendo posibles. */
async function checkTeamRules(
  teamId: string,
  change: { mode?: DrawMode; addExclusion?: [string, string]; addForced?: [string, string] } = {},
) {
  const [t] = await query<{ draw_mode: DrawMode }>(`select draw_mode from teams where id = $1`, [teamId]);
  const ids = (await query<{ id: string }>(`select id from participants where team_id = $1`, [teamId])).map((r) => r.id);
  const ex = (await query<{ a_id: string; b_id: string }>(`select a_id, b_id from exclusions where team_id = $1`, [teamId])).map(
    (e) => [e.a_id, e.b_id] as [string, string],
  );
  const fp = (await query<{ giver_id: string; receiver_id: string }>(`select giver_id, receiver_id from forced_pairs where team_id = $1`, [teamId])).map(
    (f) => [f.giver_id, f.receiver_id] as [string, string],
  );
  if (change.addExclusion) ex.push(change.addExclusion);
  if (change.addForced) fp.push(change.addForced);
  const mode = change.mode ?? t.draw_mode;
  try {
    validateRules(ids, ex, fp, mode);
    if (ids.length >= 3) generateAssignments(ids, ex, mode, fp); // ¿existe al menos un sorteo posible?
  } catch (e) {
    if (e instanceof DrawConfigError) throw new UserError(e.message);
    throw e;
  }
}

export async function adminUpdateTeam(teamId: string, input: Partial<{ name: string; color: string; draw_mode: DrawMode }>) {
  if (input.draw_mode !== undefined) {
    await assertNotDrawn(teamId);
    await checkTeamRules(teamId, { mode: input.draw_mode === "free" ? "free" : "cycle" });
  }
  await query(
    `update teams set name = coalesce($2, name), color = coalesce($3, color), draw_mode = coalesce($4, draw_mode) where id = $1`,
    [
      teamId,
      input.name !== undefined ? cleanName(input.name) : null,
      input.color !== undefined ? checkColor(input.color) : null,
      input.draw_mode === undefined ? null : input.draw_mode === "free" ? "free" : "cycle",
    ],
  );
}

export async function adminDeleteTeam(teamId: string) {
  await query(`delete from teams where id = $1`, [teamId]);
}

export async function adminAddParticipants(teamId: string, names: string[]) {
  await assertNotDrawn(teamId);
  const clean = [...new Set(names.map((n) => n.replace(/\s+/g, " ").trim()).filter(Boolean))].map((n) => cleanName(n));
  if (!clean.length) throw new UserError("Escribe al menos un nombre");
  const rows = await query(
    `insert into participants (team_id, name) select $1, n from unnest($2::text[]) as n
     on conflict (team_id, name) do nothing returning id`,
    [teamId, clean],
  );
  return { added: rows.length, skipped: clean.length - rows.length };
}

export async function adminRemoveParticipant(participantId: string) {
  const [p] = await query<{ team_id: string }>(`select team_id from participants where id = $1`, [participantId]);
  if (!p) return;
  await assertNotDrawn(p.team_id);
  await query(`delete from participants where id = $1`, [participantId]);
}

/** Para quien olvidó su PIN: puede volver a "sortear" y le saldrá el MISMO amigo secreto. */
export async function adminResetParticipant(participantId: string) {
  await query(
    `update participants set pin_salt = null, pin_hash = null, claimed_at = null, revealed_at = null,
            failed_attempts = 0, locked_until = null where id = $1`,
    [participantId],
  );
}

/** Borra la respuesta de asistencia para que se le vuelva a preguntar. */
export async function adminResetAttendance(participantId: string) {
  await query(`update participants set attendance = null, attendance_at = null where id = $1`, [participantId]);
}

export async function adminUnlockParticipant(participantId: string) {
  await query(`update participants set failed_attempts = 0, locked_until = null where id = $1`, [participantId]);
}

export async function adminAddExclusion(teamId: string, a: string, b: string) {
  if (a === b) throw new UserError("Elige dos personas distintas");
  await assertNotDrawn(teamId);
  const [x, y] = a < b ? [a, b] : [b, a];
  const ok = await query(`select 1 from participants where team_id = $1 and id = any($2::uuid[])`, [teamId, [x, y]]);
  if (ok.length !== 2) throw new UserError("Ambas personas deben ser del mismo equipo");
  await checkTeamRules(teamId, { addExclusion: [x, y] });
  await query(`insert into exclusions (team_id, a_id, b_id) values ($1,$2,$3) on conflict do nothing`, [teamId, x, y]);
}

/** Pareja obligatoria: `giver` SIEMPRE le regalará a `receiver`. */
export async function adminAddForced(teamId: string, giver: string, receiver: string) {
  if (giver === receiver) throw new UserError("Elige dos personas distintas");
  await assertNotDrawn(teamId);
  const ok = await query(`select 1 from participants where team_id = $1 and id = any($2::uuid[])`, [teamId, [giver, receiver]]);
  if (ok.length !== 2) throw new UserError("Ambas personas deben ser del mismo equipo");
  await checkTeamRules(teamId, { addForced: [giver, receiver] });
  await query(`insert into forced_pairs (team_id, giver_id, receiver_id) values ($1,$2,$3)`, [teamId, giver, receiver]);
}

export async function adminRemoveForced(teamId: string, giver: string) {
  await assertNotDrawn(teamId);
  await query(`delete from forced_pairs where team_id = $1 and giver_id = $2`, [teamId, giver]);
}

export async function adminRemoveExclusion(teamId: string, a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  await query(`delete from exclusions where team_id = $1 and a_id = $2 and b_id = $3`, [teamId, x, y]);
}

/** Limpia TODOS los sorteos del evento (todos los equipos). La lista de participantes y las exclusiones se mantienen. */
export async function adminResetEventDraws(eventId: string) {
  await tx(async (c) => {
    const teams = await c.query<{ id: string }>(`select id from teams where event_id = $1 for update`, [eventId]);
    for (const t of teams.rows) {
      await c.query(`delete from assignments where team_id = $1`, [t.id]);
      await clearClaimsInTx(c, t.id);
    }
    await c.query(`update teams set drawn_at = null where event_id = $1`, [eventId]);
  });
}

/** Borra el sorteo del equipo: todos tendrán que volver a sortear (y les puede salir otra persona). */
export async function adminResetTeamDraw(teamId: string) {
  await tx(async (c) => {
    await lockTeam(c, teamId);
    await c.query(`delete from assignments where team_id = $1`, [teamId]);
    await clearClaimsInTx(c, teamId);
    await c.query(`update teams set drawn_at = null where id = $1`, [teamId]);
  });
}
