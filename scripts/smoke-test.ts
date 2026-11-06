// Prueba de extremo a extremo de la lógica (sin UI). Uso: DATABASE_URL=... npx tsx scripts/smoke-test.ts
import * as S from "../src/lib/secret-santa";
import { query, pool } from "../src/lib/db";

const assert = (c: unknown, m: string) => { if (!c) throw new Error("FALLO: " + m); };

async function main() {
  await query(`delete from events where slug = 'test-navidad'`);
  const ev = await S.adminCreateEvent({ name: "Test Navidad", slug: "test-navidad", budget: "$20" });
  const t1 = await S.adminCreateTeam(ev.id, { name: "Renos", color: "red" });
  const t2 = await S.adminCreateTeam(ev.id, { name: "Duendes", color: "green", draw_mode: "free" });
  const n1 = Array.from({ length: 9 }, (_, i) => `Reno ${i + 1}`);
  const n2 = Array.from({ length: 9 }, (_, i) => `Duende ${i + 1}`);
  await S.adminAddParticipants(t1.id, n1);
  await S.adminAddParticipants(t2.id, n2);

  const pub = (await S.getPublicEvent("test-navidad"))!;
  const r = pub.teams.find((t) => t.name === "Renos")!;
  const d = pub.teams.find((t) => t.name === "Duendes")!;
  await S.adminAddExclusion(r.id, r.participants[0].id, r.participants[1].id);

  // Registro de todos; el último dispara el sorteo automático
  for (const team of [r, d]) {
    for (const [i, p] of team.participants.entries()) {
      const res = await S.claimParticipant("test-navidad", p.id, `clave-${p.name}`, `deseo de ${p.name}`);
      assert(res.teamDrawn === (i === team.participants.length - 1), "auto-sorteo al completar equipo");
    }
  }

  // La BD no contiene receptores en claro
  const rows = await query<{ ciphertext: string }>(`select ciphertext from assignments`);
  assert(rows.length === 18, "18 asignaciones");
  assert(rows.every((x) => !n1.concat(n2).some((n) => x.ciphertext.includes(n))), "sin nombres en claro");

  // Cada uno descubre el suyo
  for (const team of [r, d]) {
    const map = new Map<string, string>();
    for (const p of team.participants) {
      const res = await S.reveal("test-navidad", p.id, `clave-${p.name}`);
      assert(res.status === "revealed", "revelado");
      if (res.status !== "revealed") continue;
      map.set(p.name, res.receiver.name);
      assert(res.receiver.wishlist === `deseo de ${res.receiver.name}`, "ve lista de deseos de su amigo");
    }
    const names = team.participants.map((p) => p.name);
    assert(names.every((n) => map.get(n) !== n), "nadie se regala a sí mismo");
    assert(new Set(map.values()).size === names.length, "cada uno recibe exactamente un regalo");
    assert(names.every((n) => names.includes(map.get(n)!)), "solo dentro del mismo equipo");
    if (team.name === "Renos") {
      const [a, b] = [team.participants[0].name, team.participants[1].name];
      assert(map.get(a) !== b && map.get(b) !== a, "respeta exclusión");
      // ciclo único: seguir la cadena recorre a todos
      let cur = names[0], steps = 0;
      do { cur = map.get(cur)!; steps++; } while (cur !== names[0]);
      assert(steps === names.length, "una sola cadena");
    }
    console.log(`✔ ${team.name}:`, team.participants.length, "personas, sorteo válido");
  }

  // Clave incorrecta + bloqueo
  const victim = r.participants[2];
  for (let i = 0; i < 5; i++) {
    try { await S.reveal("test-navidad", victim.id, "malisima"); assert(false, "debió fallar"); }
    catch (e) { assert(e instanceof S.UserError, "error de usuario"); }
  }
  try { await S.reveal("test-navidad", victim.id, `clave-${victim.name}`); assert(false, "debió estar bloqueado"); }
  catch (e) { assert((e as S.UserError).status === 429, "bloqueado tras 5 intentos"); }
  await S.adminUnlockParticipant(victim.id);
  assert((await S.reveal("test-navidad", victim.id, `clave-${victim.name}`)).status === "revealed", "desbloqueo");

  // Reset de clave anula el sorteo, se re-registra y se vuelve a sortear solo
  const res = await S.adminResetParticipant(victim.id);
  assert(res.drawCancelled, "reset anula sorteo");
  assert((await S.reveal("test-navidad", r.participants[0].id, `clave-${r.participants[0].name}`)).status === "waiting", "equipo en espera");
  const again = await S.claimParticipant("test-navidad", victim.id, "nueva-clave");
  assert(again.teamDrawn, "re-sorteo automático");
  console.log("✔ bloqueo, desbloqueo, reset y re-sorteo OK");

  // Doble registro rechazado
  try { await S.claimParticipant("test-navidad", victim.id, "otra-clave"); assert(false, "doble registro"); } catch {}

  await query(`delete from events where slug = 'test-navidad'`);
  console.log("✅ Todas las pruebas pasaron");
  await pool().end();
}
main().catch(async (e) => { console.error(e); await pool().end(); process.exit(1); });
