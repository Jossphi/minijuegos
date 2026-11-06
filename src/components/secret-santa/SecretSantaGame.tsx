"use client";
import confetti from "canvas-confetti";
import { useMemo, useState } from "react";
import { teamStyle } from "@/components/ui";
import SlotReveal from "./SlotReveal";

type Team = { id: string; name: string; color: string; participants: { id: string; name: string; drawn: boolean }[] };
type Person = { id: string; name: string; drawn: boolean; team: { id: string; name: string; color: string } };
type EventInfo = { name: string; budget: string | null; exchange_date: string | null };
type Result = { me: { name: string; wishlist: string | null }; receiver: { name: string; wishlist: string | null } };

type Step =
  | { k: "search" }
  | { k: "draw"; p: Person }
  | { k: "login"; p: Person }
  | { k: "gift"; p: Person; data: Result }
  | { k: "spin"; p: Person; data: Result }
  | { k: "result"; p: Person; data: Result };

async function api<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Algo salió mal");
  return json as T;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fireConfetti() {
  const colors = ["#ff3355", "#ffc93c", "#16c784", "#ffffff", "#8fe3ff"];
  const end = Date.now() + 1500;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 }, colors, scalar: 1.2 });
}

export default function SecretSantaGame({ slug, initialTeams, event }: { slug: string; initialTeams: Team[]; event: EventInfo }) {
  const people = useMemo<Person[]>(
    () =>
      initialTeams
        .flatMap((t) => t.participants.map((p) => ({ ...p, team: { id: t.id, name: t.name, color: t.color } })))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [initialTeams],
  );
  const [drawnIds, setDrawnIds] = useState(() => new Set(people.filter((p) => p.drawn).map((p) => p.id)));
  const [step, setStep] = useState<Step>({ k: "search" });
  const [pin, setPin] = useState("");

  const teammates = (p: Person) => people.filter((x) => x.team.id === p.team.id && x.id !== p.id).map((x) => x.name);
  const exit = () => {
    setPin("");
    setStep({ k: "search" });
  };

  return (
    <div className="mt-8">
      {step.k === "search" && (
        <Search
          people={people.map((p) => ({ ...p, drawn: drawnIds.has(p.id) }))}
          onPick={(p) => setStep(drawnIds.has(p.id) ? { k: "login", p } : { k: "draw", p })}
        />
      )}

      {step.k === "draw" && (
        <DrawForm
          slug={slug}
          p={step.p}
          onBack={exit}
          onDone={(data, newPin) => {
            setPin(newPin);
            setDrawnIds((s) => new Set(s).add(step.p.id));
            setStep({ k: "gift", p: step.p, data });
          }}
          onAlreadyDrawn={() => {
            setDrawnIds((s) => new Set(s).add(step.p.id));
            setStep({ k: "login", p: step.p });
          }}
        />
      )}

      {step.k === "login" && (
        <LoginForm
          slug={slug}
          p={step.p}
          onBack={exit}
          onDone={(data, newPin) => {
            setPin(newPin);
            setStep({ k: "result", p: step.p, data });
          }}
        />
      )}

      {step.k === "gift" && <GiftBox name={step.p.name} onOpen={() => setStep({ ...step, k: "spin" })} />}

      {step.k === "spin" && (
        <div className="glass animate-pop-in px-10 py-10 sm:px-16">
          <p className="mb-6 text-center text-lg text-white/70">Tu amigo secreto es…</p>
          <SlotReveal
            names={teammates(step.p)}
            result={step.data.receiver.name}
            onDone={() => {
              fireConfetti();
              setStep({ ...step, k: "result" });
            }}
          />
        </div>
      )}

      {step.k === "result" && (
        <ResultCard data={step.data} event={event} slug={slug} participantId={step.p.id} pin={pin} onHide={exit} />
      )}
    </div>
  );
}

// ───────────────────────── Paso 1: buscar nombre ─────────────────────────

