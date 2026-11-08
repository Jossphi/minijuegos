"use client";
import confetti from "canvas-confetti";
import { useMemo, useState } from "react";
import { Steps, teamStyle } from "@/components/ui";
import SlotReveal from "./SlotReveal";

type PersonState = { drawn: boolean; answered: boolean; declined: boolean };
type Team = { id: string; name: string; color: string; participants: ({ id: string; name: string } & PersonState)[] };
type Person = { id: string; name: string; team: { id: string; name: string; color: string } } & PersonState;
type EventInfo = { name: string; budget: string | null; exchange_date: string | null; draw_open: boolean };
type Result = { me: { name: string; wishlist: string | null }; receiver: { name: string; wishlist: string | null } };

type Step =
  | { k: "search" }
  | { k: "attend"; p: Person }
  | { k: "declined"; p: Person }
  | { k: "waitDraw"; p: Person }
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

const DRAW_STEPS = ["Tu nombre", "Asistencia", "Crea un PIN", "¡Sortea!"];

function eventDateLabel(date: string | null) {
  if (!date) return "el día del compartir";
  return "el " + new Date(`${date}T00:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fireConfetti() {
  const colors = ["#c8102e", "#15803d", "#f2b33d", "#ffffff"];
  const end = Date.now() + 1200;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.55 }, colors });
}

export default function SecretSantaGame({ slug, initialTeams, event }: { slug: string; initialTeams: Team[]; event: EventInfo }) {
  const people = useMemo<Person[]>(
    () =>
      initialTeams
        .flatMap((t) => t.participants.map((p) => ({ ...p, team: { id: t.id, name: t.name, color: t.color } })))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [initialTeams],
  );
  const [overrides, setOverrides] = useState<Record<string, Partial<PersonState>>>({});
  const state = (p: Person): Person => ({ ...p, ...overrides[p.id] });
  const patch = (id: string, s: Partial<PersonState>) => setOverrides((o) => ({ ...o, [id]: { ...o[id], ...s } }));
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
          people={people.map(state)}
          onPick={(p) =>
            setStep(
              p.drawn ? { k: "login", p }
              : p.declined ? { k: "declined", p }
              : !p.answered ? { k: "attend", p }
              : !event.draw_open ? { k: "waitDraw", p }
              : { k: "draw", p },
            )
          }
        />
      )}

      {step.k === "attend" && (
        <AttendanceForm
          slug={slug}
          p={step.p}
          event={event}
          onBack={exit}
          onAnswer={(answer) => {
            patch(step.p.id, { answered: true, declined: answer === "no" });
            setStep(answer === "no" ? { k: "declined", p: step.p } : event.draw_open ? { k: "draw", p: step.p } : { k: "waitDraw", p: step.p });
          }}
          onAlreadyAnswered={() => {
            patch(step.p.id, { answered: true });
            setStep(event.draw_open ? { k: "draw", p: step.p } : { k: "waitDraw", p: step.p });
          }}
        />
      )}

      {step.k === "declined" && <Declined p={step.p} onBack={exit} />}
      {step.k === "waitDraw" && <WaitDraw p={step.p} onBack={exit} />}

      {step.k === "draw" && (
        <DrawForm
          slug={slug}
          p={step.p}
          onBack={exit}
          onDone={(data, newPin) => {
            setPin(newPin);
            patch(step.p.id, { drawn: true });
            setStep({ k: "gift", p: step.p, data });
          }}
          onAlreadyDrawn={() => {
            patch(step.p.id, { drawn: true });
            setStep({ k: "login", p: step.p });
          }}
          onNeedsAttendance={() => setStep({ k: "attend", p: step.p })}
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
        <div className="card animate-pop-in px-6 py-8 sm:px-10">
          <p className="mb-5 text-center text-sm font-semibold text-muted">Tu amigo secreto es…</p>
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
      className={`flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        mode === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="card animate-fade-up p-5 sm:p-7">
      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        {tab("draw", "🎲 Sortear")}
        {tab("view", "🔐 Ver mi amigo secreto")}
      </div>

      <div className="mt-6">
        {viewing ? <Steps steps={["Tu nombre", "Tu PIN"]} current={0} /> : <Steps steps={DRAW_STEPS} current={0} />}
      </div>

      <label htmlFor="name" className="label mt-6">
        {viewing ? "Escribe tu nombre para ver tu resultado" : "Escribe tu nombre para empezar"}
      </label>
      <input
        id="name"
        className="input text-lg"
        placeholder="Ej: María"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        autoComplete="off"
        aria-label="Tu nombre"
      />

      {nq && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {matches.map((p) => {
            const s = teamStyle(p.team.color);
            return (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p)}
                  className="flex w-full cursor-pointer items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-paper"
                >
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">{p.name}</span>
                    <span className={`mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      {p.team.name}
                    </span>
                  </span>
                  <span className={`text-sm font-semibold ${p.drawn ? "text-gold" : "text-santa"}`}>
                    {p.drawn ? "Ver mi amigo →" : p.declined ? "No asistirá" : viewing ? "Aún no sorteas · Sortear →" : "Soy yo →"}
                  </span>
                </button>
              </li>
            );
          })}
          {!matches.length && (
            <li className="bg-white p-4 text-center text-sm text-muted">
              No encontramos ese nombre. Revisa cómo está escrito o pregúntale al organizador.
            </li>
          )}
        </ul>
      )}

      {!nq && !viewing && (
        <p className="mt-5 text-center text-sm text-muted">
          ¿Ya sorteaste?{" "}
          <button type="button" onClick={() => setMode("view")} className="cursor-pointer font-semibold text-santa hover:underline">
            Vuelve a ver a tu amigo secreto
          </button>
        </p>
      )}
    </div>
  );
}

// ───────────────────────── Paso 2: PIN + sortear ─────────────────────────

function PinInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      className="input mx-auto block max-w-[16rem] text-center text-2xl font-bold tracking-[0.5em]"
      type="password"
      inputMode="numeric"
      pattern="\d{4,6}"
      maxLength={6}
      autoComplete="off"
      placeholder="••••••"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      aria-label="PIN"
    />
  );
}

function PersonHeader({ p, title, subtitle }: { p: Person; title: string; subtitle: React.ReactNode }) {
  const s = teamStyle(p.team.color);
  return (
    <div className="text-center">
      <span className={`chip ${s.soft} ${s.text}`}>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        {p.team.name}
      </span>
      <h2 className="mt-3 text-2xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">{subtitle}</p>
    </div>
  );
}

function DrawForm({
  slug, p, onBack, onDone, onAlreadyDrawn, onNeedsAttendance,
}: {
  slug: string;
  p: Person;
  onBack: () => void;
  onDone: (data: Result, pin: string) => void;
  onAlreadyDrawn: () => void;
  onNeedsAttendance: () => void;
}) {
  const [pin, setPin] = useState("");
  const [wish, setWish] = useState("");
  const [showWish, setShowWish] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return setErr("Tu PIN debe tener 6 números.");
    setErr("");
    setBusy(true);
    try {
      const data = await api<Result>(`/api/amigo-secreto/${slug}/claim`, { participantId: p.id, pin, wishlist: wish });
      onDone(data, pin);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Ya sorteaste")) return onAlreadyDrawn();
      if (msg.includes("confirma tu asistencia")) return onNeedsAttendance();
      if (msg.includes("aún no está abierto")) return onNeedsAttendance();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card animate-pop-in p-6 sm:p-8">
      <Steps steps={DRAW_STEPS} current={2} />
      <div className="mt-6">
        <PersonHeader
          p={p}
          title={`Hola, ${p.name}`}
          subtitle={<>Crea un <b className="text-ink">PIN de 6 números</b> y apúntalo. Lo necesitarás para volver a ver tu resultado.</>}
        />
      </div>

      <div className="mt-6">
        <PinInput value={pin} onChange={setPin} autoFocus />
        <p className="mt-2 text-center text-xs text-muted">{pin.length}/6</p>
      </div>

      {showWish ? (
        <div className="mt-5">
          <label className="label" htmlFor="wish">¿Qué te gustaría recibir? <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="wish" className="input min-h-20" placeholder="Ej: chocolates, un libro, algo para la oficina… Talla M." value={wish} onChange={(e) => setWish(e.target.value)} maxLength={1000} />
          <p className="mt-1 text-xs text-muted">Solo lo verá quien te regale.</p>
        </div>
      ) : (
        <p className="mt-4 text-center">
          <button type="button" onClick={() => setShowWish(true)} className="cursor-pointer text-sm font-semibold text-pine hover:underline">
            + Añadir mi lista de deseos (opcional)
          </button>
        </p>
      )}

      {err && <p className="mt-4 rounded-xl bg-santa-soft p-3 text-center text-sm font-medium text-santa">{err}</p>}

      <button className="btn-primary mt-6 w-full !py-4 text-lg" disabled={busy || pin.length !== 6}>
        {busy ? "Sorteando…" : "🎲 Sortear mi amigo secreto"}
      </button>
      <p className="mt-3 text-center">
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-muted hover:text-ink">
          ← No soy {p.name}
        </button>
      </p>
    </form>
  );
}

function AttendanceForm({
  slug, p, event, onBack, onAnswer, onAlreadyAnswered,
}: {
  slug: string;
  p: Person;
  event: EventInfo;
  onBack: () => void;
  onAnswer: (answer: "yes" | "no") => void;
  onAlreadyAnswered: () => void;
}) {
  const [committed, setCommitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const when = eventDateLabel(event.exchange_date);

  const send = async (answer: "yes" | "no") => {
    if (answer === "no" && !window.confirm(`¿Seguro que NO podrás asistir ${when}?\n\nNo participarás en el sorteo y no podrás cambiar tu respuesta tú mismo.`)) return;
    setErr("");
    setBusy(true);
    try {
      await api(`/api/amigo-secreto/${slug}/attendance`, { participantId: p.id, answer });
      onAnswer(answer);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Ya respondiste")) return onAlreadyAnswered();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card animate-pop-in p-6 sm:p-8">
      <Steps steps={DRAW_STEPS} current={1} />
      <div className="mt-6">
        <PersonHeader
          p={p}
          title={`Hola, ${p.name}`}
          subtitle={<>¿Confirmas tu participación y asistencia al <b className="text-ink">compartir navideño</b> {when}?</>}
        />
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-gold-soft p-4 text-sm text-amber-900">
        <p className="font-bold">⚠️ Esta confirmación es obligatoria y solo se responde una vez.</p>
        <p className="mt-1">
          Si confirmas, tu equipo contará contigo: le regalarás a una persona y otra persona te regalará a ti. Por respeto a
          todos, responde con sinceridad.
        </p>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-sm text-ink transition hover:bg-paper">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#15803d]" checked={committed} onChange={(e) => setCommitted(e.target.checked)} />
        <span>Me comprometo a asistir {when} y a llevar mi regalo.</span>
      </label>

      {err && <p className="mt-4 rounded-xl bg-santa-soft p-3 text-center text-sm font-medium text-santa">{err}</p>}

      <button className="btn-green mt-5 w-full !py-4 text-lg" disabled={busy || !committed} onClick={() => send("yes")}>
        ✓ Sí, confirmo mi asistencia
      </button>
      <button className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => send("no")}>
        No podré asistir
      </button>
      <p className="mt-3 text-center">
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-muted hover:text-ink">
          ← No soy {p.name}
        </button>
      </p>
    </div>
  );
}

function Declined({ p, onBack }: { p: Person; onBack: () => void }) {
  return (
    <div className="card animate-pop-in p-8 text-center">
      <div className="text-4xl">💚</div>
      <h2 className="mt-3 text-2xl font-bold text-ink">Gracias por avisar, {p.name}</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        Indicaste que no podrás asistir, así que no participas en este sorteo. Si cambias de idea, habla con el organizador.
      </p>
      <button className="btn-secondary mt-6" onClick={onBack}>Volver</button>
    </div>
  );
}

function WaitDraw({ p, onBack }: { p: Person; onBack: () => void }) {
  return (
    <div className="card animate-pop-in p-8 text-center">
      <div className="text-4xl">✅</div>
      <h2 className="mt-3 text-2xl font-bold text-ink">¡Asistencia confirmada, {p.name}!</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        El sorteo todavía no está abierto. Cuando el organizador lo abra, entra de nuevo con tu nombre para sortear a tu amigo secreto.
      </p>
      <button className="btn-secondary mt-6" onClick={onBack}>Volver</button>
    </div>
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
    <form onSubmit={submit} className="card animate-pop-in p-6 sm:p-8">
      <Steps steps={["Tu nombre", "Tu PIN"]} current={1} />
      <div className="mt-6">
        <PersonHeader p={p} title={`${p.name}, ya sorteaste ✓`} subtitle="Escribe tu PIN para volver a ver a tu amigo secreto." />
      </div>
      <div className="mt-6">
        <PinInput value={pin} onChange={setPin} autoFocus />
      </div>
      {err && <p className="mt-4 rounded-xl bg-santa-soft p-3 text-center text-sm font-medium text-santa">{err}</p>}
      <button className="btn-primary mt-6 w-full !py-4 text-lg" disabled={busy || pin.length < 4}>
        {busy ? "Abriendo…" : "Ver mi amigo secreto"}
      </button>
      <p className="mt-4 text-center text-xs text-muted">¿Olvidaste tu PIN? Pídele al organizador que lo restablezca. Te saldrá la misma persona.</p>
      <p className="mt-2 text-center">
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-muted hover:text-ink">
          ← No soy {p.name}
        </button>
      </p>
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
    <div className="card animate-pop-in p-8 text-center">
      <h2 className="text-2xl font-bold text-ink">{name}, tu regalo te espera</h2>
      <p className="mt-1 text-muted">Asegúrate de que nadie esté mirando tu pantalla.</p>
      <button onClick={open} className="group mx-auto mt-8 block cursor-pointer" aria-label="Abrir regalo">
        <div className={`relative mx-auto h-48 w-48 ${opening ? "" : "animate-wiggle"}`}>
          <div className={`absolute left-1/2 top-5 z-20 h-10 w-52 -translate-x-1/2 ${opening ? "animate-lid-off" : ""}`}>
            <div className="absolute -top-8 left-1/2 flex -translate-x-1/2 gap-1">
              <div className="h-9 w-11 -rotate-[25deg] rounded-full border-[5px] border-amber-400" />
              <div className="h-9 w-11 rotate-[25deg] rounded-full border-[5px] border-amber-400" />
            </div>
            <div className="h-full w-full rounded-lg bg-[#e0384f]" />
            <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-amber-400" />
          </div>
          <div className="absolute bottom-0 left-1/2 h-36 w-44 -translate-x-1/2 overflow-hidden rounded-b-xl rounded-t-sm bg-santa shadow-lg">
            <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-amber-400" />
          </div>
        </div>
        <span className="btn-primary mt-8 !px-8 text-base">Toca para abrir</span>
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
    <div className="animate-pop-in space-y-4">
      <div className="card overflow-hidden">
        <div className="ribbon" aria-hidden />
        <div className="p-7 text-center sm:p-9">
          <p className="eyebrow">Tu amigo secreto es</p>
          <div className="font-display mt-3 text-4xl leading-tight text-ink sm:text-5xl">{data.receiver.name}</div>

          <div className="mt-6 rounded-xl bg-paper p-5 text-left">
            <div className="text-sm font-semibold text-ink">Su lista de deseos</div>
            <p className="mt-2 whitespace-pre-wrap text-muted">
              {data.receiver.wishlist || "Todavía no ha escrito nada. ¡Usa tu creatividad!"}
            </p>
          </div>

          {(event.budget || event.exchange_date) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
              {event.budget && <span className="chip border border-line bg-white text-ink">💰 {event.budget}</span>}
              {event.exchange_date && (
                <span className="chip border border-line bg-white text-ink">
                  📅 {new Date(`${event.exchange_date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" })}
                </span>
              )}
            </div>
          )}

          <p className="mt-6 text-sm text-muted">🤫 Nadie más lo sabe, ni el organizador. Puedes volver a verlo con tu PIN.</p>
          <button className="btn-secondary mt-5 w-full" onClick={onHide}>Ocultar y salir</button>
        </div>
      </div>
      <div className="card p-6">
        <WishlistEditor slug={slug} participantId={participantId} pin={pin} initial={data.me.wishlist} />
      </div>
    </div>
  );
}

function WishlistEditor({ slug, participantId, pin, initial }: { slug: string; participantId: string; pin: string; initial: string | null }) {
  const [text, setText] = useState(initial ?? "");
  const [state, setState] = useState<string>("idle");
  return (
    <div>
      <label className="label" htmlFor="mywish">Mi lista de deseos <span className="font-normal text-muted">(la verá quien me regale)</span></label>
      <textarea id="mywish" className="input min-h-20" value={text} onChange={(e) => { setText(e.target.value); setState("idle"); }} maxLength={1000} placeholder="¿Qué te gustaría recibir?" />
      <div className="mt-3 flex items-center gap-3">
        <button
          className="btn-green !py-2 text-sm"
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
        <span className="text-sm text-muted">
          {state === "saving" ? "Guardando…" : state === "saved" ? "✓ Guardado" : state !== "idle" ? state : ""}
        </span>
      </div>
    </div>
  );
}
