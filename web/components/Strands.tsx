"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TermView } from "@/lib/server/reads";
import { cellState, currentDay, usd, MARK_WORDS, partialGlyph, type CellState } from "@/lib/days";
import { simByName, fibreOf } from "@/lib/schools";

// One strand per term. Each school day is one length of fibre between two splice gaps.
//   paid in full   lit glass: the fibre's colour with a bright core and a soft glow
//   paid in part   lit for the paid share of the length, dark for the rest
//   tests failed   dark fibre with a red mark for each failed test
//   no test        the fibre is cut: two stubs with frayed red ends
//   closed         a grey splice sleeve over the length
//   voided         lit, then struck through in red
//   today          lit up to now as tests pass, with light running along it
//   not yet        a faint dotted strand

const H = 46;
const MID = 23;
const GAP = 3;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Tip = { x: number; y: number; title: string; body: string } | null;

function describe(t: TermView, d: number, s: CellState): { title: string; body: string } {
  const title = `Day ${d + 1}`;
  const rate = Number(t.terms.ratePerDay) / 1e6;
  if (s.kind in MARK_WORDS) {
    const passes = "passes" in s ? s.passes : 0;
    const readings = "readings" in s ? s.readings : 0;
    const paid = s.kind === "Present" ? rate : s.kind === "Partial" ? (rate * Math.min(passes, t.terms.required)) / t.terms.required : 0;
    return {
      title: `${title}: ${s.kind === "Partial" ? `paid ${partialGlyph(passes, t.terms.required)}` : s.kind}`,
      body: `${MARK_WORDS[s.kind]}. ${readings ? `${passes} of ${readings} tests passed. ` : ""}${paid.toFixed(2)} tUSD paid, ${(rate - paid).toFixed(2)} returned.`,
    };
  }
  if (s.kind === "today") return { title: `${title}: in progress`, body: s.closed ? "Closed by the school." : `${s.readings} test${s.readings === 1 ? "" : "s"} so far, ${s.passes} passing. Needs ${t.terms.required} for full pay.` };
  if (s.kind === "pending")
    return {
      title: `${title}: waiting to settle`,
      body: s.challenged ? "Challenged by the funder; waiting for the arbiter." : `${s.passes} of ${s.readings} tests passed. Settles after the late and challenge windows.`,
    };
  if (s.kind === "ended") return { title: `${title}: returned`, body: "The funder ended the term early, so this day's money went back." };
  return { title: `${title}: not started`, body: `Pays ${rate.toFixed(2)} tUSD if the line works.` };
}

