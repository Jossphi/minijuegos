"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TEAM_STYLES, teamStyle } from "@/components/ui";
import { useAdminAction } from "./useAdmin";

type Event = {
  id: string; slug: string; name: string; budget: string | null;
  exchange_date: string | null; message: string | null; is_active: boolean;
};
type P = { id: string; name: string; drawn: boolean; locked: boolean };
type Team = {
  id: string; name: string; color: string; draw_mode: "cycle" | "free";
  drawn_at: string | null; participants: P[]; exclusions: { a_id: string; b_id: string }[];
};

export default function EventManager({ event, teams }: { event: Event; teams: Team[] }) {
  const total = teams.reduce((n, t) => n + t.participants.length, 0);
  const drawn = teams.reduce((n, t) => n + t.participants.filter((p) => p.drawn).length, 0);
  const pct = total ? Math.round((drawn / total) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gold">Gestionar sorteo</p>
        <h1 className="font-display text-5xl font-bold"><span className="text-shine">{event.name}</span></h1>
      </div>

      <div className="glass p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm text-white/60">🎁 Ya tienen amigo secreto</div>
            <div className="mt-1 text-5xl font-extrabold">
              {drawn} <span className="text-2xl font-semibold text-white/50">de {total}</span>
            </div>
          </div>
          <div className="text-right text-sm text-white/60">
            {total - drawn > 0 ? `Faltan ${total - drawn} por sortear` : total ? "🎉 ¡Todos ya sortearon!" : "Añade participantes abajo"}
          </div>
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-santa via-gold to-pine transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rounded-3xl border border-gold/30 bg-gold/10 p-5 text-sm text-amber-100">
        <b>🔒 Privacidad:</b> los resultados se guardan cifrados. Este panel solo muestra <i>quién ya sorteó</i>, nunca a quién le
        tocó. <b>Consejo:</b> carga la lista completa de cada equipo antes de compartir el enlace; cuando alguien sortea, la
        lista de su equipo queda fija.
      </div>

      <ShareLink slug={event.slug} />

      <div className="grid gap-6 lg:grid-cols-2">
        {teams.map((t) => <TeamPanel key={t.id} team={t} />)}
        <NewTeam eventId={event.id} />
      </div>

      <EventSettings event={event} />
    </div>
  );
}

function ShareLink({ slug }: { slug: string }) {
  const [url, setUrl] = useState(`/amigo-secreto/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/amigo-secreto/${slug}`), [slug]);
  return (
    <div className="glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <div className="text-sm text-white/60">🔗 Enlace para compartir con los participantes</div>
        <div className="mt-1 break-all font-mono text-gold">{url}</div>
      </div>
      <div className="flex gap-2">
        <button className="btn-gold" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "✅ Copiado" : "📋 Copiar"}
        </button>
        <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`🎁 ¡Únete al Amigo Secreto! ${url}`)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  );
}

