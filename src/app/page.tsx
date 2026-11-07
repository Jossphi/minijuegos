import Link from "next/link";
import { Footer, TopBar } from "@/components/ui";

const GAMES = [
  { href: "/amigo-secreto", title: "Amigo Secreto", emoji: "🎁", desc: "Sorteo privado por equipos. Nadie, ni el organizador, sabe a quién le tocó quién." },
  { title: "Trivia Navideña", emoji: "🧠", desc: "¿Cuánto sabes de la Navidad? Compite por equipos." },
  { title: "Bingo de Navidad", emoji: "🎱", desc: "Cartones digitales para jugar todos juntos." },
  { title: "Ruleta de Retos", emoji: "🎡", desc: "Gira la ruleta y cumple el reto navideño." },
] as { href?: string; title: string; emoji: string; desc: string }[];

export default function Home() {
  const [main, ...soon] = GAMES;
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <section className="animate-fade-up py-10 text-center sm:py-16">
          <p className="eyebrow">Minijuegos de Navidad</p>
          <h1 className="font-display mx-auto mt-3 max-w-2xl text-4xl leading-[1.1] text-ink sm:text-6xl">
            Que empiecen <span className="text-santa">los juegos</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted sm:text-lg">
            Juegos sencillos para celebrar la Navidad con tu equipo, desde cualquier celular.
          </p>
        </section>

        <Link
          href={main.href!}
          className="card group animate-fade-up flex flex-col gap-6 overflow-hidden p-6 transition hover:-translate-y-0.5 hover:border-stone-300 sm:flex-row sm:items-center sm:p-8"
        >
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-santa-soft text-5xl">{main.emoji}</div>
          <div className="flex-1">
            <span className="chip bg-pine-soft text-pine">● Disponible</span>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{main.title}</h2>
            <p className="mt-1 text-muted">{main.desc}</p>
          </div>
          <span className="btn-primary self-start sm:self-center">Jugar →</span>
        </Link>

        <h3 className="mt-12 mb-4 text-sm font-semibold text-muted">Próximamente</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {soon.map((g) => (
            <div key={g.title} className="rounded-2xl border border-dashed border-line bg-white/50 p-5">
              <div className="text-3xl opacity-70">{g.emoji}</div>
              <div className="mt-3 font-semibold text-ink">{g.title}</div>
              <p className="mt-1 text-sm text-muted">{g.desc}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
