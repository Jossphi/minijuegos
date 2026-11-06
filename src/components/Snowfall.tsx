"use client";
import { useEffect, useRef } from "react";

/** Nieve ligera en canvas (se pausa si el usuario prefiere menos movimiento). */
export default function Snowfall() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 0, h = 0, raf = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth * devicePixelRatio;
      h = canvas.height = window.innerHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    const count = Math.min(140, Math.floor(window.innerWidth / 9));
    const flakes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 2.4 + 0.8) * devicePixelRatio,
      s: (Math.random() * 0.6 + 0.3) * devicePixelRatio,
      d: Math.random() * Math.PI * 2,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (const f of flakes) {
        f.y += f.s;
        f.d += 0.01;
        f.x += Math.sin(f.d) * 0.4 * devicePixelRatio;
        if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70" />;
}
