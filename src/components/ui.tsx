import Link from "next/link";

export const TEAM_STYLES = {
  red:    { grad: "from-rose-500 to-red-700",        ring: "ring-rose-400",    text: "text-rose-300",    emoji: "🎅", soft: "bg-rose-500/15" },
  green:  { grad: "from-emerald-400 to-green-700",   ring: "ring-emerald-400", text: "text-emerald-300", emoji: "🎄", soft: "bg-emerald-500/15" },
  gold:   { grad: "from-amber-300 to-orange-600",    ring: "ring-amber-300",   text: "text-amber-200",   emoji: "⭐", soft: "bg-amber-500/15" },
  blue:   { grad: "from-sky-400 to-indigo-700",      ring: "ring-sky-400",     text: "text-sky-300",     emoji: "❄️", soft: "bg-sky-500/15" },
  purple: { grad: "from-violet-400 to-fuchsia-700",  ring: "ring-violet-400",  text: "text-violet-300",  emoji: "🔮", soft: "bg-violet-500/15" },
  pink:   { grad: "from-pink-400 to-rose-600",       ring: "ring-pink-400",    text: "text-pink-300",    emoji: "🍬", soft: "bg-pink-500/15" },
} as const;

export type TeamColorKey = keyof typeof TEAM_STYLES;
export const teamStyle = (c: string) => TEAM_STYLES[(c in TEAM_STYLES ? c : "red") as TeamColorKey];

export function Lights() {
  const colors = ["text-santa", "text-gold", "text-pine", "text-ice", "text-candy"];
  return (
    <div aria-hidden className="pointer-events-none flex justify-center gap-5 overflow-hidden py-2">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className={`${colors[i % colors.length]} animate-twinkle inline-block h-3 w-3 rounded-full bg-current`}
          style={{ animationDelay: `${(i % 6) * 0.25}s` }}
        />
      ))}
    </div>
  );
}

export function TopBar({ back, backLabel = "Volver" }: { back?: string; backLabel?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl">
        <span className="animate-float inline-block">🎄</span>
        <span className="text-shine">Zona Navideña</span>
      </Link>
      {back && (
        <Link href={back} className="btn-ghost !px-4 !py-2 text-sm">
          ← {backLabel}
        </Link>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto px-4 py-8 text-center text-sm text-white/40">
      Hecho con 🎁 y mucho chocolate caliente ☕
    </footer>
  );
}
