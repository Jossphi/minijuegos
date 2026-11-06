import type { PoolClient } from "pg";
import { query, tx } from "./db";
import { createKeyMaterial, MIN_SECRET_LENGTH, normalizeSecret, open, sealFor, unlock } from "./crypto";
import { generateAssignments, type DrawMode } from "./draw";

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
};

export type PublicTeam = {
  id: string;
  name: string;
  color: TeamColor;
  drawn: boolean;
  participants: { id: string; name: string; claimed: boolean }[];
};

export type AdminTeam = {
  id: string;
  name: string;
  color: TeamColor;
  draw_mode: DrawMode;
  auto_draw: boolean;
  drawn_at: string | null;
  participants: { id: string; name: string; claimed: boolean; revealed: boolean; locked: boolean }[];
  exclusions: { a_id: string; b_id: string }[];
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
  const teams = await query<{ id: string; name: string; color: TeamColor; drawn_at: string | null }>(
    `select id, name, color, drawn_at from teams where event_id = $1 order by created_at, name`,
    [event.id],
  );
  const people = await query<{ id: string; team_id: string; name: string; claimed: boolean }>(
    `select p.id, p.team_id, p.name, p.claimed_at is not null as claimed
       from participants p join teams t on t.id = p.team_id
      where t.event_id = $1 order by p.name`,
    [event.id],
  );
  const out: PublicTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    drawn: !!t.drawn_at,
    participants: people.filter((p) => p.team_id === t.id).map(({ id, name, claimed }) => ({ id, name, claimed })),
  }));
  return { event, teams: out };
}

// ───────────────────────── Acciones del participante ─────────────────────────

type ParticipantFull = {
  id: string;
  team_id: string;
  name: string;
  kdf_salt: string | null;
  public_key: string | null;
  claimed_at: string | null;
  wishlist: string | null;
  failed_attempts: number;
  locked_until: string | null;
};

async function loadParticipant(participantId: string, eventSlug: string) {
  const [p] = await query<ParticipantFull & { event_active: boolean }>(
    `select p.*, e.is_active as event_active
       from participants p join teams t on t.id = p.team_id join events e on e.id = t.event_id
      where p.id = $1 and e.slug = $2`,
    [participantId, eventSlug],
  );
  if (!p || !p.event_active) throw new UserError("Participante no encontrado", 404);
  return p;
}

