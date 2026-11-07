import { notFound } from "next/navigation";
import { Footer, TopBar } from "@/components/ui";
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
      <main className="mx-auto w-full max-w-xl px-4 pb-16 sm:px-6">
        <section className="animate-fade-up pt-4 text-center sm:pt-8">
          <p className="eyebrow">Amigo Secreto</p>
          <h1 className="font-display mt-2 text-4xl leading-tight text-ink sm:text-5xl">{event.name}</h1>
          {event.message && <p className="mx-auto mt-3 max-w-md text-muted">{event.message}</p>}
          {(event.budget || event.exchange_date) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {event.budget && <span className="chip border border-line bg-white !px-3 !py-1.5 !text-sm text-ink">💰 Presupuesto: {event.budget}</span>}
              {event.exchange_date && <Countdown date={event.exchange_date} />}
            </div>
          )}
        </section>
        <SecretSantaGame slug={event.slug} initialTeams={teams} event={event} />
      </main>
      <Footer />
    </>
  );
}