function Segment({
  x0,
  x1,
  s,
  color,
  required,
  now01,
  fresh,
  onHover,
}: {
  x0: number;
  x1: number;
  s: CellState;
  color: string;
  required: number;
  now01: number; // how far through this segment "now" is (today only)
  fresh: boolean;
  onHover: (e: React.MouseEvent) => void;
}) {
  const len = x1 - x0;
  const dark = `${color}33`;
  const hit = <rect x={x0} y={0} width={len} height={H} fill="transparent" onMouseMove={onHover} />;
  const cls = fresh ? "seg-new" : undefined;
  const lit = (a: number, b: number, key?: string) => (
    <g key={key} className={cls}>
      <line x1={a} x2={b} y1={MID} y2={MID} stroke={color} strokeWidth={7} strokeLinecap="butt" filter="url(#glow)" />
      <line x1={a} x2={b} y1={MID} y2={MID} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1.6} />
    </g>
  );
  const unlit = (a: number, b: number) => <line x1={a} x2={b} y1={MID} y2={MID} stroke={dark} strokeWidth={7} />;
  const beads = (readings: number, passes: number, upTo = x1) => {
    const n = Math.max(readings, 0);
    const step = (upTo - x0) / (Math.max(required, n) + 1);
    return Array.from({ length: n }).map((_, i) => {
      const cx = x0 + step * (i + 1);
      return i < passes ? (
        <circle key={i} cx={cx} cy={MID} r={3.4} fill="#fff" stroke={color} strokeWidth={1.5} />
      ) : (
        <g key={i} stroke="#ff5a4f" strokeWidth={1.8} strokeLinecap="round">
          <line x1={cx - 3.5} y1={MID - 3.5} x2={cx + 3.5} y2={MID + 3.5} />
          <line x1={cx - 3.5} y1={MID + 3.5} x2={cx + 3.5} y2={MID - 3.5} />
        </g>
      );
    });
  };

  let body: React.ReactNode = null;
  switch (s.kind) {
    case "Present":
      body = lit(x0, x1);
      break;
    case "Partial": {
      const f = Math.min(s.passes, required) / required;
      body = (
        <>
          {unlit(x0, x1)}
          {lit(x0, x0 + len * f)}
        </>
      );
      break;
    }
    case "Absent":
      body = (
        <>
          {unlit(x0, x1)}
          {beads(s.readings, 0)}
        </>
      );
      break;
    case "Silent": {
      const a = x0 + len * 0.3;
      const b = x1 - len * 0.3;
      body = (
        <g className={cls}>
          <line x1={x0} x2={a} y1={MID} y2={MID} stroke={dark} strokeWidth={7} />
          <line x1={b} x2={x1} y1={MID} y2={MID} stroke={dark} strokeWidth={7} />
          <g stroke="#ff5a4f" strokeWidth={1.6} strokeLinecap="round">
            <line x1={a} y1={MID - 4} x2={a + 4} y2={MID - 8} />
            <line x1={a} y1={MID} x2={a + 5} y2={MID + 1} />
            <line x1={a} y1={MID + 4} x2={a + 4} y2={MID + 8} />
            <line x1={b} y1={MID - 4} x2={b - 4} y2={MID - 8} />
            <line x1={b} y1={MID} x2={b - 5} y2={MID - 1} />
            <line x1={b} y1={MID + 4} x2={b - 4} y2={MID + 8} />
          </g>
        </g>
      );
      break;
    }
    case "Closed":
      body = (
        <g className={cls}>
          {unlit(x0, x1)}
          <rect x={x0 + 1} y={MID - 8} width={len - 2} height={16} rx={6} fill="#5d6a66" stroke="#aab5b0" strokeWidth={1} />
          {len > 22 && (
            <text x={(x0 + x1) / 2} y={MID + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#e6ece9">
              shut
            </text>
          )}
        </g>
      );
      break;
    case "Voided":
      body = (
        <g className={cls}>
          {lit(x0, x1)}
          <line x1={x0 + 2} y1={MID + 9} x2={x1 - 2} y2={MID - 9} stroke="#ff5a4f" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      );
      break;
    case "today": {
      const xn = x0 + len * Math.max(0.04, Math.min(1, now01));
      body = s.closed ? (
        <>
          {unlit(x0, x1)}
          <rect x={x0 + 1} y={MID - 8} width={len - 2} height={16} rx={6} fill="#5d6a66" stroke="#aab5b0" />
        </>
      ) : (
        <>
          <line x1={x0} x2={x1} y1={MID} y2={MID} stroke={dark} strokeWidth={7} strokeDasharray="1 5" />
          {s.passes > 0 ? lit(x0, xn) : unlit(x0, xn)}
          {beads(s.readings, s.passes, xn)}
          <circle
            className="light-run"
            cx={x0}
            cy={MID}
            r={4}
            fill="#ffffff"
            style={{ ["--run" as string]: `${Math.max(8, xn - x0)}px`, filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </>
      );
      break;
    }
    case "pending":
      body = s.closed ? (
        <rect x={x0 + 1} y={MID - 8} width={len - 2} height={16} rx={6} fill="#5d6a66" stroke="#aab5b0" />
      ) : (
        <>
          {s.passes > 0 ? lit(x0, x0 + (len * Math.min(s.passes, required)) / required) : null}
          <line x1={x0} x2={x1} y1={MID} y2={MID} stroke={color} strokeOpacity={0.45} strokeWidth={7} strokeDasharray="3 3" />
          {beads(s.readings, s.passes)}
          {s.challenged && (
            <text x={x1 - 4} y={MID - 10} textAnchor="end" fontSize={11} fontWeight={800} fill="#ff5a4f">
              ?
            </text>
          )}
        </>
      );
      break;
    case "ended":
      body = <line x1={x0} x2={x1} y1={MID} y2={MID} stroke="#ff5a4f" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 4" />;
      break;
    default:
      body = <line x1={x0} x2={x1} y1={MID} y2={MID} stroke={color} strokeOpacity={0.28} strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" />;
  }
  return (
    <g>
      {body}
      {hit}
    </g>
  );
}

function StrandRow({
  t,
  now,
  width,
  seen,
  setTip,
}: {
  t: TermView;
  now: number;
  width: number;
  seen: Map<string, string>;
  setTip: (e: React.MouseEvent, info: { title: string; body: string }) => void;
}) {
  const color = fibreOf(t.school).hex;
  const n = t.days.length;
  const seg = width / n;
  const today = currentDay(t, now);
  return (
    <svg width={width} height={H} className="block overflow-visible" role="img" aria-label={`${t.school}: ${t.days.filter((d) => d.mark === "Present").length} days paid in full`}>
      {t.days.map((_, d) => {
        const s = cellState(t, d, now);
        const key = `${t.id}:${d}`;
        const prev = seen.get(key);
        const fresh = !!prev && prev !== s.kind && s.kind in MARK_WORDS;
        seen.set(key, s.kind);
        const x0 = d * seg + GAP / 2;
        const x1 = (d + 1) * seg - GAP / 2;
        const now01 = d === today ? (now - (t.terms.start + d * t.terms.dayLength)) / t.terms.dayLength : 0;
        return (
          <Segment
            key={d}
            x0={x0}
            x1={x1}
            s={s}
            color={color}
            required={t.terms.required}
            now01={now01}
            fresh={fresh}
            onHover={(e) => setTip(e, describe(t, d, s))}
          />
        );
      })}
    </svg>
  );
}

/**
 * The register, drawn as fibre. Rows share one clock, so the "now" line is common to all of them.
 * `tone` is "duct" on the dark hero and "light" on light pages.
 */
export function Strands({
  terms,
  now,
  tone = "duct",
  showMoney = true,
  linkRows = true,
}: {
  terms: TermView[];
  now: number;
  tone?: "duct" | "light";
  showMoney?: boolean;
  linkRows?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const seen = useRef(new Map<string, string>());
  const [tip, setTipState] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  const setTip = (e: React.MouseEvent, info: { title: string; body: string }) => {
    const c = box.current?.getBoundingClientRect();
    const row = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (!c || !row) return;
    setTipState({ x: Math.min(Math.max(e.clientX - c.left, 130), c.width - 130), y: row.top - c.top, ...info });
  };
  const t0 = terms[0];
  const n = Math.max(1, ...terms.map((t) => t.days.length));
  const day = t0 ? currentDay(t0, now) : -1;
  const nowFrac = t0 ? (now - t0.terms.start) / (t0.terms.dayLength * n) : -1;
  const dark = tone === "duct";
  const muted = dark ? "text-glass-muted" : "text-muted";
  const rule = dark ? "border-duct-line" : "border-line";

  useEffect(() => {
    const clear = () => setTipState(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, []);

  return (
    <div className="relative" ref={box} onMouseLeave={() => setTipState(null)}>
      {/* SVG filter shared by every lit length */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <filter id="glow" filterUnits="userSpaceOnUse" x="-200" y="-200" width="6000" height="600">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className={`grid grid-cols-1 gap-x-6 md:grid-cols-[minmax(170px,230px)_1fr_auto]`}>
        {/* header: day numbers and the now line label */}
        <div className="max-md:hidden" />
        <div className="relative h-7">
          <div ref={ref} className="absolute inset-x-0 bottom-0 h-full">
            {width > 0 &&
              Array.from({ length: n }).map((_, d) => {
                const show = n <= 12 || d % 2 === 0 || d === day;
                return (
                  show && (
                    <span
                      key={d}
                      className={`absolute bottom-1 -translate-x-1/2 text-[11px] tnum ${d === day ? (dark ? "font-bold text-glass" : "font-bold text-ink") : muted}`}
                      style={{ left: (d + 0.5) * (width / n) }}
                    >
                      {d + 1}
                    </span>
                  )
                );
              })}
          </div>
        </div>
        {showMoney ? (
          <div className={`flex items-end justify-end gap-4 pb-1 text-[11px] font-semibold max-md:hidden ${muted}`}>
            <span className="w-16 text-right">Paid</span>
            <span className="w-16 text-right">Returned</span>
          </div>
        ) : (
          <div className="max-md:hidden" />
        )}

        {terms.map((t) => {
          const sim = simByName(t.school);
          const f = fibreOf(t.school);
          const label = (
            <span className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.hex, boxShadow: `0 0 10px ${f.hex}` }} aria-hidden />
              <span className="min-w-0">
                <span className={`block truncate text-[14.5px] font-semibold leading-tight ${dark ? "text-glass" : "text-ink"}`}>{t.school}</span>
                <span className={`block truncate text-[12px] ${muted}`}>{sim ? `${sim.place}, ${sim.provider}` : `AS${t.terms.asn}, term ${t.id}`}</span>
              </span>
            </span>
          );
          return (
            <div key={t.id} className={`contents`}>
              <div className={`flex items-center border-t py-1 max-md:pt-3 ${rule}`}>
                {linkRows ? (
                  <Link href={`/term/${t.id}`} className="min-w-0 rounded-sm hover:opacity-80">
                    {label}
                  </Link>
                ) : (
                  label
                )}
                {showMoney && (
                  <span className="ml-auto flex gap-3 pl-3 text-[13px] font-semibold tnum md:hidden">
                    <span style={{ color: dark ? "#9cc2ff" : "var(--color-paid)" }}>{usd(t.state.paid, 0)}</span>
                    <span className="text-[#ff7a70]">{usd(t.state.refunded, 0)}</span>
                  </span>
                )}
              </div>
              <div className={`relative md:border-t ${rule}`}>{width > 0 && <StrandRow t={t} now={now} width={width} seen={seen.current} setTip={setTip} />}</div>
              {showMoney ? (
                <div className={`flex items-center justify-end gap-4 border-t text-[14px] font-semibold tnum max-md:hidden ${rule}`}>
                  <span className="w-16 text-right" style={{ color: dark ? "#9cc2ff" : "var(--color-paid)" }}>
                    {usd(t.state.paid, 0)}
                  </span>
                  <span className="w-16 text-right text-[#ff7a70]">{usd(t.state.refunded, 0)}</span>
                </div>
              ) : (
                <div className="max-md:hidden" />
              )}
            </div>
          );
        })}
      </div>

      {/* the now line across every strand */}
      {width > 0 && nowFrac > 0 && nowFrac < 1 && (
        <div className="pointer-events-none absolute inset-y-0 grid w-full grid-cols-1 gap-x-6 md:grid-cols-[minmax(170px,230px)_1fr_auto]" aria-hidden>
          <div className="max-md:hidden" />
          <div className="relative">
            <div className={`absolute top-6 bottom-0 w-px ${dark ? "bg-glass/50" : "bg-ink/40"}`} style={{ left: nowFrac * width }}>
              <span className={`absolute -top-[22px] -translate-x-1/2 rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${dark ? "bg-glass text-duct" : "bg-ink text-sheet"}`}>
                now
              </span>
            </div>
          </div>
          {showMoney && <div className="max-md:hidden w-[152px]" />}
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-30 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#0a141a]/95 px-3.5 py-2.5 text-[12.5px] leading-snug text-glass shadow-2xl"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <p className="font-semibold">{tip.title}</p>
          <p className="mt-0.5 text-glass-muted">{tip.body}</p>
        </div>
      )}
    </div>
  );
}

export function StrandLegend({ tone = "duct" }: { tone?: "duct" | "light" }) {
  const c = "#3d8bff";
  const dark = `${c}33`;
  const items: [React.ReactNode, string][] = [
    [
      <>
        <line x1={2} x2={38} y1={9} y2={9} stroke={c} strokeWidth={6} filter="url(#glow)" />
        <line x1={2} x2={38} y1={9} y2={9} stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} />
      </>,
      "lit: paid in full",
    ],
    [
      <>
        <line x1={2} x2={38} y1={9} y2={9} stroke={dark} strokeWidth={6} />
        <line x1={2} x2={16} y1={9} y2={9} stroke={c} strokeWidth={6} />
        <line x1={2} x2={16} y1={9} y2={9} stroke="#fff" strokeOpacity={0.85} strokeWidth={1.4} />
      </>,
      "part lit: paid in part",
    ],
    [
      <>
        <line x1={2} x2={38} y1={9} y2={9} stroke={dark} strokeWidth={6} />
        <g stroke="#ff5a4f" strokeWidth={1.7}>
          <line x1={17} y1={5.5} x2={24} y2={12.5} />
          <line x1={17} y1={12.5} x2={24} y2={5.5} />
        </g>
      </>,
      "dark: tests failed, refunded",
    ],
    [
      <>
        <line x1={2} x2={13} y1={9} y2={9} stroke={dark} strokeWidth={6} />
        <line x1={27} x2={38} y1={9} y2={9} stroke={dark} strokeWidth={6} />
        <g stroke="#ff5a4f" strokeWidth={1.5}>
          <line x1={13} y1={6} x2={16} y2={3} />
          <line x1={13} y1={12} x2={16} y2={15} />
          <line x1={27} y1={6} x2={24} y2={3} />
          <line x1={27} y1={12} x2={24} y2={15} />
        </g>
      </>,
      "cut: no test arrived, refunded",
    ],
    [<rect x={2} y={2} width={36} height={14} rx={6} fill="#5d6a66" stroke="#aab5b0" />, "sleeved: school closed, no strike"],
    [
      <>
        <line x1={2} x2={38} y1={9} y2={9} stroke={c} strokeWidth={6} />
        <line x1={4} y1={16} x2={36} y2={2} stroke="#ff5a4f" strokeWidth={2.2} />
      </>,
      "struck: challenge upheld",
    ],
  ];
  return (
    <ul className={`flex flex-wrap gap-x-6 gap-y-2.5 text-[12.5px] ${tone === "duct" ? "text-glass-muted" : "text-muted"}`}>
      {items.map(([g, l]) => (
        <li key={l} className="flex items-center gap-2">
          <svg width="40" height="18" aria-hidden>
            {g}
          </svg>
          {l}
        </li>
      ))}
    </ul>
  );
}
