import { notFound } from "next/navigation";
import { Footer, Lights, TopBar } from "@/components/ui";
import SecretSantaGame from "@/components/secret-santa/SecretSantaGame";
import Countdown from "@/components/secret-santa/Countdown";
import { getPublicEvent } from "@/lib/secret-santa";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicEvent(slug);
  if (!data) notFound();
  const { event, teams } = data;

  return (
    <>
      <TopBar back="/" backLabel="Juegos" />
      <Lights />
      <main className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6">
        <section className="animate-fade-up pt-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Amigo Secreto</p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-tight sm:text-6xl">
            <span className="text-shine">{event.name}</span>
          </h1>
          {event.message && <p className="mx-auto mt-3 max-w-xl text-white/70">{event.message}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {event.budget && (
              <span className="chip bg-gold/15 !px-4 !py-2 !text-sm text-gold">💰 Presupuesto: {event.budget}</span>
            )}
            {event.exchange_date && <Countdown date={event.exchange_date} />}
          </div>
        </section>
        <SecretSantaGame slug={event.slug} initialTeams={teams} event={event} />
      </main>
      <Footer />
    </>
  );
}
