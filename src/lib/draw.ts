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

export class DrawConfigError extends Error {}

/**
 * Comprueba que las reglas del equipo sean coherentes (sin generar el sorteo).
 * - forced: [quien regala, a quien le tiene que regalar]
 * - exclusions: pares que no pueden tocarse (en ninguna dirección)
 */
export function validateRules(ids: string[], exclusions: Array<[string, string]>, forced: Array<[string, string]>, mode: DrawMode) {
  const inTeam = new Set(ids);
  const givers = new Set<string>();
  const receivers = new Set<string>();
  const banned = new Set(exclusions.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  for (const [g, r] of forced) {
    if (!inTeam.has(g) || !inTeam.has(r)) throw new DrawConfigError("Las dos personas de una pareja obligatoria deben ser del mismo equipo");
    if (g === r) throw new DrawConfigError("Nadie puede regalarse a sí mismo");
    if (givers.has(g)) throw new DrawConfigError("Una persona solo puede tener una pareja obligatoria como quien regala");
    if (receivers.has(r)) throw new DrawConfigError("A una persona solo se le puede asignar un regalo obligatorio");
    if (banned.has(`${g}|${r}`)) throw new DrawConfigError("Esa pareja está marcada como “no pueden tocarse”");
    givers.add(g);
    receivers.add(r);
  }
  if (mode === "cycle" && forced.length) {
    // En modo cadena las parejas obligatorias no pueden cerrar un círculo más pequeño que el equipo.
    const next = new Map(forced);
    for (const start of next.keys()) {
      let cur = start;
      let steps = 0;
      while (next.has(cur)) {
        cur = next.get(cur)!;
        steps++;
        if (cur === start && steps < ids.length)
          throw new DrawConfigError(
            "En modo Cadena, las parejas obligatorias no pueden formar un círculo cerrado (por ejemplo, A→B y B→A). Usa el modo Libre o quita una regla.",
          );
        if (steps > ids.length) break;
      }
    }
  }
}

/**
 * Genera las asignaciones giver → receiver.
 * - Nadie se regala a sí mismo.
 * - Se respetan las exclusiones (en ambas direcciones) y las parejas obligatorias (dirigidas).
 * - 'cycle': una sola cadena que pasa por todos (sin regalos mutuos ni subgrupos).
 * - 'free' : cualquier permutación válida.
 */
export function generateAssignments(
  ids: string[],
  exclusions: Array<[string, string]>,
  mode: DrawMode,
  forced: Array<[string, string]> = [],
  maxTries = 50_000,
): Map<string, string> {
  if (ids.length < 3) throw new DrawConfigError("Se necesitan al menos 3 personas en el equipo para sortear");
  validateRules(ids, exclusions, forced, mode);
  const banned = new Set(exclusions.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const ok = (g: string, r: string) => g !== r && !banned.has(`${g}|${r}`);
  const next = new Map(forced);

  if (mode === "cycle") {
    // Las parejas obligatorias forman "cadenas" fijas; se barajan las cadenas y se unen en un solo círculo.
    const forcedReceivers = new Set(next.values());
    const chains: string[][] = [];
    for (const id of ids) {
      if (forcedReceivers.has(id)) continue; // no es inicio de cadena
      const chain = [id];
      let cur = id;
      while (next.has(cur)) {
        cur = next.get(cur)!;
        chain.push(cur);
      }
      chains.push(chain);
    }
    if (!chains.length) {
      // Las parejas obligatorias ya forman el círculo completo.
      return new Map(next);
    }
    for (let t = 0; t < maxTries; t++) {
      const order = shuffle(chains);
      let valid = true;
      for (let i = 0; i < order.length && valid; i++) {
        const tail = order[i][order[i].length - 1];
        const head = order[(i + 1) % order.length][0];
        valid = ok(tail, head);
      }
      if (!valid) continue;
      const flat = order.flat();
      return new Map(flat.map((g, i) => [g, flat[(i + 1) % flat.length]]));
    }
  } else {
    const freeGivers = ids.filter((g) => !next.has(g));
    const taken = new Set(next.values());
    const freeReceivers = ids.filter((r) => !taken.has(r));
    for (let t = 0; t < maxTries; t++) {
      const receivers = shuffle(freeReceivers);
      if (freeGivers.every((g, i) => ok(g, receivers[i]))) {
        return new Map([...next, ...freeGivers.map((g, i) => [g, receivers[i]] as [string, string])]);
      }
    }
  }
  throw new DrawConfigError("No hay un sorteo posible con estas reglas. Quita alguna regla e inténtalo de nuevo.");
}
