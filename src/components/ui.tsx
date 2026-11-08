import Link from "next/link";

export const TEAM_STYLES = {
  red:    { label: "Rojo",    dot: "bg-red-600",     soft: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     ring: "hover:border-red-300" },
  green:  { label: "Verde",   dot: "bg-emerald-600", soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", ring: "hover:border-emerald-300" },
  gold:   { label: "Dorado",  dot: "bg-amber-500",   soft: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   ring: "hover:border-amber-300" },
  blue:   { label: "Azul",    dot: "bg-sky-600",     soft: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     ring: "hover:border-sky-300" },
  purple: { label: "Morado",  dot: "bg-violet-600",  soft: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  ring: "hover:border-violet-300" },
  pink:   { label: "Rosado",  dot: "bg-pink-600",    soft: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",    ring: "hover:border-pink-300" },
} as const;

export type TeamColorKey = keyof typeof TEAM_STYLES;
export const teamStyle = (c: string) => TEAM_STYLES[(c in TEAM_STYLES ? c : "red") as TeamColorKey];

export function GiftIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 9c-1.5-3.5-6-4.5-7-2s3 3 7 2c4 1 8 .5 7-2s-5.5-1.5-7 2z" fill="none" stroke="#b7791f" strokeWidth="2" strokeLinejoin="round" />
      <rect x="4" y="9" width="24" height="7" rx="2" fill="#e0384f" />
      <rect x="6" y="16" width="20" height="12" rx="2" fill="#c8102e" />
      <rect x="14" y="9" width="4" height="19" fill="#f2b33d" />
    </svg>
  );
}

export function TopBar({ back, backLabel = "Volver" }: { back?: string; backLabel?: string }) {
  return (
    <>
      <div className="ribbon" aria-hidden />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink">
          <GiftIcon />
          <span className="text-lg">Zona Navideña</span>
        </Link>
        {back && (
          <Link href={back} className="btn-ghost !px-3 !py-2 text-sm">
            ← {backLabel}
          </Link>
        )}
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line px-4 py-8 text-center text-sm text-muted">
      Zona Navideña · Hecho con cariño para celebrar juntos
    </footer>
  );
}

/** Indicador de pasos 1 · 2 · 3 */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                active ? "bg-santa text-white" : done ? "bg-pine text-white" : "bg-stone-200 text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`whitespace-nowrap ${active ? "text-ink" : "hidden text-muted sm:inline"}`}>{s}</span>
            {i < steps.length - 1 && <span className="mx-0.5 h-px w-4 bg-line sm:mx-1 sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}
