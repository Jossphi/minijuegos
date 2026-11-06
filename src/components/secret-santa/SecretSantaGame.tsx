"use client";
import confetti from "canvas-confetti";
import { useCallback, useState } from "react";
import { teamStyle } from "@/components/ui";
import SlotReveal from "./SlotReveal";

type Participant = { id: string; name: string; claimed: boolean };
type Team = { id: string; name: string; color: string; drawn: boolean; participants: Participant[] };
type EventInfo = { name: string; budget: string | null; exchange_date: string | null };

type RevealResult =
  | { status: "waiting"; me: { name: string; wishlist: string | null }; progress: { claimed: number; total: number } }
  | { status: "revealed"; me: { name: string; wishlist: string | null }; receiver: { name: string; wishlist: string | null } };

type Step =
  | { k: "team" }
  | { k: "name"; team: Team }
  | { k: "register"; team: Team; p: Participant }
  | { k: "login"; team: Team; p: Participant }
  | { k: "waiting"; team: Team; p: Participant; data: Extract<RevealResult, { status: "waiting" }> }
  | { k: "gift"; team: Team; p: Participant; data: Extract<RevealResult, { status: "revealed" }> }
  | { k: "spin"; team: Team; p: Participant; data: Extract<RevealResult, { status: "revealed" }> }
  | { k: "result"; team: Team; p: Participant; data: Extract<RevealResult, { status: "revealed" }> };

async function api<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, payload === undefined ? { cache: "no-store" } : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Algo salió mal");
  return json as T;
}

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
  const [teams, setTeams] = useState(initialTeams);
  const [step, setStep] = useState<Step>(() => (initialTeams.length === 1 ? { k: "name", team: initialTeams[0] } : { k: "team" }));
  const [secret, setSecret] = useState("");

  const refresh = useCallback(async () => {
    const d = await api<{ teams: Team[] }>(`/api/amigo-secreto/${slug}`);
    setTeams(d.teams);
    return d.teams;
  }, [slug]);

  const goHome = () => {
    setSecret("");
    setStep(teams.length === 1 ? { k: "name", team: teams[0] } : { k: "team" });
    refresh().catch(() => {});
  };

  const handleReveal = (team: Team, p: Participant, data: RevealResult, s: string) => {
    setSecret(s);
    if (data.status === "waiting") setStep({ k: "waiting", team, p, data });
    else setStep({ k: "gift", team, p, data });
  };

  return (
    <div className="mt-8">
      {step.k !== "team" && step.k !== "spin" && (
        <Breadcrumb step={step} onTeams={teams.length > 1 ? goHome : undefined} onNames={() => { setSecret(""); setStep({ k: "name", team: teams.find((t) => t.id === step.team.id) ?? step.team }); }} />
      )}

      {step.k === "team" && <TeamPicker teams={teams} onPick={(team) => setStep({ k: "name", team })} />}

      {step.k === "name" && (
        <NamePicker
          team={step.team}
          onPick={(p) => setStep(p.claimed ? { k: "login", team: step.team, p } : { k: "register", team: step.team, p })}
        />
      )}

      {step.k === "register" && (
        <RegisterForm
          slug={slug}
          team={step.team}
          p={step.p}
          onDone={async (s) => {
            const fresh = await refresh();
            const team = fresh.find((t) => t.id === step.team.id) ?? step.team;
            const data = await api<RevealResult>(`/api/amigo-secreto/${slug}/reveal`, { participantId: step.p.id, secret: s });
            handleReveal(team, { ...step.p, claimed: true }, data, s);
          }}
          onAlreadyClaimed={() => setStep({ k: "login", team: step.team, p: { ...step.p, claimed: true } })}
        />
      )}

      {step.k === "login" && (
        <LoginForm slug={slug} p={step.p} onDone={(data, s) => handleReveal(step.team, step.p, data, s)} />
      )}

      {step.k === "waiting" && (
        <Waiting
          data={step.data}
          onRetry={async () => {
            const data = await api<RevealResult>(`/api/amigo-secreto/${slug}/reveal`, { participantId: step.p.id, secret });
            handleReveal(step.team, step.p, data, secret);
          }}
          onExit={goHome}
          slug={slug}
          participantId={step.p.id}
          secret={secret}
        />
      )}

      {step.k === "gift" && (
        <GiftBox name={step.p.name} onOpen={() => setStep({ ...step, k: "spin" })} />
      )}

      {step.k === "spin" && (
        <div className="glass animate-pop-in px-10 py-10 sm:px-16">
          <p className="mb-6 text-center text-lg text-white/70">Tu amigo secreto es…</p>
          <SlotReveal
            names={step.team.participants.filter((x) => x.id !== step.p.id).map((x) => x.name)}
            result={step.data.receiver.name}
            onDone={() => {
              fireConfetti();
              setStep({ ...step, k: "result" });
            }}
          />
        </div>
      )}

      {step.k === "result" && (
        <Result data={step.data} event={event} slug={slug} participantId={step.p.id} secret={secret} onHide={goHome} />
      )}
    </div>
  );
}