function TeamPanel({ team }: { team: Team }) {
  const s = teamStyle(team.color);
  const { run, busy, error } = useAdminAction();
  const [names, setNames] = useState("");
  const [exA, setExA] = useState("");
  const [exB, setExB] = useState("");
  const [editing, setEditing] = useState(false);
  const [tName, setTName] = useState(team.name);

  const doneCount = team.participants.filter((p) => p.drawn).length;
  const total = team.participants.length;
  const drawn = !!team.drawn_at;
  const byId = new Map(team.participants.map((p) => [p.id, p.name]));

  return (
    <section className="glass overflow-hidden">
      <div className={`bg-gradient-to-br ${s.grad} p-5`}>
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); await run("updateTeam", { teamId: team.id, name: tName }); setEditing(false); }}>
              <input className="input !py-2" value={tName} onChange={(e) => setTName(e.target.value)} autoFocus />
              <button className="btn bg-white !py-2 text-night-950">OK</button>
            </form>
          ) : (
            <button className="cursor-pointer text-left" onClick={() => setEditing(true)} title="Renombrar">
              <div className="font-display text-4xl font-bold">{s.emoji} {team.name}</div>
            </button>
          )}
          <button
            className="cursor-pointer rounded-xl bg-black/20 px-2 py-1 text-sm hover:bg-black/40"
            title="Eliminar equipo"
            onClick={() => run("deleteTeam", { teamId: team.id }, `¿Eliminar el equipo "${team.name}" y todos sus integrantes?`)}
          >
            🗑️
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="chip bg-white text-night-950">🎁 {doneCount}/{total} ya sortearon</span>
          {total < 3 && <span className="chip bg-black/25">Mínimo 3 personas</span>}
        </div>
        <div className="mt-3 flex gap-1.5">
          {Object.keys(TEAM_STYLES).map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => run("updateTeam", { teamId: team.id, color: c })}
              className={`h-6 w-6 cursor-pointer rounded-full bg-gradient-to-br ${TEAM_STYLES[c as keyof typeof TEAM_STYLES].grad} ${team.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-black/30" : "opacity-70"}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* Integrantes */}
        <div>
          <h3 className="mb-2 font-semibold">Integrantes</h3>
          <ul className="divide-y divide-white/5 rounded-2xl bg-black/20">
            {team.participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="flex-1 font-medium">{p.name}</span>
                {p.locked && <span className="chip bg-santa/20 text-rose-300">🔒 Bloqueado</span>}
                {p.drawn ? (
                  <span className="chip bg-pine/20 text-emerald-300">✅ Ya tiene amigo secreto</span>
                ) : (
                  <span className="chip bg-white/10 text-white/55">⏳ Pendiente</span>
                )}
                <div className="flex gap-1">
                  {p.locked && (
                    <IconBtn title="Desbloquear" onClick={() => run("unlockParticipant", { participantId: p.id })}>🔓</IconBtn>
                  )}
                  {p.drawn && (
                    <IconBtn
                      title="Restablecer PIN"
                      onClick={() =>
                        run(
                          "resetParticipant",
                          { participantId: p.id },
                          `¿Restablecer el PIN de ${p.name}?\n\nPodrá volver a entrar, crear un PIN nuevo y le saldrá la MISMA persona. Nadie más se ve afectado.`,
                        )
                      }
                    >
                      🔑
                    </IconBtn>
                  )}
                  {!drawn && (
                    <IconBtn title="Quitar" onClick={() => run("removeParticipant", { participantId: p.id }, `¿Quitar a ${p.name}?`)}>✖️</IconBtn>
                  )}
                </div>
              </li>
            ))}
            {!total && <li className="px-3 py-4 text-sm text-white/50">Añade integrantes abajo 👇</li>}
          </ul>
          {!drawn && (
            <form
              className="mt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await run<{ added: number; skipped: number }>("addParticipants", { teamId: team.id, names });
                if (r) setNames("");
              }}
            >
              <textarea
                className="input min-h-20 text-sm"
                placeholder={"Un nombre por línea (o separados por comas)\nAna\nLuis\nMaría"}
                value={names}
                onChange={(e) => setNames(e.target.value)}
              />
              <button className="btn-pine mt-2 !py-2 text-sm" disabled={busy || !names.trim()}>➕ Añadir</button>
            </form>
          )}
        </div>

        {/* Opciones de sorteo */}
        <div>
          <h3 className="mb-2 font-semibold">Opciones de sorteo</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["cycle", "🔗 Cadena", "Todos en un solo círculo. Nadie se regala mutuamente."],
              ["free", "🎲 Libre", "Aleatorio clásico. Puede haber parejas que se regalen entre sí."],
            ] as const).map(([mode, title, desc]) => (
              <button
                key={mode}
                disabled={drawn || busy}
                onClick={() => run("updateTeam", { teamId: team.id, draw_mode: mode })}
                className={`cursor-pointer rounded-2xl border p-3 text-left text-sm transition disabled:cursor-not-allowed ${
                  team.draw_mode === mode ? "border-gold bg-gold/10" : "border-white/10 bg-black/20 hover:bg-white/5"
                } ${drawn && team.draw_mode !== mode ? "opacity-40" : ""}`}
              >
                <div className="font-semibold">{title}</div>
                <div className="text-white/60">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Exclusiones */}
        <div>
          <h3 className="mb-1 font-semibold">🚫 No pueden tocarse entre sí</h3>
          <p className="mb-2 text-xs text-white/50">Útil para parejas o para quienes ya se regalaron el año pasado.</p>
          <div className="flex flex-wrap gap-2">
            {team.exclusions.map((x) => (
              <span key={x.a_id + x.b_id} className="chip bg-santa/15 !py-1 text-rose-200">
                {byId.get(x.a_id)} ↔ {byId.get(x.b_id)}
                {!drawn && (
                  <button className="ml-1 cursor-pointer" onClick={() => run("removeExclusion", { teamId: team.id, a: x.a_id, b: x.b_id })} aria-label="Quitar">
                    ✖
                  </button>
                )}
              </span>
            ))}
            {!team.exclusions.length && <span className="text-sm text-white/40">Ninguna</span>}
          </div>
          {!drawn && total >= 2 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="input !w-auto flex-1 !py-2 text-sm" value={exA} onChange={(e) => setExA(e.target.value)}>
                <option value="">Persona…</option>
                {team.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="input !w-auto flex-1 !py-2 text-sm" value={exB} onChange={(e) => setExB(e.target.value)}>
                <option value="">…y persona</option>
                {team.participants.filter((p) => p.id !== exA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                className="btn-ghost !py-2 text-sm"
                disabled={!exA || !exB || busy}
                onClick={async () => { await run("addExclusion", { teamId: team.id, a: exA, b: exB }); setExA(""); setExB(""); }}
              >
                Añadir
              </button>
            </div>
          )}
        </div>

        {/* Acciones de sorteo */}
        <div className="border-t border-white/10 pt-5 text-sm text-white/60">
          {drawn ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex-1">🔒 La lista está fija porque ya empezaron a sortear.</span>
              <button
                className="btn-ghost !py-2 text-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    "resetTeamDraw",
                    { teamId: team.id },
                    `¿Reiniciar el sorteo de "${team.name}"?\n\n⚠️ Se borran TODOS los resultados de este equipo. Todos tendrán que volver a sortear y les puede salir otra persona.`,
                  )
                }
              >
                🔄 Reiniciar sorteo del equipo
              </button>
            </div>
          ) : (
            <p>🎲 El sorteo se hace solo: cuando la primera persona pulse “Sortear”, se reparten todos los amigos secretos del equipo.</p>
          )}
        </div>
        {error && <p className="rounded-xl bg-santa/15 p-3 text-sm text-rose-200">{error}</p>}
      </div>
    </section>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="cursor-pointer rounded-lg px-1.5 py-0.5 text-sm hover:bg-white/10">
      {children}
    </button>
  );
}

function NewTeam({ eventId }: { eventId: string }) {
  const { run, busy, error } = useAdminAction();
  const [name, setName] = useState("");
  const [color, setColor] = useState("gold");
  return (
    <form
      className="glass flex flex-col justify-center border-dashed p-6"
      onSubmit={async (e) => { e.preventDefault(); if (await run("createTeam", { eventId, name, color })) setName(""); }}
    >
      <h3 className="text-xl font-semibold">➕ Nuevo equipo</h3>
      <input className="input mt-4" placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mt-3 flex gap-2">
        {Object.entries(TEAM_STYLES).map(([c, st]) => (
          <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
            className={`h-8 w-8 cursor-pointer rounded-full bg-gradient-to-br ${st.grad} ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-night-900" : "opacity-60"}`} />
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <button className="btn-ghost mt-4" disabled={busy}>Crear equipo</button>
    </form>
  );
}

