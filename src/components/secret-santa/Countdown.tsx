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
  const raw = target.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  const days = now === null ? null : Math.ceil((target.getTime() - now) / 86_400_000);
  return (
    <span className="chip flex-wrap justify-center border border-line bg-white !px-3 !py-1.5 text-center !text-sm text-ink">
      <span>📅 {label}</span>
      {days !== null && days > 0 && <span className="font-bold text-pine">· faltan {days} día{days === 1 ? "" : "s"}</span>}
      {days === 0 && <span className="font-bold text-santa">· ¡es hoy!</span>}
    </span>
  );
}
