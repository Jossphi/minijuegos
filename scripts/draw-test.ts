// Prueba del algoritmo de sorteo con reglas de parejas. Uso: npx tsx scripts/draw-test.ts
import { DrawConfigError, generateAssignments, type DrawMode } from "../src/lib/draw";

const assert = (c: unknown, m: string) => { if (!c) throw new Error("FALLO: " + m); };
const ids = Array.from({ length: 9 }, (_, i) => `p${i}`);

function check(map: Map<string, string>, ex: [string, string][], forced: [string, string][], mode: DrawMode) {
  assert(map.size === ids.length, "todos regalan");
  assert(new Set(map.values()).size === ids.length, "todos reciben exactamente uno");
  for (const [g, r] of map) assert(g !== r, "nadie se regala a sí mismo");
  for (const [a, b] of ex) assert(map.get(a) !== b && map.get(b) !== a, "respeta exclusión");
  for (const [g, r] of forced) assert(map.get(g) === r, "respeta pareja obligatoria");
  if (mode === "cycle") {
    let cur = ids[0], steps = 0;
    do { cur = map.get(cur)!; steps++; } while (cur !== ids[0] && steps <= ids.length);
    assert(steps === ids.length, "cadena única");
  }
}

function expectConfigError(fn: () => unknown, m: string) {
  try { fn(); } catch (e) { assert(e instanceof DrawConfigError, m + " (tipo de error)"); return; }
  assert(false, m + " (no falló)");
}

// 1) Reglas fijas, 2000 sorteos por modo
const forced: [string, string][] = [["p0", "p1"], ["p1", "p2"], ["p5", "p3"]];
const ex: [string, string][] = [["p0", "p4"], ["p6", "p7"]];
for (const mode of ["cycle", "free"] as DrawMode[]) {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const m = generateAssignments(ids, ex, mode, forced);
    check(m, ex, forced, mode);
    seen.add(JSON.stringify([...m]));
  }
  assert(seen.size > 50, "los sorteos varían");
  console.log(`✔ ${mode}: 2000 sorteos válidos con 3 parejas obligatorias y 2 exclusiones (${seen.size} resultados distintos)`);
}

// 2) Pareja mutua: válida en Libre, imposible en Cadena
const mutual: [string, string][] = [["p0", "p1"], ["p1", "p0"]];
check(generateAssignments(ids, [], "free", mutual), [], mutual, "free");
expectConfigError(() => generateAssignments(ids, [], "cycle", mutual), "mutua en cadena");
console.log("✔ pareja mutua: permitida en Libre, rechazada en Cadena");

// 3) Contradicciones
expectConfigError(() => generateAssignments(ids, [["p0", "p1"]], "free", [["p0", "p1"]]), "obligatoria + exclusión");
expectConfigError(() => generateAssignments(ids, [], "free", [["p0", "p1"], ["p0", "p2"]]), "dos obligatorias del mismo giver");
expectConfigError(() => generateAssignments(ids, [], "free", [["p0", "p1"], ["p2", "p1"]]), "dos obligatorias al mismo receiver");
expectConfigError(() => generateAssignments(ids, [], "free", [["p0", "p0"]]), "a sí mismo");
console.log("✔ reglas contradictorias rechazadas con mensaje claro");

// 4) Configuración aleatoria (fuzz): si genera, siempre es válido
let generated = 0;
for (let t = 0; t < 3000; t++) {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const f: [string, string][] = [];
  const nF = Math.floor(Math.random() * 4);
  for (let i = 0; i < nF; i++) f.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
  const e: [string, string][] = [];
  for (let i = 0; i < Math.floor(Math.random() * 4); i++) {
    const a = ids[Math.floor(Math.random() * 9)], b = ids[Math.floor(Math.random() * 9)];
    if (a !== b) e.push([a, b]);
  }
  const mode: DrawMode = Math.random() < 0.5 ? "cycle" : "free";
  try { check(generateAssignments(ids, e, mode, f, 2000), e, f, mode); generated++; }
  catch (err) { if (!(err instanceof DrawConfigError)) throw err; }
}
console.log(`✔ fuzz: ${generated}/3000 configuraciones aleatorias generadas, todas válidas`);
console.log("✅ Algoritmo OK");
