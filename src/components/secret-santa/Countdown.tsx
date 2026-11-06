"use client";
import { useEffect, useState } from "react";

export default function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(`${date}T00:00:00`);
  const label = target.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const days = now === null ? null : Math.ceil((target.getTime() - now) / 86_400_000);
  return (
    <span className="chip bg-pine/15 !px-4 !py-2 !text-sm text-emerald-300">
      📅 {label}
      {days !== null && days > 0 && <b className="ml-1">· faltan {days} día{days === 1 ? "" : "s"}</b>}
      {days === 0 && <b className="ml-1">· ¡es hoy! 🎉</b>}
    </span>
  );
}
