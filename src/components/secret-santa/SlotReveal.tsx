"use client";
import { useEffect, useMemo, useState } from "react";

const ITEM_H = 88;

/**
 * Ruleta vertical tipo tragamonedas. El resultado ya viene decidido por el servidor;
 * esto solo es el espectáculo.
 */
export default function SlotReveal({ names, result, onDone }: { names: string[]; result: string; onDone: () => void }) {
  const reel = useMemo(() => {
    const pool = names.length ? names : [result];
    const out: string[] = [];
    for (let i = 0; i < 40; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
    out.push(result, pool[0], pool[Math.min(1, pool.length - 1)]);
    return out;
  }, [names, result]);
  const target = reel.length - 3;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setOffset(target * ITEM_H), 60);
    const t2 = setTimeout(onDone, 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [target, onDone]);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute inset-x-0 top-1/2 z-10 h-[88px] -translate-y-1/2 rounded-2xl border-4 border-gold shadow-[0_0_40px_rgba(255,201,60,0.6)]" />
      <div aria-hidden className="absolute -left-8 top-1/2 z-10 -translate-y-1/2 text-3xl">👉</div>
      <div aria-hidden className="absolute -right-8 top-1/2 z-10 -translate-y-1/2 text-3xl">👈</div>
      <div
        className="relative overflow-hidden rounded-3xl bg-night-950/70"
        style={{ height: ITEM_H * 3, maskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)" }}
      >
        <div
          style={{
            transform: `translateY(${ITEM_H - offset}px)`,
            transition: offset ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.2, 1)" : "none",
          }}
        >
          {reel.map((n, i) => (
            <div key={i} className="flex items-center justify-center px-4 text-center font-display text-4xl font-bold" style={{ height: ITEM_H }}>
              {n}
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Sorteando…</p>
    </div>
  );
}
