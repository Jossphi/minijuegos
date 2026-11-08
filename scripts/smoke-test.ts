// Prueba de extremo a extremo de la lógica (sin UI). Uso: DATABASE_URL=... DRAW_SECRET=... npx tsx scripts/smoke-test.ts
import * as S from "../src/lib/secret-santa";
import { query, pool } from "../src/lib/db";

const assert = (c: unknown, m: string) => { if (!c) throw new Error("FALLO: " + m); };
const SLUG = "test-navidad";
const pinOf = (i: number) => String(100000 + i);

async function expectError(fn: () => Promise<unknown>, status: number, m: string) {
  try { await fn(); } catch (e) { assert((e as S.UserError).status === status, `${m} (status ${(e as S.UserError).status})`); return; }
  assert(false, m + " (no falló)");
}

async function main() {
  process.env.DRAW_SECRET ||= "test-draw-secret-0123456789";
  await query(`delete from events where slug = $1`, [SLUG]);
  const ev = await S.adminCreateEvent({ name: "Test Navidad", slug: SLUG, budget: "$20" });
  const t1 = await S.adminCreateTeam(ev.id, { name: "Renos", color: "red" });
  const t2 = await S.adminCreateTeam(ev.id, { name: "Duendes", color: "green", draw_mode: "free" });
  await S.adminAddParticipants(t1.id, Array.from({ length: 9 }, (_, i) => `Reno ${i + 1}`));
  await S.adminAddParticipants(t2.id, Array.from({ length: 9 }, (_, i) => `Duende ${i + 1}`));

  const pub = (await S.getPublicEvent(SLUG))!;
  const r = pub.teams.find((t) => t.name === "Renos")!;
  const d = pub.teams.find((t) => t.name === "Duendes")!;
  await S.adminAddExclusion(r.id, r.participants[0].id, r.participants[1].id);

  // Asistencia: sin responder no se puede sortear; solo se responde una vez
  await expectError(() => S.drawForParticipant(SLUG, r.participants[0].id, "123456"), 409, "sortear sin confirmar asistencia");
  await expectError(() => S.answerAttendance(SLUG, r.participants[0].id, "quizas"), 400, "respuesta inválida");
  for (const team of [r, d]) for (const p of team.participants) await S.answerAttendance(SLUG, p.id, "yes");
  await expectError(() => S.answerAttendance(SLUG, r.participants[0].id, "no"), 409, "responder dos veces");
  const att = (await S.adminGetEvent(SLUG))!.teams.flatMap((t) => t.participants);
  assert(att.every((p) => p.attendance === "yes"), "admin ve asistencia confirmada");
  console.log("✔ confirmación de asistencia OK");

  // Sorteo cerrado: se confirma asistencia pero no se puede sortear
  await S.adminUpdateEvent(ev.id, { draw_open: false });
  await expectError(() => S.drawForParticipant(SLUG, r.participants[0].id, "123456"), 423, "sorteo cerrado");
  await S.adminUpdateEvent(ev.id, { draw_open: true });
  console.log("✔ abrir/cerrar sorteo OK");

  // PIN inválido
  await expectError(() => S.drawForParticipant(SLUG, r.participants[0].id, "1234"), 400, "PIN de 4 rechazado al crear");

  for (const team of [r, d]) {
    const map = new Map<string, string>();
    for (const [i, p] of team.participants.entries()) {
      const res = await S.drawForParticipant(SLUG, p.id, pinOf(i), `deseo de ${p.name}`);
      map.set(p.name, res.receiver.name);
      // Al sortear de inmediato, si el amigo ya escribió su lista, se ve
    }
    const names = team.participants.map((p) => p.name);
    assert(names.every((n) => map.get(n) !== n), "nadie se regala a sí mismo");
    assert(new Set(map.values()).size === names.length, "cada uno recibe exactamente un regalo");
    assert(names.every((n) => names.includes(map.get(n)!)), "solo dentro del mismo equipo");
    if (team.name === "Renos") {
      const [a, b] = [team.participants[0].name, team.participants[1].name];
      assert(map.get(a) !== b && map.get(b) !== a, "respeta exclusión");
      let cur = names[0], steps = 0;
      do { cur = map.get(cur)!; steps++; } while (cur !== names[0]);
      assert(steps === names.length, "una sola cadena");
    }
    // Volver a ver con PIN da el mismo resultado y ve la lista de deseos
    for (const [i, p] of team.participants.entries()) {
      const again = await S.reveal(SLUG, p.id, pinOf(i));
      assert(again.receiver.name === map.get(p.name), "mismo resultado al volver a entrar");
      assert(again.receiver.wishlist === `deseo de ${again.receiver.name}`, "ve lista de deseos de su amigo");
    }
    console.log(`✔ ${team.name}: 9 personas sortearon al instante, sorteo válido`);
  }

  // La BD no contiene receptores en claro
  const all = await query<{ ciphertext: string }>(`select a.ciphertext from assignments a join teams t on t.id = a.team_id where t.event_id = $1`, [ev.id]);
  assert(all.length === 18, "18 asignaciones");
  const names = [...r.participants, ...d.participants].map((p) => p.name);
  assert(all.every((x) => !names.some((n) => x.ciphertext.includes(n))), "sin nombres en claro");

  // No se puede sortear dos veces
  const victim = r.participants[2];
  await expectError(() => S.drawForParticipant(SLUG, victim.id, "999999"), 409, "doble sorteo");

  // PIN incorrecto + bloqueo
  for (let i = 0; i < 4; i++) await expectError(() => S.reveal(SLUG, victim.id, "000000"), 401, "PIN incorrecto");
  await expectError(() => S.reveal(SLUG, victim.id, "000000"), 401, "quinto intento");
  await expectError(() => S.reveal(SLUG, victim.id, pinOf(2)), 429, "bloqueado");
  await S.adminUnlockParticipant(victim.id);
  const before = (await S.reveal(SLUG, victim.id, pinOf(2))).receiver.name;

  // Restablecer PIN: vuelve a sortear y le sale la MISMA persona
  await S.adminResetParticipant(victim.id);
  const after = (await S.drawForParticipant(SLUG, victim.id, "432100")).receiver.name;
  assert(before === after, "mismo amigo tras restablecer PIN");
  console.log("✔ bloqueo, desbloqueo y restablecer PIN (mismo amigo) OK");

  // Lista fija tras empezar; reiniciar el equipo permite editar y volver a sortear
  await expectError(() => S.adminAddParticipants(r.id, ["Nuevo"]), 400, "lista fija");
  await S.adminResetTeamDraw(r.id);
  await S.adminAddParticipants(r.id, ["Reno 10"]);
  const pub2 = (await S.getPublicEvent(SLUG))!;
  assert(pub2.teams.find((t) => t.id === r.id)!.participants.every((p) => !p.drawn), "equipo reiniciado");
  const p10 = pub2.teams.find((t) => t.id === r.id)!.participants.find((p) => p.name === "Reno 10")!;
  // quien dice que no asistirá no puede sortear
  await S.answerAttendance(SLUG, p10.id, "no");
  await expectError(() => S.drawForParticipant(SLUG, p10.id, "111111"), 403, "no asistirá → no sortea");
  await S.adminResetAttendance(p10.id);
  await S.answerAttendance(SLUG, p10.id, "yes");
  assert((await S.drawForParticipant(SLUG, p10.id, "111111")).receiver.name, "sorteo tras reinicio");
  console.log("✔ lista fija y reinicio de equipo OK");

  // Limpiar todos los sorteos del evento: se mantiene la lista
  const before2 = (await S.getPublicEvent(SLUG))!.teams.reduce((n, t) => n + t.participants.length, 0);
  await S.adminResetEventDraws(ev.id);
  const pub3 = (await S.getPublicEvent(SLUG))!;
  assert(pub3.teams.reduce((n, t) => n + t.participants.length, 0) === before2, "la lista se mantiene");
  assert(pub3.teams.every((t) => t.participants.every((p) => !p.drawn)), "nadie ha sorteado tras limpiar");
  const left = await query(`select 1 from assignments a join teams t on t.id = a.team_id where t.event_id = $1`, [ev.id]);
  assert(left.length === 0, "sin asignaciones tras limpiar");
  await S.adminAddParticipants(r.id, ["Reno 11"]); // la lista vuelve a ser editable
  console.log("✔ limpiar sorteos del evento (lista intacta) OK");

  await query(`delete from events where slug = $1`, [SLUG]);
  console.log("✅ Todas las pruebas pasaron");
  await pool().end();
}
main().catch(async (e) => { console.error(e); await pool().end(); process.exit(1); });
