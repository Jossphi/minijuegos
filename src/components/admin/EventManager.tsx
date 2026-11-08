"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TEAM_STYLES, teamStyle } from "@/components/ui";
import { useAdminAction } from "./useAdmin";

type Event = {
  id: string; slug: string; name: string; budget: string | null;
  exchange_date: string | null; message: string | null; is_active: boolean; draw_open: boolean;
};
type P = { id: string; name: string; drawn: boolean; locked: boolean; attendance: "yes" | "no" | null };
type Team = {
  id: string; name: string; color: string; draw_mode: "cycle" | "free";
  drawn_at: string | null; participants: P[]; exclusions: { a_id: string; b_id: string }[];
};

export default function EventManager({ event, teams }: { event: Event; teams: Team[] }) {
  const total = teams.reduce((n, t) => n + t.participants.length, 0);
  const drawn = teams.reduce((n, t) => n + t.participants.filter((p) => p.drawn).length, 0);
  const pct = total ? Math.round((drawn / total) * 100) : 0;
  const all = teams.flatMap((t) => t.participants);
  const yes = all.filter((p) => p.attendance === "yes").length;
  const no = all.filter((p) => p.attendance === "no").length;
  const pending = all.length - yes - no;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Gestionar sorteo</p>
        <h1 className="font-display mt-1 text-3xl text-ink sm:text-4xl">{event.name}</h1>
      </div>

      <DrawToggle event={event} />

      {/* Asistencia */}
      <section className="card p-6">
        <div className="text-sm font-medium text-muted">Confirmación de asistencia al compartir</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-pine-soft p-4">
            <div className="text-3xl font-extrabold text-pine">{yes}</div>
            <div className="text-xs font-semibold text-pine">Confirmados</div>
          </div>
          <div className="rounded-xl bg-santa-soft p-4">
            <div className="text-3xl font-extrabold text-santa">{no}</div>
            <div className="text-xs font-semibold text-santa">No asistirán</div>
          </div>
          <div className="rounded-xl bg-stone-100 p-4">
            <div className="text-3xl font-extrabold text-ink">{pending}</div>
            <div className="text-xs font-semibold text-muted">Sin responder</div>
          </div>
        </div>
        {no > 0 && (
          <p className="mt-4 rounded-xl border border-line px-4 py-3 text-xs text-muted">
            Quienes respondieron “no asistiré” no pueden sortear. Si su equipo aún no empezó a sortear, quítalos de la lista para
            que nadie les regale. Si ya empezó, usa “Reiniciar este equipo”, quítalos y vuelvan a sortear.
          </p>
        )}
      </section>

      {/* Progreso */}
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-muted">Ya tienen amigo secreto</div>
            <div className="mt-1 text-4xl font-extrabold text-ink">
              {drawn} <span className="text-xl font-semibold text-muted">de {total}</span>
            </div>
          </div>
          <div className="text-sm font-medium text-muted">
            {total - drawn > 0 ? `Faltan ${total - drawn}` : total ? "🎉 ¡Todos ya sortearon!" : "Añade participantes abajo"}
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ResetDraws eventId={event.id} disabled={!teams.some((t) => t.drawn_at)} />
      </section>

      <ShareLink slug={event.slug} />

      <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
        🔒 Los resultados se guardan cifrados: aquí solo ves <b className="text-ink">quién ya sorteó</b>, nunca a quién le tocó. Carga la lista
        completa antes de compartir el enlace; cuando alguien sortea, la lista de su equipo queda fija.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {teams.map((t) => <TeamPanel key={t.id} team={t} />)}
        <NewTeam eventId={event.id} />
      </div>

      <EventSettings event={event} />
    </div>
  );
}