function EventSettings({ event }: { event: Event }) {
  const router = useRouter();
  const { run, busy, error } = useAdminAction();
  const [f, setF] = useState({
    name: event.name, budget: event.budget ?? "", exchange_date: event.exchange_date ?? "", message: event.message ?? "",
  });
  const [saved, setSaved] = useState(false);
  return (
    <section className="glass p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">⚙️ Ajustes del evento</h2>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => { e.preventDefault(); if (await run("updateEvent", { id: event.id, ...f })) { setSaved(true); setTimeout(() => setSaved(false), 1500); } }}
      >
        <div className="sm:col-span-2">
          <label className="label">Nombre</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Presupuesto</label>
          <input className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
        </div>
        <div>
          <label className="label">Fecha del intercambio</label>
          <input className="input" type="date" value={f.exchange_date} onChange={(e) => setF({ ...f, exchange_date: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Mensaje</label>
          <textarea className="input min-h-20" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className="btn-pine" disabled={busy}>{saved ? "✅ Guardado" : "Guardar cambios"}</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => run("updateEvent", { id: event.id, is_active: !event.is_active })}>
            {event.is_active ? "🙈 Ocultar evento" : "👁️ Publicar evento"}
          </button>
          <button
            type="button"
            className="btn-ghost ml-auto text-rose-300"
            disabled={busy}
            onClick={async () => {
              if (window.prompt(`Escribe "${event.slug}" para eliminar el evento y todo su contenido:`) !== event.slug) return;
              if ((await run("deleteEvent", { id: event.id })) !== undefined) router.push("/admin");
            }}
          >
            🗑️ Eliminar evento
          </button>
        </div>
        {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
      </form>
    </section>
  );
}