/** Primera visita: la persona elige su clave secreta (y opcionalmente su lista de deseos). */
export async function claimParticipant(eventSlug: string, participantId: string, secret: string, wishlist?: string) {
  if (normalizeSecret(secret).length < MIN_SECRET_LENGTH)
    throw new UserError(`La clave secreta debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  const p = await loadParticipant(participantId, eventSlug);
  if (p.claimed_at) throw new UserError("Esta persona ya se registró. Usa tu clave para entrar.", 409);

  const { kdfSalt, publicKey } = await createKeyMaterial(secret);
  const updated = await query(
    `update participants set kdf_salt = $2, public_key = $3, claimed_at = now(), wishlist = $4
      where id = $1 and claimed_at is null returning id`,
    [participantId, kdfSalt, publicKey, cleanText(wishlist)],
  );
  if (!updated.length) throw new UserError("Esta persona ya se registró. Usa tu clave para entrar.", 409);

  // Sorteo automático cuando se completa el equipo
  const drew = await tx(async (c) => {
    const team = await lockTeam(c, p.team_id);
    if (!team.auto_draw || team.drawn_at) return false;
    const pending = await c.query(`select 1 from participants where team_id = $1 and claimed_at is null limit 1`, [p.team_id]);
    const count = await c.query(`select count(*)::int as n from participants where team_id = $1`, [p.team_id]);
    if (pending.rowCount || count.rows[0].n < 3) return false;
    await drawInTx(c, team);
    return true;
  });
  return { teamDrawn: drew };
}

async function verifySecret(p: ParticipantFull, secret: string) {
  if (!p.claimed_at || !p.kdf_salt || !p.public_key)
    throw new UserError("Todavía no te has registrado. Elige tu clave primero.", 409);
  if (p.locked_until && new Date(p.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(p.locked_until).getTime() - Date.now()) / 60000);
    throw new UserError(`Demasiados intentos. Vuelve a intentarlo en ${mins} min.`, 429);
  }
  const key = await unlock(secret, p.kdf_salt, p.public_key);
  if (!key) {
    const [{ failed_attempts }] = await query<{ failed_attempts: number }>(
      `update participants set failed_attempts = failed_attempts + 1,
              locked_until = case when failed_attempts + 1 >= $2 then now() + ($3 || ' minutes')::interval else locked_until end
        where id = $1 returning failed_attempts`,
      [p.id, MAX_ATTEMPTS, String(LOCK_MINUTES)],
    );
    const left = MAX_ATTEMPTS - failed_attempts;
    throw new UserError(
      left > 0 ? `Clave incorrecta. Te quedan ${left} intento(s).` : `Clave incorrecta. Bloqueado por ${LOCK_MINUTES} minutos.`,
      401,
    );
  }
  if (p.failed_attempts > 0) await query(`update participants set failed_attempts = 0, locked_until = null where id = $1`, [p.id]);
  return key;
}

/** Entrar con la clave: devuelve el amigo secreto si el sorteo ya se hizo. */
export async function reveal(eventSlug: string, participantId: string, secret: string) {
  const p = await loadParticipant(participantId, eventSlug);
  const key = await verifySecret(p, secret);

  const [a] = await query<{ ciphertext: string }>(`select ciphertext from assignments where giver_id = $1`, [p.id]);
  if (!a) {
    const [s] = await query<{ claimed: number; total: number }>(
      `select count(*) filter (where claimed_at is not null)::int as claimed, count(*)::int as total
         from participants where team_id = $1`,
      [p.team_id],
    );
    return { status: "waiting" as const, me: { name: p.name, wishlist: p.wishlist }, progress: s };
  }

  const { r } = JSON.parse(open(key, a.ciphertext)) as { r: string };
  const [receiver] = await query<{ name: string; wishlist: string | null }>(
    `select name, wishlist from participants where id = $1`,
    [r],
  );
  if (!receiver) throw new UserError("Tu amigo secreto ya no está en el equipo. Avisa al organizador.", 410);
  await query(`update participants set revealed_at = coalesce(revealed_at, now()) where id = $1`, [p.id]);
  return {
    status: "revealed" as const,
    me: { name: p.name, wishlist: p.wishlist },
    receiver,
  };
}

export async function updateWishlist(eventSlug: string, participantId: string, secret: string, wishlist: string) {
  const p = await loadParticipant(participantId, eventSlug);
  await verifySecret(p, secret);
  await query(`update participants set wishlist = $2 where id = $1`, [p.id, cleanText(wishlist)]);
}

// ───────────────────────── Sorteo ─────────────────────────

type TeamLock = { id: string; draw_mode: DrawMode; auto_draw: boolean; drawn_at: string | null };

async function lockTeam(c: PoolClient, teamId: string): Promise<TeamLock> {
  const r = await c.query<TeamLock>(`select id, draw_mode, auto_draw, drawn_at from teams where id = $1 for update`, [teamId]);
  if (!r.rowCount) throw new UserError("Equipo no encontrado", 404);
  return r.rows[0];
}

async function drawInTx(c: PoolClient, team: TeamLock) {
  const people = await c.query<{ id: string; public_key: string | null }>(
    `select id, public_key from participants where team_id = $1`,
    [team.id],
  );
  const missing = people.rows.filter((p) => !p.public_key).length;
  if (missing) throw new UserError(`Faltan ${missing} persona(s) por registrarse en este equipo`);
  const ex = await c.query<{ a_id: string; b_id: string }>(`select a_id, b_id from exclusions where team_id = $1`, [team.id]);

  const map = generateAssignments(
    people.rows.map((p) => p.id),
    ex.rows.map((e) => [e.a_id, e.b_id]),
    team.draw_mode,
  );
  const keyOf = new Map(people.rows.map((p) => [p.id, p.public_key!]));

  await c.query(`delete from assignments where team_id = $1`, [team.id]);
  const givers: string[] = [];
  const ciphers: string[] = [];
  for (const [giver, receiver] of map) {
    givers.push(giver);
    ciphers.push(sealFor(keyOf.get(giver)!, JSON.stringify({ r: receiver })));
  }
  map.clear(); // el resultado en claro no sale de esta función
  await c.query(
    `insert into assignments (giver_id, team_id, ciphertext)
     select g, $1, ct from unnest($2::uuid[], $3::text[]) as x(g, ct)`,
    [team.id, givers, ciphers],
  );
  await c.query(`update participants set revealed_at = null where team_id = $1`, [team.id]);
  await c.query(`update teams set drawn_at = now() where id = $1`, [team.id]);
}

// ───────────────────────── Administración ─────────────────────────

export async function adminListEvents() {
  const rows = await query<EventRow & { teams: number; people: number; claimed: number }>(
    `select e.*,
            (select count(*)::int from teams t where t.event_id = e.id) as teams,
            (select count(*)::int from participants p join teams t on t.id = p.team_id where t.event_id = e.id) as people,
            (select count(*)::int from participants p join teams t on t.id = p.team_id where t.event_id = e.id and p.claimed_at is not null) as claimed
       from events e order by e.created_at desc`,
  );
  return rows.map((r) => ({ ...r, exchange_date: dateOnly(r.exchange_date) }));
}

export async function adminGetEvent(slug: string) {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  const teams = await query<Omit<AdminTeam, "participants" | "exclusions">>(
    `select id, name, color, draw_mode, auto_draw, drawn_at from teams where event_id = $1 order by created_at, name`,
    [event.id],
  );
  const people = await query<{ id: string; team_id: string; name: string; claimed: boolean; revealed: boolean; locked: boolean }>(
    `select p.id, p.team_id, p.name, p.claimed_at is not null as claimed, p.revealed_at is not null as revealed,
            coalesce(p.locked_until > now(), false) as locked
       from participants p join teams t on t.id = p.team_id where t.event_id = $1 order by p.name`,
    [event.id],
  );
  const ex = await query<{ team_id: string; a_id: string; b_id: string }>(
    `select x.team_id, x.a_id, x.b_id from exclusions x join teams t on t.id = x.team_id where t.event_id = $1`,
    [event.id],
  );
  const out: AdminTeam[] = teams.map((t) => ({
    ...t,
    participants: people
      .filter((p) => p.team_id === t.id)
      .map((p) => ({ id: p.id, name: p.name, claimed: p.claimed, revealed: p.revealed, locked: p.locked })),
    exclusions: ex.filter((e) => e.team_id === t.id).map(({ a_id, b_id }) => ({ a_id, b_id })),
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
  input: Partial<{ name: string; budget: string; exchange_date: string; message: string; is_active: boolean }>,
) {
  const [e] = await query<EventRow>(
    `update events set
        name = coalesce($2, name),
        budget = case when $3::boolean then $4 else budget end,
        exchange_date = case when $5::boolean then $6::date else exchange_date end,
        message = case when $7::boolean then $8 else message end,
        is_active = coalesce($9, is_active)
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

export async function adminCreateTeam(eventId: string, input: { name: string; color?: string; draw_mode?: DrawMode; auto_draw?: boolean }) {
  try {
    const [t] = await query(
      `insert into teams (event_id, name, color, draw_mode, auto_draw) values ($1,$2,$3,$4,$5) returning id`,
      [eventId, cleanName(input.name), checkColor(input.color), input.draw_mode === "free" ? "free" : "cycle", input.auto_draw ?? true],
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
  if (t.drawn_at) throw new UserError("El sorteo de este equipo ya se hizo. Anúlalo primero para hacer cambios.");
}

export async function adminUpdateTeam(
  teamId: string,
  input: Partial<{ name: string; color: string; draw_mode: DrawMode; auto_draw: boolean }>,
) {
  if (input.draw_mode !== undefined) await assertNotDrawn(teamId);
  await query(
    `update teams set name = coalesce($2, name), color = coalesce($3, color),
            draw_mode = coalesce($4, draw_mode), auto_draw = coalesce($5, auto_draw) where id = $1`,
    [
      teamId,
      input.name !== undefined ? cleanName(input.name) : null,
      input.color !== undefined ? checkColor(input.color) : null,
      input.draw_mode === undefined ? null : input.draw_mode === "free" ? "free" : "cycle",
      input.auto_draw ?? null,
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

/** Para quien olvidó su clave. Si el equipo ya sorteó, el sorteo se anula (hay que repetirlo). */
export async function adminResetParticipant(participantId: string) {
  return tx(async (c) => {
    const r = await c.query<{ team_id: string }>(`select team_id from participants where id = $1`, [participantId]);
    if (!r.rowCount) throw new UserError("Participante no encontrado", 404);
    const team = await lockTeam(c, r.rows[0].team_id);
    if (team.drawn_at) await cancelInTx(c, team.id);
    await c.query(
      `update participants set kdf_salt = null, public_key = null, claimed_at = null,
              failed_attempts = 0, locked_until = null, revealed_at = null where id = $1`,
      [participantId],
    );
    return { drawCancelled: !!team.drawn_at };
  });
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
  await query(`insert into exclusions (team_id, a_id, b_id) values ($1,$2,$3) on conflict do nothing`, [teamId, x, y]);
}

export async function adminRemoveExclusion(teamId: string, a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  await query(`delete from exclusions where team_id = $1 and a_id = $2 and b_id = $3`, [teamId, x, y]);
}

export async function adminDrawTeam(teamId: string, force = false) {
  await tx(async (c) => {
    const team = await lockTeam(c, teamId);
    if (team.drawn_at && !force) throw new UserError("Este equipo ya tiene sorteo. Usa 'Repetir sorteo'.");
    await drawInTx(c, team);
  });
}

async function cancelInTx(c: PoolClient, teamId: string) {
  await c.query(`delete from assignments where team_id = $1`, [teamId]);
  await c.query(`update participants set revealed_at = null where team_id = $1`, [teamId]);
  await c.query(`update teams set drawn_at = null where id = $1`, [teamId]);
}

export async function adminCancelDraw(teamId: string) {
  await tx(async (c) => {
    await lockTeam(c, teamId);
    await cancelInTx(c, teamId);
  });
}