function DrawToggle({ event }: { event: Event }) {
  const { run, busy, error } = useAdminAction();
  const open = event.draw_open;
  return (
    <section className={`card flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${open ? "" : "!border-amber-300"}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 font-bold text-ink">
          <span className={`h-2.5 w-2.5 rounded-full ${open ? "bg-pine" : "bg-amber-500"}`} />
          {open ? "Sorteo abierto" : "Sorteo cerrado · solo confirmaciones"}
        </div>
        <p className="mt-1 text-sm text-muted">
          {open
            ? "Quienes confirman su asistencia pueden sortear de inmediato."
            : "Los participantes solo confirman si asistirán. Cuando tengas la lista definitiva (quita a quienes no van), abre el sorteo."}
        </p>
        {error && <p className="mt-2 text-sm font-medium text-santa">{error}</p>}
      </div>
      <button
        className={open ? "btn-secondary" : "btn-green"}
        disabled={busy}
        onClick={() =>
          run(
            "updateEvent",
            { id: event.id, draw_open: !open },
            open
              ? "¿Cerrar el sorteo?\n\nLos participantes podrán confirmar su asistencia pero no sortear. Quienes ya sortearon siguen viendo su resultado."
              : "¿Abrir el sorteo?\n\nQuienes confirmaron su asistencia podrán sortear desde ahora.",
          )
        }
      >
        {open ? "Cerrar sorteo" : "🎲 Abrir sorteo"}
      </button>
    </section>
  );
}

function ResetDraws({ eventId, disabled }: { eventId: string; disabled: boolean }) {
  const { run, busy, error } = useAdminAction();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <p className="flex-1 text-xs text-muted">
        Borra los resultados de <b>todos</b> los equipos para volver a sortear desde cero. La lista de participantes se mantiene.
      </p>
      <button
        className="btn-secondary !py-2 text-sm !text-santa"
        disabled={busy || disabled}
        title={disabled ? "Todavía nadie ha sorteado" : ""}
        onClick={() => {
          const ok = window.prompt(
            "⚠️ Esto borra TODOS los sorteos de este evento.\n\nLos participantes NO se borran, pero todos tendrán que volver a sortear (con un PIN nuevo) y les puede salir otra persona.\n\nEscribe LIMPIAR para confirmar:",
          );
          if (ok?.trim().toUpperCase() === "LIMPIAR") run("resetEventDraws", { eventId });
        }}
      >
        🧹 Limpiar sorteos
      </button>
      {error && <p className="w-full text-sm font-medium text-santa">{error}</p>}
    </div>
  );
}

function ShareLink({ slug }: { slug: string }) {
  const [url, setUrl] = useState(`/amigo-secreto/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/amigo-secreto/${slug}`), [slug]);
  return (
    <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-muted">Enlace para los participantes</div>
        <div className="mt-1 truncate font-mono text-sm text-ink">{url}</div>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary !py-2.5 text-sm" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
        <a className="btn-green !py-2.5 text-sm" href={`https://wa.me/?text=${encodeURIComponent(`🎁 ¡Únete al Amigo Secreto! ${url}`)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </section>
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
    <section className="card overflow-hidden">
      <div className={`h-1.5 ${s.dot}`} />
      <div className="border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); await run("updateTeam", { teamId: team.id, name: tName }); setEditing(false); }}>
              <input className="input !py-2" value={tName} onChange={(e) => setTName(e.target.value)} autoFocus />
              <button className="btn-primary !py-2">OK</button>
            </form>
          ) : (
            <button className="cursor-pointer text-left" onClick={() => setEditing(true)} title="Renombrar">
              <div className="flex items-center gap-2 text-xl font-bold text-ink">
                <span className={`h-3 w-3 rounded-full ${s.dot}`} />
                {team.name}
              </div>
            </button>
          )}
          <button
            className="btn-ghost !px-2 !py-1 text-sm"
            title="Eliminar equipo"
            onClick={() => run("deleteTeam", { teamId: team.id }, `¿Eliminar el equipo "${team.name}" y todos sus integrantes?`)}
          >
            Eliminar
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`chip ${s.soft} ${s.text}`}>{doneCount}/{total} ya sortearon</span>
          {total < 3 && <span className="chip bg-stone-100 text-muted">Mínimo 3 personas</span>}
          <div className="ml-auto flex gap-1.5">
            {Object.entries(TEAM_STYLES).map(([c, st]) => (
              <button
                key={c}
                aria-label={`Color ${st.label}`}
                title={st.label}
                onClick={() => run("updateTeam", { teamId: team.id, color: c })}
                className={`h-5 w-5 cursor-pointer rounded-full ${st.dot} ${team.color === c ? "ring-2 ring-stone-900 ring-offset-2" : "opacity-40 hover:opacity-80"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Integrantes</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {team.participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="flex-1 text-sm font-medium text-ink">{p.name}</span>
                {p.locked && <span className="chip bg-santa-soft text-santa">Bloqueado</span>}
                {p.attendance === "yes" ? (
                  <span className="chip bg-pine-soft text-pine">Asistirá</span>
                ) : p.attendance === "no" ? (
                  <span className="chip bg-santa-soft text-santa">No asistirá</span>
                ) : (
                  <span className="chip bg-stone-100 text-muted">Sin responder</span>
                )}
                {p.drawn ? (
                  <span className="chip bg-pine-soft text-pine">✓ Sorteó</span>
                ) : (
                  <span className="chip bg-stone-100 text-muted">Sin sortear</span>
                )}
                <div className="flex gap-0.5">
                  {p.attendance && !p.drawn && (
                    <IconBtn
                      title="Volver a preguntar asistencia"
                      onClick={() => run("resetAttendance", { participantId: p.id }, `¿Borrar la respuesta de asistencia de ${p.name}?\n\nSe le volverá a preguntar la próxima vez que entre.`)}
                    >
                      ↺
                    </IconBtn>
                  )}
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
                    <IconBtn title="Quitar" onClick={() => run("removeParticipant", { participantId: p.id }, `¿Quitar a ${p.name}?`)}>✕</IconBtn>
                  )}
                </div>
              </li>
            ))}
            {!total && <li className="px-3 py-4 text-sm text-muted">Añade integrantes abajo.</li>}
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
              <button className="btn-green mt-2 !py-2 text-sm" disabled={busy || !names.trim()}>+ Añadir</button>
            </form>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Modo de sorteo</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["cycle", "Cadena", "Un solo círculo. Nadie se regala mutuamente."],
              ["free", "Libre", "Aleatorio clásico. Puede haber regalos mutuos."],
            ] as const).map(([mode, title, desc]) => (
              <button
                key={mode}
                disabled={drawn || busy}
                onClick={() => run("updateTeam", { teamId: team.id, draw_mode: mode })}
                className={`cursor-pointer rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed ${
                  team.draw_mode === mode ? "border-ink bg-paper" : "border-line hover:border-stone-300"
                } ${drawn && team.draw_mode !== mode ? "opacity-40" : ""}`}
              >
                <div className="font-semibold text-ink">{team.draw_mode === mode ? "● " : "○ "}{title}</div>
                <div className="mt-0.5 text-muted">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">No pueden tocarse entre sí</h3>
          <p className="mb-2 text-xs text-muted">Útil para parejas o para quienes ya se regalaron el año pasado.</p>
          <div className="flex flex-wrap gap-2">
            {team.exclusions.map((x) => (
              <span key={x.a_id + x.b_id} className="chip bg-stone-100 text-ink">
                {byId.get(x.a_id)} ↔ {byId.get(x.b_id)}
                {!drawn && (
                  <button className="ml-1 cursor-pointer text-muted hover:text-santa" onClick={() => run("removeExclusion", { teamId: team.id, a: x.a_id, b: x.b_id })} aria-label="Quitar">
                    ✕
                  </button>
                )}
              </span>
            ))}
            {!team.exclusions.length && <span className="text-sm text-muted">Ninguna</span>}
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
                className="btn-secondary !py-2 text-sm"
                disabled={!exA || !exB || busy}
                onClick={async () => { await run("addExclusion", { teamId: team.id, a: exA, b: exB }); setExA(""); setExB(""); }}
              >
                Añadir
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-4 text-sm text-muted">
          {drawn ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex-1">🔒 La lista está fija porque ya empezaron a sortear.</span>
              <button
                className="btn-secondary !py-2 text-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    "resetTeamDraw",
                    { teamId: team.id },
                    `¿Reiniciar el sorteo de "${team.name}"?\n\n⚠️ Se borran TODOS los resultados de este equipo. Todos tendrán que volver a sortear y les puede salir otra persona.`,
                  )
                }
              >
                Reiniciar este equipo
              </button>
            </div>
          ) : (
            <p>El sorteo se hace solo: cuando la primera persona pulse “Sortear”, se reparten los amigos secretos del equipo.</p>
          )}
        </div>
        {error && <p className="rounded-xl bg-santa-soft p-3 text-sm font-medium text-santa">{error}</p>}
      </div>
    </section>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="cursor-pointer rounded-lg px-1.5 py-0.5 text-sm text-muted hover:bg-stone-100 hover:text-ink">
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
      className="flex flex-col justify-center rounded-2xl border-2 border-dashed border-line p-6"
      onSubmit={async (e) => { e.preventDefault(); if (await run("createTeam", { eventId, name, color })) setName(""); }}
    >
      <h3 className="font-bold text-ink">Nuevo equipo</h3>
      <input className="input mt-3" placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="mt-3 flex gap-2">
        {Object.entries(TEAM_STYLES).map(([c, st]) => (
          <button type="button" key={c} onClick={() => setColor(c)} aria-label={st.label} title={st.label}
            className={`h-6 w-6 cursor-pointer rounded-full ${st.dot} ${color === c ? "ring-2 ring-stone-900 ring-offset-2" : "opacity-40 hover:opacity-80"}`} />
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-santa">{error}</p>}
      <button className="btn-secondary mt-4" disabled={busy}>Crear equipo</button>
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
    <section className="card p-6 sm:p-8">
      <h2 className="text-xl font-bold text-ink">Ajustes del evento</h2>
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
          <input className="input" placeholder="S/ 50" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
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
          <button className="btn-primary" disabled={busy}>{saved ? "✓ Guardado" : "Guardar cambios"}</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run("updateEvent", { id: event.id, is_active: !event.is_active })}>
            {event.is_active ? "Ocultar evento" : "Publicar evento"}
          </button>
          <button
            type="button"
            className="btn-ghost ml-auto !text-santa"
            disabled={busy}
            onClick={async () => {
              if (window.prompt(`Escribe "${event.slug}" para eliminar el evento y todo su contenido:`) !== event.slug) return;
              if ((await run("deleteEvent", { id: event.id })) !== undefined) router.push("/admin");
            }}
          >
            Eliminar evento
          </button>
        </div>
        {error && <p className="text-sm font-medium text-santa sm:col-span-2">{error}</p>}
      </form>
    </section>
  );
}
