"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAction } from "./useAdmin";

type Ev = { id: string; slug: string; name: string; is_active: boolean; teams: number; people: number; drawn: number };

export default function AdminHome({ events }: { events: Ev[] }) {
  const router = useRouter();
  const { run, busy, error } = useAdminAction();
  const [form, setForm] = useState({ name: "", budget: "", exchange_date: "", message: "" });
  const [withTeams, setWithTeams] = useState(true);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = await run<{ id: string; slug: string }>("createEvent", form);
    if (!ev) return;
    if (withTeams) {
      await run("createTeam", { eventId: ev.id, name: "Equipo Rojo", color: "red" });
      await run("createTeam", { eventId: ev.id, name: "Equipo Verde", color: "green" });
    }
    router.push(`/admin/${ev.slug}`);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Organizador</p>
          <h1 className="font-display mt-1 text-3xl text-ink sm:text-4xl">Tus sorteos</h1>
        </div>
        <button className="btn-ghost" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.refresh(); }}>
          Cerrar sesión
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {events.map((e) => {
          const pct = e.people ? Math.round((e.drawn / e.people) * 100) : 0;
          return (
            <Link key={e.id} href={`/admin/${e.slug}`} className="card block p-6 transition hover:-translate-y-0.5 hover:border-stone-300">
              <div className="flex items-start justify-between gap-2">
                <div className="text-lg font-bold text-ink">{e.name}</div>
                <span className={`chip ${e.is_active ? "bg-pine-soft text-pine" : "bg-stone-100 text-muted"}`}>{e.is_active ? "Activo" : "Oculto"}</span>
              </div>
              <div className="mt-0.5 text-sm text-muted">/amigo-secreto/{e.slug}</div>
              <div className="mt-5 flex items-baseline justify-between text-sm">
                <span className="text-muted">{e.teams} equipos · {e.people} personas</span>
                <span className="font-semibold text-ink">{e.drawn}/{e.people} sortearon</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
        {!events.length && <div className="card p-6 text-muted sm:col-span-2">Todavía no hay sorteos. Crea el primero abajo.</div>}
      </section>

      <form onSubmit={create} className="card p-6 sm:p-8">
        <h2 className="text-xl font-bold text-ink">Nuevo Amigo Secreto</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nombre del evento</label>
            <input className="input" required placeholder="Navidad 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Presupuesto</label>
            <input className="input" placeholder="S/ 50" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div>
            <label className="label">Fecha del intercambio</label>
            <input className="input" type="date" value={form.exchange_date} onChange={(e) => setForm({ ...form, exchange_date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mensaje para los participantes</label>
            <textarea className="input min-h-20" placeholder="¡Nos vemos en la cena navideña!" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-ink sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[#c8102e]" checked={withTeams} onChange={(e) => setWithTeams(e.target.checked)} />
            Crear dos equipos para empezar (Rojo y Verde)
          </label>
        </div>
        {error && <p className="mt-4 text-sm font-medium text-santa">{error}</p>}
        <button className="btn-primary mt-6" disabled={busy}>Crear sorteo</button>
      </form>
    </div>
  );
}