function Search({ people, onPick }: { people: Person[]; onPick: (p: Person) => void }) {
  const [mode, setMode] = useState<"draw" | "view">("draw");
  const [q, setQ] = useState("");
  const nq = normalize(q);
  const matches = nq ? people.filter((p) => normalize(p.name).includes(nq)).slice(0, 8) : [];
  const viewing = mode === "view";

  const tab = (m: "draw" | "view", label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`flex-1 cursor-pointer rounded-xl px-3 py-3 text-sm font-bold transition sm:text-base ${
        mode === m ? (m === "draw" ? "bg-santa text-white shadow-lg shadow-santa/30" : "bg-gold text-night-950 shadow-lg shadow-gold/30") : "text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-fade-up mx-auto max-w-xl">
      <div className="glass p-6 sm:p-8">
        <div className="flex gap-1 rounded-2xl bg-black/30 p-1">
          {tab("draw", "🎲 Sortear")}
          {tab("view", "🔐 Ver mi amigo secreto")}
        </div>

        {viewing ? (
          <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs text-white/70 sm:text-sm">
            <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl">🔎</div>Busca tu nombre</div>
            <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl">🔢</div>Escribe tu PIN de 4 números</div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-white/70 sm:text-sm">
            <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl">🔎</div>Busca tu nombre</div>
            <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl">🔢</div>Crea un PIN de 4 números</div>
            <div className="rounded-2xl bg-white/5 p-3"><div className="text-2xl">🎲</div>¡Sortea!</div>
          </div>
        )}

        <input
          className="input mt-5 text-center text-xl"
          placeholder="Escribe tu nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          autoComplete="off"
          aria-label="Tu nombre"
        />

        {nq && (
          <div className="mt-3 space-y-2">
            {matches.map((p) => {
              const s = teamStyle(p.team.color);
              return (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className={`animate-fade-up flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 ${s.soft} px-4 py-3 text-left transition hover:ring-2 ${s.ring} active:scale-[0.98]`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-lg font-semibold">{p.name}</span>
                    <span className={`block text-xs ${s.text}`}>{p.team.name}</span>
                  </span>
                  <span className="text-right text-sm text-white/60">
                    {p.drawn ? "🔐 Ver mi amigo" : viewing ? "Aún no sorteas · Sortear →" : "Soy yo →"}
                  </span>
                </button>
              );
            })}
            {!matches.length && (
              <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-white/60">
                No encontramos ese nombre. Revisa cómo está escrito o pregúntale al organizador. 🦌
              </p>
            )}
          </div>
        )}

        {!nq && !viewing && (
          <button type="button" onClick={() => setMode("view")} className="mt-4 block w-full cursor-pointer text-center text-sm text-gold underline-offset-4 hover:underline">
            ¿Ya sorteaste? Vuelve a ver a tu amigo secreto con tu PIN →
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Paso 2: PIN + sortear ─────────────────────────

function PinInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      className="input mx-auto block max-w-[14rem] text-center text-3xl font-bold tracking-[0.6em]"
      type="password"
      inputMode="numeric"
      pattern="\d{4}"
      maxLength={4}
      autoComplete="off"
      placeholder="••••"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      aria-label="PIN de 4 números"
    />
  );
}

function DrawForm({
  slug, p, onBack, onDone, onAlreadyDrawn,
}: {
  slug: string;
  p: Person;
  onBack: () => void;
  onDone: (data: Result, pin: string) => void;
  onAlreadyDrawn: () => void;
}) {
  const [pin, setPin] = useState("");
  const [wish, setWish] = useState("");
  const [showWish, setShowWish] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return setErr("Tu PIN debe tener 4 números.");
    setErr("");
    setBusy(true);
    try {
      const data = await api<Result>(`/api/amigo-secreto/${slug}/claim`, { participantId: p.id, pin, wishlist: wish });
      onDone(data, pin);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Ya sorteaste")) return onAlreadyDrawn();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass animate-pop-in mx-auto max-w-md p-6 text-center sm:p-8">
      <div className="text-5xl">🎅</div>
      <h2 className="mt-2 text-2xl font-bold">¡Hola, {p.name}!</h2>
      <p className="mt-2 text-white/70">
        Crea un <b className="text-gold">PIN de 4 números</b>. Lo necesitarás si quieres volver a ver a tu amigo secreto.
      </p>

      <div className="mt-6">
        <PinInput value={pin} onChange={setPin} autoFocus />
      </div>

      {showWish ? (
        <div className="mt-5 text-left">
          <label className="label" htmlFor="wish">🎁 ¿Qué te gustaría recibir? (opcional)</label>
          <textarea id="wish" className="input min-h-20" placeholder="Ej: chocolates, un libro, algo para la oficina… Talla M." value={wish} onChange={(e) => setWish(e.target.value)} maxLength={1000} />
          <p className="mt-1 text-xs text-white/45">Solo lo verá quien te regale.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowWish(true)} className="mt-4 cursor-pointer text-sm text-gold underline-offset-4 hover:underline">
          + Añadir mi lista de deseos (opcional)
        </button>
      )}

      {err && <p className="mt-4 rounded-xl bg-santa/15 p-3 text-sm text-rose-200">{err}</p>}

      <button className="btn-santa mt-6 w-full !py-4 text-xl" disabled={busy || pin.length !== 4}>
        {busy ? "Sorteando… ⏳" : "🎲 ¡Sortear mi amigo secreto!"}
      </button>
      <button type="button" onClick={onBack} className="mt-3 cursor-pointer text-sm text-white/50 hover:text-white">
        ← No soy {p.name}
      </button>
    </form>
  );
}

function LoginForm({ slug, p, onBack, onDone }: { slug: string; p: Person; onBack: () => void; onDone: (data: Result, pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await api<Result>(`/api/amigo-secreto/${slug}/reveal`, { participantId: p.id, pin });
      onDone(data, pin);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="glass animate-pop-in mx-auto max-w-md p-6 text-center sm:p-8">
      <div className="text-5xl">🔐</div>
      <h2 className="mt-2 text-2xl font-bold">{p.name}, ya sorteaste ✅</h2>
      <p className="mt-2 text-white/70">Escribe tu PIN para volver a ver a tu amigo secreto.</p>
      <div className="mt-6">
        <PinInput value={pin} onChange={setPin} autoFocus />
      </div>
      {err && <p className="mt-4 rounded-xl bg-santa/15 p-3 text-sm text-rose-200">{err}</p>}
      <button className="btn-gold mt-6 w-full text-lg" disabled={busy || pin.length !== 4}>
        {busy ? "Abriendo… ⏳" : "Ver mi amigo secreto ✨"}
      </button>
      <p className="mt-4 text-xs text-white/45">¿Olvidaste tu PIN? Pídele al organizador que lo restablezca. Te saldrá la misma persona.</p>
      <button type="button" onClick={onBack} className="mt-3 cursor-pointer text-sm text-white/50 hover:text-white">
        ← No soy {p.name}
      </button>
    </form>
  );
}

// ───────────────────────── Revelación ─────────────────────────

function GiftBox({ name, onOpen }: { name: string; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(onOpen, 800);
  };
  return (
    <div className="glass animate-pop-in mx-auto max-w-lg p-8 text-center">
      <h2 className="text-2xl font-bold">{name}, ¡tu regalo te espera! 🎉</h2>
      <p className="mt-1 text-white/65">Asegúrate de que nadie esté mirando tu pantalla 👀</p>
      <button onClick={open} className="group mx-auto mt-8 block cursor-pointer" aria-label="Abrir regalo">
        <div className={`relative mx-auto h-56 w-56 ${opening ? "" : "animate-wiggle"}`}>
          <div className={`absolute left-1/2 top-6 z-20 h-12 w-60 -translate-x-1/2 ${opening ? "animate-lid-off" : ""}`}>
            <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 gap-1">
              <div className="h-10 w-12 -rotate-[25deg] rounded-full border-[6px] border-gold" />
              <div className="h-10 w-12 rotate-[25deg] rounded-full border-[6px] border-gold" />
            </div>
            <div className="h-full w-full rounded-xl bg-gradient-to-b from-rose-400 to-santa shadow-lg" />
            <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-gold" />
          </div>
          <div className="absolute bottom-0 left-1/2 h-40 w-52 -translate-x-1/2 overflow-hidden rounded-b-2xl rounded-t-md bg-gradient-to-b from-santa to-santa-dark shadow-2xl shadow-santa/40">
            <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-gold" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_50%)]" />
          </div>
        </div>
        <span className="btn-gold mt-8 text-lg group-hover:scale-105">🎁 Toca para abrir</span>
      </button>
    </div>
  );
}

function ResultCard({
  data, event, slug, participantId, pin, onHide,
}: {
  data: Result;
  event: EventInfo;
  slug: string;
  participantId: string;
  pin: string;
  onHide: () => void;
}) {
  return (
    <div className="animate-pop-in mx-auto max-w-lg">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-santa via-rose-600 to-santa-dark p-1 shadow-2xl shadow-santa/40">
        <div className="rounded-[calc(1.5rem-4px)] bg-night-900/90 p-7 text-center sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Tu amigo secreto es</p>
          <div className="mt-3 font-display text-5xl leading-tight sm:text-6xl">
            <span className="text-shine">{data.receiver.name}</span>
          </div>
          <div className="mt-2 text-4xl">🎁🤫</div>

          <div className="mt-6 rounded-2xl bg-white/5 p-5 text-left">
            <div className="text-sm font-semibold text-gold">📝 Su lista de deseos</div>
            <p className="mt-2 whitespace-pre-wrap text-white/85">
              {data.receiver.wishlist || "Todavía no ha escrito nada. ¡Usa tu creatividad! ✨"}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
            {event.budget && <span className="chip bg-gold/15 !px-3 !py-1.5 text-gold">💰 {event.budget}</span>}
            {event.exchange_date && (
              <span className="chip bg-pine/15 !px-3 !py-1.5 text-emerald-300">
                📅 {new Date(`${event.exchange_date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" })}
              </span>
            )}
          </div>

          <p className="mt-6 text-sm text-white/55">
            🤫 Shhh… Nadie más lo sabe, ni el organizador. Puedes volver a verlo cuando quieras con tu PIN.
          </p>
          <button className="btn-santa mt-5 w-full" onClick={onHide}>🙈 Ocultar y salir</button>
        </div>
      </div>
      <div className="glass mt-5 p-6">
        <WishlistEditor slug={slug} participantId={participantId} pin={pin} initial={data.me.wishlist} />
      </div>
    </div>
  );
}

function WishlistEditor({ slug, participantId, pin, initial }: { slug: string; participantId: string; pin: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [state, setState] = useState<string>("idle");
  return (
    <div className="text-left">
      <label className="label" htmlFor="mywish">✏️ Mi lista de deseos (la verá quien me regale)</label>
      <textarea id="mywish" className="input min-h-20" value={text} onChange={(e) => { setText(e.target.value); setState("idle"); }} maxLength={1000} placeholder="¿Qué te gustaría recibir?" />
      <div className="mt-2 flex items-center gap-3">
        <button
          className="btn-pine !py-2 text-sm"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            try {
              await api(`/api/amigo-secreto/${slug}/wishlist`, { participantId, pin, wishlist: text });
              setState("saved");
            } catch (e) {
              setState((e as Error).message);
            }
          }}
        >
          Guardar
        </button>
        <span className="text-sm text-white/60">
          {state === "saving" ? "Guardando…" : state === "saved" ? "✅ Guardado" : state !== "idle" ? state : ""}
        </span>
      </div>
    </div>
  );
}
