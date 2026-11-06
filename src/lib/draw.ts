import { randomInt } from "node:crypto";

export type DrawMode = "cycle" | "free";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Genera las asignaciones giver → receiver.
 * - Nadie se regala a sí mismo.
 * - Se respetan las exclusiones (en ambas direcciones).
 * - 'cycle': una sola cadena que pasa por todos (sin regalos mutuos ni subgrupos).
 * - 'free' : cualquier permutación válida.
 * Usa rechazo aleatorio: con equipos de ~10 personas encuentra solución al instante.
 */
export function generateAssignments(
  ids: string[],
  exclusions: Array<[string, string]>,
  mode: DrawMode,
  maxTries = 50_000,
): Map<string, string> {
  if (ids.length < 3) throw new Error("Se necesitan al menos 3 personas en el equipo para sortear");
  const banned = new Set<string>();
  for (const [a, b] of exclusions) {
    banned.add(`${a}|${b}`);
    banned.add(`${b}|${a}`);
  }
  const ok = (g: string, r: string) => g !== r && !banned.has(`${g}|${r}`);

  for (let t = 0; t < maxTries; t++) {
    if (mode === "cycle") {
      const order = shuffle(ids);
      let valid = true;
      for (let i = 0; i < order.length && valid; i++) valid = ok(order[i], order[(i + 1) % order.length]);
      if (!valid) continue;
      return new Map(order.map((g, i) => [g, order[(i + 1) % order.length]]));
    } else {
      const receivers = shuffle(ids);
      if (ids.every((g, i) => ok(g, receivers[i]))) return new Map(ids.map((g, i) => [g, receivers[i]]));
    }
  }
  throw new Error("No hay un sorteo posible con estas exclusiones. Quita alguna e inténtalo de nuevo.");
}
