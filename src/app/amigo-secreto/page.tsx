import Link from "next/link";
import { redirect } from "next/navigation";
import { Footer, TopBar } from "@/components/ui";
import { listActiveEvents } from "@/lib/secret-santa";

export const dynamic = "force-dynamic";

export default async function SecretSantaIndex() {
  const events = await listActiveEvents();
  if (events.length === 1) redirect(`/amigo-secreto/${events[0].slug}`);

  return (
    <>
      <TopBar back="/" backLabel="Juegos" />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="animate-fade-up text-center font-display text-5xl font-bold sm:text-6xl">
          <span className="text-shine">Amigo Secreto</span> 🎁
        </h1>
        {events.length === 0 ? (
          <div className="glass mt-10 p-10 text-center">
            <div className="text-6xl">🦌</div>
            <p className="mt-4 text-lg text-white/70">Aún no hay ningún sorteo abierto. ¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4">
            {events.map((e) => (
              <Link key={e.id} href={`/amigo-secreto/${e.slug}`} className="glass flex items-center gap-4 p-5 transition hover:bg-white/10">
                <div className="text-4xl">🎅</div>
                <div className="flex-1">
                  <div className="text-xl font-semibold">{e.name}</div>
                  <div className="text-sm text-white/60">{e.people} participantes</div>
                </div>
                <span className="text-2xl">→</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
