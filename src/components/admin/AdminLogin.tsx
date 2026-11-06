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
      className="glass animate-pop-in p-8 text-center"
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
      <div className="text-5xl">🧝</div>
      <h1 className="mt-2 font-display text-4xl font-bold">Taller del organizador</h1>
      <p className="mt-1 text-white/60">Solo para quien organiza los juegos.</p>
      <input className="input mt-6 text-center" type="password" placeholder="Contraseña de admin" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
      <button className="btn-santa mt-5 w-full" disabled={busy || !pw}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
