import Link from "next/link";
import { Footer, Lights, TopBar } from "@/components/ui";

const GAMES = [
  {
    href: "/amigo-secreto",
    title: "Amigo Secreto",
    emoji: "🎁",
    desc: "Sorteo 100% secreto por equipos. Ni el organizador sabe a quién le tocó quién.",
    grad: "from-rose-500 via-red-600 to-rose-800",
    ready: true,
  },
  { title: "Trivia Navideña", emoji: "🧠", desc: "¿Cuánto sabes de la Navidad? Compite por equipos.", grad: "from-emerald-500 to-teal-800" },
  { title: "Bingo de Navidad", emoji: "🎱", desc: "Cartones digitales y bolas que caen del cielo.", grad: "from-amber-400 to-orange-700" },
  { title: "Ruleta de Retos", emoji: "🎡", desc: "Gira la ruleta y cumple el reto navideño.", grad: "from-violet-500 to-fuchsia-800" },
];

export default function Home() {
  return (
    <>
      <TopBar />
      <Lights />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <section className="animate-fade-up py-10 text-center sm:py-16">
          <div className="mb-4 text-6xl sm:text-7xl">
            <span className="animate-float inline-block">⛄</span>
          </div>
          <h1 className="font-display text-5xl font-bold leading-tight sm:text-7xl">
            <span className="text-shine">¡Que empiecen los juegos!</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            Minijuegos para celebrar la Navidad con tu gente. Elige uno y que gane el espíritu navideño.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {GAMES.map((g, i) => {
            const card = (
              <div
                className={`group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br ${g.grad} p-6 shadow-2xl transition sm:p-8 ${
                  g.ready ? "hover:-translate-y-1 hover:shadow-rose-500/30" : "opacity-60 grayscale-[30%]"
                }`}
              >
                <div aria-hidden className="absolute -right-6 -top-6 text-[9rem] opacity-20 transition group-hover:rotate-12 group-hover:scale-110">
                  {g.emoji}
                </div>
                <div className="relative">
                  <div className="text-5xl">{g.emoji}</div>
                  <h2 className="mt-3 font-display text-4xl font-bold">{g.title}</h2>
                  <p className="mt-2 max-w-sm text-white/85">{g.desc}</p>
                  <div className="mt-6">
                    {g.ready ? (
                      <span className="btn bg-white text-night-950 group-hover:bg-gold">¡Jugar ahora! →</span>
                    ) : (
                      <span className="chip bg-black/30 text-white/80">🔒 Próximamente</span>
                    )}
                  </div>
                </div>
              </div>
            );
            return (
              <div key={g.title} className="animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                {g.href ? <Link href={g.href}>{card}</Link> : card}
              </div>
            );
          })}
        </section>
      </main>
      <Footer />
    </>
  );
}
