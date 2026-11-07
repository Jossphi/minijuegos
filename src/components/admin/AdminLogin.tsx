"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card animate-pop-in p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
        setBusy(false);
        if (res.ok) router.refresh();
        else setErr((await res.json().catch(() => ({}))).error ?? "Error");
      }}
    >
      <p className="eyebrow">Organizador</p>
      <h1 className="font-display mt-2 text-3xl text-ink">Panel de administración</h1>
      <p className="mt-1 text-muted">Solo para quien organiza los juegos.</p>
      <label className="label mt-6" htmlFor="pw">Contraseña</label>
      <input id="pw" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {err && <p className="mt-3 text-sm font-medium text-santa">{err}</p>}
      <button className="btn-primary mt-5 w-full" disabled={busy || !pw}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
