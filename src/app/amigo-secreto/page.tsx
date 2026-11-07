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
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <p className="eyebrow text-center">Amigo Secreto</p>
        <h1 className="font-display mt-2 text-center text-4xl text-ink">Elige tu sorteo</h1>
        {events.length === 0 ? (
          <div className="card mt-10 p-10 text-center text-muted">Aún no hay ningún sorteo abierto. ¡Vuelve pronto!</div>
        ) : (
          <div className="mt-8 grid gap-3">
            {events.map((e) => (
              <Link key={e.id} href={`/amigo-secreto/${e.slug}`} className="card flex items-center gap-4 p-5 transition hover:border-stone-300">
                <div className="flex-1">
                  <div className="font-semibold text-ink">{e.name}</div>
                  <div className="text-sm text-muted">{e.people} participantes</div>
                </div>
                <span className="text-muted">→</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