// ───────────────────────── Pasos ─────────────────────────

function Breadcrumb({ step, onTeams, onNames }: { step: Exclude<Step, { k: "team" }>; onTeams?: () => void; onNames: () => void }) {
  const s = teamStyle(step.team.color);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-white/60">
      {onTeams && (
        <button onClick={onTeams} className="cursor-pointer hover:text-white">Equipos</button>
      )}
      {onTeams && <span>›</span>}
      <button onClick={onNames} className={`cursor-pointer font-semibold ${s.text} hover:brightness-125`}>
        {s.emoji} {step.team.name}
      </button>
      {"p" in step && (<><span>›</span><span className="text-white">{step.p.name}</span></>)}
    </div>
  );
}

function TeamPicker({ teams, onPick }: { teams: Team[]; onPick: (t: Team) => void }) {
  if (!teams.length)
    return <div className="glass p-10 text-center text-white/70">El organizador todavía no ha creado los equipos. 🦌</div>;
  return (
    <div className="animate-fade-up">
      <h2 className="mb-5 text-center text-2xl font-semibold">¿En qué equipo estás?</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {teams.map((t, i) => {
          const s = teamStyle(t.color);
          const claimed = t.participants.filter((p) => p.claimed).length;
          const total = t.participants.length;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className={`group animate-fade-up relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br ${s.grad} p-7 text-left shadow-2xl transition hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.99]`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div aria-hidden className="absolute -right-4 -top-4 text-8xl opacity-25 transition group-hover:rotate-12">{s.emoji}</div>
              <div className="relative">
                <div className="text-4xl">{s.emoji}</div>
                <div className="mt-2 font-display text-4xl font-bold">{t.name}</div>
                <div className="mt-1 text-white/85">{total} integrantes</div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${total ? (claimed / total) * 100 : 0}%` }} />
                </div>
                <div className="mt-2 text-sm font-medium">
                  {t.drawn ? "✨ ¡Sorteo listo! Entra a descubrir el tuyo" : `${claimed} de ${total} ya se registraron`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NamePicker({ team, onPick }: { team: Team; onPick: (p: Participant) => void }) {
  const s = teamStyle(team.color);
  const [q, setQ] = useState("");
  const list = team.participants.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="glass animate-pop-in p-6 sm:p-8">
      <h2 className="text-center text-2xl font-semibold">¿Quién eres? 👀</h2>
      <p className="mt-1 text-center text-white/60">Toca tu nombre. Solo tú debes entrar con el tuyo.</p>
      {team.participants.length > 10 && (
        <input className="input mt-5" placeholder="Buscar mi nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className={`animate-fade-up group relative cursor-pointer rounded-2xl border border-white/10 ${s.soft} px-3 py-4 text-center font-semibold transition hover:-translate-y-0.5 hover:ring-2 ${s.ring} active:scale-95`}
            style={{ animationDelay: `${i * 0.03}s` }}
          >
            <div className="text-lg">{p.name}</div>
            <div className="mt-1 text-xs font-normal text-white/55">{p.claimed ? "🔐 Entrar con mi clave" : "✍️ Registrarme"}</div>
          </button>
        ))}
      </div>
      {!team.participants.length && <p className="mt-6 text-center text-white/60">Este equipo aún no tiene integrantes.</p>}
    </div>
  );
}

function RegisterForm({
  slug, team, p, onDone, onAlreadyClaimed,
}: { slug: string; team: Team; p: Participant; onDone: (secret: string) => Promise<void>; onAlreadyClaimed: () => void }) {
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [wish, setWish] = useState("");
  const [me, setMe] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (s1.trim().length < 6) return setErr("La clave debe tener al menos 6 caracteres.");
    if (s1 !== s2) return setErr("Las claves no coinciden.");
    setBusy(true);
    try {
      await api(`/api/amigo-secreto/${slug}/claim`, { participantId: p.id, secret: s1, wishlist: wish });
      await onDone(s1);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("ya se registró")) return onAlreadyClaimed();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass animate-pop-in mx-auto max-w-lg p-6 sm:p-8">
      <div className="text-center text-5xl">🎅</div>
      <h2 className="mt-2 text-center text-2xl font-semibold">¡Hola, {p.name}!</h2>
      <p className="mt-1 text-center text-white/65">
        Crea tu <b className="text-gold">clave secreta</b>. Con ella descubrirás a tu amigo secreto
        {team.drawn ? "." : " cuando todo tu equipo se haya registrado."}
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="s1">Clave secreta (mín. 6 caracteres)</label>
          <div className="relative">
            <input id="s1" className="input pr-12" type={show ? "text" : "password"} autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} required />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xl" aria-label="Mostrar clave">
              {show ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="s2">Repite la clave</label>
          <input id="s2" className="input" type={show ? "text" : "password"} autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="wish">🎁 Tu lista de deseos (opcional)</label>
          <textarea id="wish" className="input min-h-24" placeholder="Ej: libros de misterio, chocolates, algo para la oficina… Talla M." value={wish} onChange={(e) => setWish(e.target.value)} maxLength={1000} />
          <p className="mt-1 text-xs text-white/45">Solo la verá quien te regale. Puedes cambiarla después.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/5 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#ffc93c]" checked={me} onChange={(e) => setMe(e.target.checked)} />
          <span>Confirmo que soy <b>{p.name}</b> y que guardaré mi clave. Si la olvido, habrá que repetir el sorteo de mi equipo.</span>
        </label>
      </div>

      {err && <p className="mt-4 rounded-xl bg-santa/15 p-3 text-center text-sm text-rose-200">{err}</p>}
      <button className="btn-santa mt-6 w-full text-lg" disabled={busy || !me}>
        {busy ? "Guardando… ⏳" : "Registrarme 🎄"}
      </button>
    </form>
  );
}

function LoginForm({ slug, p, onDone }: { slug: string; p: Participant; onDone: (data: RevealResult, secret: string) => void }) {
  const [s, setS] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await api<RevealResult>(`/api/amigo-secreto/${slug}/reveal`, { participantId: p.id, secret: s });
      onDone(data, s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="glass animate-pop-in mx-auto max-w-md p-6 text-center sm:p-8">
      <div className="text-5xl">🔐</div>
      <h2 className="mt-2 text-2xl font-semibold">Hola de nuevo, {p.name}</h2>
      <p className="mt-1 text-white/65">Escribe tu clave secreta para continuar.</p>
      <input className="input mt-6 text-center text-lg" type="password" autoComplete="current-password" autoFocus value={s} onChange={(e) => setS(e.target.value)} placeholder="••••••" required />
      {err && <p className="mt-4 rounded-xl bg-santa/15 p-3 text-sm text-rose-200">{err}</p>}
      <button className="btn-gold mt-6 w-full text-lg" disabled={busy || !s}>
        {busy ? "Abriendo… ⏳" : "Entrar ✨"}
      </button>
      <p className="mt-4 text-xs text-white/45">¿Olvidaste tu clave? Pídele al organizador que la restablezca.</p>
    </form>
  );
}

function Waiting({
  data, onRetry, onExit, slug, participantId, secret,
}: {
  data: Extract<RevealResult, { status: "waiting" }>;
  onRetry: () => Promise<void>;
  onExit: () => void;
  slug: string;
  participantId: string;
  secret: string;
}) {
  const [busy, setBusy] = useState(false);
  const pct = data.progress.total ? Math.round((data.progress.claimed / data.progress.total) * 100) : 0;
  const missing = data.progress.total - data.progress.claimed;
  return (
    <div className="glass animate-pop-in mx-auto max-w-lg p-6 text-center sm:p-8">
      <div className="animate-float text-6xl">⏳</div>
      <h2 className="mt-3 text-2xl font-semibold">¡Listo, {data.me.name}! Ya estás dentro</h2>
      <p className="mt-2 text-white/70">
        {missing > 0
          ? `Faltan ${missing} persona${missing === 1 ? "" : "s"} de tu equipo por registrarse. El sorteo se hará solo cuando estén todos.`
          : "Todos están registrados. El organizador lanzará el sorteo en breve."}
      </p>
      <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-santa via-gold to-pine transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-white/60">{data.progress.claimed} / {data.progress.total} registrados</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          className="btn-pine flex-1"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } }}
        >
          🔄 Comprobar de nuevo
        </button>
        <button className="btn-ghost flex-1" onClick={onExit}>Salir</button>
      </div>
      <WishlistEditor slug={slug} participantId={participantId} secret={secret} initial={data.me.wishlist} />
    </div>
  );
}

function GiftBox({ name, onOpen }: { name: string; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(onOpen, 800);
  };
  return (
    <div className="glass animate-pop-in mx-auto max-w-lg p-8 text-center">
      <h2 className="text-2xl font-semibold">{name}, ¡tu regalo te espera! 🎉</h2>
      <p className="mt-1 text-white/65">Asegúrate de que nadie esté mirando tu pantalla 👀</p>
      <button onClick={open} className="group mx-auto mt-8 block cursor-pointer" aria-label="Abrir regalo">
        <div className={`relative mx-auto h-56 w-56 ${opening ? "" : "animate-wiggle"}`}>
          {/* tapa */}
          <div className={`absolute left-1/2 top-6 z-20 h-12 w-60 -translate-x-1/2 ${opening ? "animate-lid-off" : ""}`}>
            <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 gap-1">
              <div className="h-10 w-12 -rotate-[25deg] rounded-full border-[6px] border-gold" />
              <div className="h-10 w-12 rotate-[25deg] rounded-full border-[6px] border-gold" />
            </div>
            <div className="h-full w-full rounded-xl bg-gradient-to-b from-rose-400 to-santa shadow-lg" />
            <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-gold" />
          </div>
          {/* caja */}
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

function Result({
  data, event, slug, participantId, secret, onHide,
}: {
  data: Extract<RevealResult, { status: "revealed" }>;
  event: EventInfo;
  slug: string;
  participantId: string;
  secret: string;
  onHide: () => void;
}) {
  return (
    <div className="animate-pop-in mx-auto max-w-lg">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-santa via-rose-600 to-santa-dark p-1 shadow-2xl shadow-santa/40">
        <div className="rounded-[calc(1.5rem-4px)] bg-night-900/90 p-7 text-center sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Tu amigo secreto es</p>
          <div className="mt-3 font-display text-6xl font-bold leading-tight sm:text-7xl">
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
            🤫 Shhh… Nadie más lo sabe. Ni el organizador. Puedes volver a verlo cuando quieras con tu clave.
          </p>
          <button className="btn-santa mt-5 w-full" onClick={onHide}>🙈 Ocultar y salir</button>
        </div>
      </div>
      <div className="glass mt-5 p-6">
        <WishlistEditor slug={slug} participantId={participantId} secret={secret} initial={data.me.wishlist} compact={false} />
      </div>
    </div>
  );
}

function WishlistEditor({
  slug, participantId, secret, initial, compact = true,
}: { slug: string; participantId: string; secret: string; initial: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  if (!open)
    return (
      <button className="mt-5 cursor-pointer text-sm text-gold underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
        ✏️ Editar mi lista de deseos
      </button>
    );
  return (
    <div className="mt-5 text-left">
      <label className="label" htmlFor="mywish">✏️ Mi lista de deseos</label>
      <textarea id="mywish" className="input min-h-24" value={text} onChange={(e) => { setText(e.target.value); setState("idle"); }} maxLength={1000} placeholder="¿Qué te gustaría recibir?" />
      <div className="mt-2 flex items-center gap-3">
        <button
          className="btn-pine !py-2 text-sm"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            try {
              await api(`/api/amigo-secreto/${slug}/wishlist`, { participantId, secret, wishlist: text });
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
