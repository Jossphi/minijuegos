"use client";
import { useEffect, useMemo, useState } from "react";

const ITEM_H = 72;

/** Ruleta vertical. El resultado ya viene decidido por el servidor; esto solo es el espectáculo. */
export default function SlotReveal({ names, result, onDone }: { names: string[]; result: string; onDone: () => void }) {
  const reel = useMemo(() => {
    const pool = names.length ? names : [result];
    const out: string[] = [];
    for (let i = 0; i < 36; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
    out.push(result, pool[0], pool[Math.min(1, pool.length - 1)]);
    return out;
  }, [names, result]);
  const target = reel.length - 3;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setOffset(target * ITEM_H), 60);
    const t2 = setTimeout(onDone, 4300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [target, onDone]);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-[72px] -translate-y-1/2 rounded-xl border-2 border-santa bg-santa-soft/40" />
      <div
        className="relative overflow-hidden rounded-2xl bg-paper"
        style={{ height: ITEM_H * 3, maskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)" }}
      >
        <div
          style={{
            transform: `translateY(${ITEM_H - offset}px)`,
            transition: offset ? "transform 3.9s cubic-bezier(0.12, 0.8, 0.2, 1)" : "none",
          }}
        >
          {reel.map((n, i) => (
            <div key={i} className="flex items-center justify-center px-4 text-center text-2xl font-bold text-ink sm:text-3xl" style={{ height: ITEM_H }}>
              {n}
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Sorteando…</p>
    </div>
  );
}
