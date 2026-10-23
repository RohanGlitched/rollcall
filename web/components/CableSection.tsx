"use client";

import { useEffect, useRef, useState } from "react";

// A cable cut open and seen end-on: 100 fibres for 100 village councils.
// Fibres in their colour code are laid (service ready); the ones that glow are working.
// Figures from CAG Report No. 19 of 2026: 96.7% service ready, 33.2% of those operational.
const CODE = ["#3d8bff", "#ff8a2a", "#2fcb74", "#c08a55", "#9fb2c2", "#f4f4f2", "#ff5a4f", "#1b1f22", "#ffd23f", "#a585ff", "#ff8fb8", "#34d1dd"];

function packed(n: number, r: number) {
  // sunflower packing inside a circle of radius r
  const pts: { x: number; y: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const rr = r * Math.sqrt((i + 0.5) / n);
    const th = i * golden;
    pts.push({ x: Math.round(rr * Math.cos(th) * 100) / 100, y: Math.round(rr * Math.sin(th) * 100) / 100 });
  }
  return pts;
}

export function CableSection({ size = 360 }: { size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const R = 150;
  const pts = packed(100, R - 16);
  // spread the 3 unlaid and the lit fibres evenly so the picture is not a pie chart
  const laid = new Set(Array.from({ length: 100 }, (_, i) => i).filter((i) => ![17, 52, 88].includes(i)));
  const litIdx = new Set<number>();
  [...laid].forEach((i, k) => {
    if (Math.floor(((k + 1) * 32.2) / 97) !== Math.floor((k * 32.2) / 97)) litIdx.add(i);
  });
  return (
    <svg ref={ref} viewBox="-170 -170 340 340" width={size} height={size} className="max-w-full" role="img" aria-label="Of 100 village council connections, 97 are laid and 32 are working.">
      <defs>
        <radialGradient id="jacket" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#1a2f3a" />
          <stop offset="100%" stopColor="#0a151b" />
        </radialGradient>
        <filter id="fglow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle r={R + 12} fill="#0c1a22" />
      <circle r={R + 12} fill="none" stroke="#2a4652" strokeWidth={2} />
      <circle r={R} fill="url(#jacket)" stroke="#1f3a46" strokeWidth={1.5} />
      {pts.map((p, i) => {
        const c = CODE[i % CODE.length];
        if (!laid.has(i)) return <circle key={i} cx={p.x} cy={p.y} r={6} fill="none" stroke="#33515d" strokeDasharray="2 2" />;
        const lit = litIdx.has(i);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={6.2} fill={c} opacity={lit && on ? 1 : 0.3} style={{ transition: `opacity 600ms ${lit ? (i % 33) * 35 : 0}ms` }} />
            {lit && (
              <circle
                cx={p.x}
                cy={p.y}
                r={2.6}
                fill="#ffffff"
                filter="url(#fglow)"
                opacity={on ? 1 : 0}
                style={{ transition: `opacity 700ms ${(i % 33) * 35 + 200}ms` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
