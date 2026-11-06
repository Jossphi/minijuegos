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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-bold"><span className="text-shine">Taller del organizador</span></h1>
          <p className="text-white/60">Crea y gestiona los sorteos de Amigo Secreto.</p>
        </div>
        <button
          className="btn-ghost"
          onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.refresh(); }}
        >
          Cerrar sesión
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {events.map((e) => (
          <Link key={e.id} href={`/admin/${e.slug}`} className="glass block p-6 transition hover:-translate-y-0.5 hover:bg-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xl font-semibold">{e.name}</div>
              <span className={`chip ${e.is_active ? "bg-pine/20 text-emerald-300" : "bg-white/10 text-white/50"}`}>
                {e.is_active ? "Activo" : "Oculto"}
              </span>
            </div>
            <div className="mt-1 text-sm text-white/50">/amigo-secreto/{e.slug}</div>
            <div className="mt-4 flex gap-4 text-sm text-white/75">
              <span>👥 {e.teams} equipos</span>
              <span>🎅 {e.people} personas</span>
              <span>🎁 {e.drawn} ya sortearon</span>
            </div>
          </Link>
        ))}
        {!events.length && <div className="glass p-6 text-white/60 sm:col-span-2">Todavía no hay sorteos. ¡Crea el primero abajo! 👇</div>}
      </section>

      <form onSubmit={create} className="glass p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">➕ Nuevo Amigo Secreto</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nombre del evento</label>
            <input className="input" required placeholder="Navidad 2026 🎄" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="h-5 w-5 accent-[#ffc93c]" checked={withTeams} onChange={(e) => setWithTeams(e.target.checked)} />
            Crear dos equipos para empezar (Rojo 🎅 y Verde 🎄)
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        <button className="btn-santa mt-6" disabled={busy}>Crear sorteo 🎁</button>
      </form>
    </div>
  );
}
