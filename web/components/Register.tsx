"use client";

import Link from "next/link";
import { useRef } from "react";
import type { TermView } from "@/lib/server/reads";
import { cellState, currentDay, partialGlyph, usd, MARK_WORDS, type CellState } from "@/lib/days";
import { simByName } from "@/lib/schools";

function Dots({ readings, passes, required, tone }: { readings: number; passes: number; required: number; tone: "live" | "pencil" }) {
  const n = Math.max(readings, required);
  return (
    <span className="flex items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: Math.min(n, 4) }).map((_, i) => {
        const has = i < readings;
        const ok = i < passes;
        const cls = !has
          ? "border border-rule-strong"
          : ok
            ? tone === "live"
              ? "bg-ink"
              : "bg-pencil"
            : "border border-red";
        return <span key={i} className={`block h-[6px] w-[6px] rounded-full ${cls}`} />;
      })}
    </span>
  );
}

function Glyph({ s, required, fresh }: { s: CellState; required: number; fresh: boolean }) {
  const anim = fresh ? " mark-new" : "";
  switch (s.kind) {
    case "Present":
      return <span className={`font-serif text-[19px] font-semibold text-ink${anim}`}>P</span>;
    case "Partial":
      return <span className={`font-serif text-[18px] font-semibold text-amber${anim}`}>{partialGlyph(s.passes, required)}</span>;
    case "Absent":
      return <span className={`font-serif text-[19px] font-semibold text-red${anim}`}>A</span>;
    case "Silent":
      return <span className={`font-serif text-[19px] font-semibold text-red${anim}`}>–</span>;
    case "Closed":
      return <span className={`font-serif text-[17px] font-semibold text-cloth${anim}`}>C</span>;
    case "Voided":
      return <span className={`font-serif text-[19px] font-semibold text-red line-through decoration-2${anim}`}>V</span>;
    case "today":
      return s.closed ? (
        <span className="font-serif text-[15px] text-cloth/70">C</span>
      ) : (
        <Dots readings={s.readings} passes={s.passes} required={required} tone="live" />
      );
    case "pending":
      if (s.closed) return <span className="font-serif text-[15px] text-pencil">C</span>;
      if (s.challenged || s.voided) return <span className="font-serif text-[15px] font-semibold text-red">?</span>;
      return <Dots readings={s.readings} passes={s.passes} required={required} tone="pencil" />;
    case "ended":
      return <span className="text-[13px] text-red/60">↩</span>;
    default:
      return null;
  }
}

function cellTitle(t: TermView, d: number, s: CellState): string {
  const head = `Day ${d + 1}`;
  if (s.kind in MARK_WORDS) {
    const r = "readings" in s ? ` (${s.passes} of ${s.readings} tests passed)` : "";
    return `${head}: ${MARK_WORDS[s.kind]}${r}`;
  }
  if (s.kind === "today") return `${head}, in progress: ${s.readings} test${s.readings === 1 ? "" : "s"} so far, ${s.passes} passing`;
  if (s.kind === "pending")
    return s.challenged
      ? `${head}: challenged by the funder, waiting for the arbiter`
      : `${head}: finished, waiting out the late and challenge windows before it settles`;
  if (s.kind === "ended") return `${head}: the funder ended the term early, so this day's money went back`;
  return `${head}: not started`;
}

export function RegisterRow({
  t,
  now,
  seen,
  dense,
  showMoney = true,
  linkLabel = true,
}: {
  t: TermView;
  now: number;
  seen?: Map<string, string>;
  dense?: boolean;
  showMoney?: boolean;
  linkLabel?: boolean;
}) {
  const sim = simByName(t.school);
  const today = currentDay(t, now);
  const size = dense ? "h-9 w-8" : "h-10 w-8";
  return (
    <tr className="group">
      <th
        scope="row"
        className="sticky left-0 z-10 min-w-[170px] max-w-[240px] border-b border-rule bg-sheet py-1.5 pr-3 text-left align-middle font-normal sm:min-w-[225px]"
      >
        {linkLabel ? (
          <Link href={`/term/${t.id}`} className="block rounded-sm hover:text-ink">
            <span className="block truncate font-serif text-[15px] font-semibold leading-tight">{t.school}</span>
            <span className="block truncate text-[12px] text-muted">
              {sim ? `${sim.place}, ${sim.provider}` : `AS${t.terms.asn}, term ${t.id}`}
            </span>
          </Link>
        ) : (
          <span className="block truncate font-serif text-[15px] font-semibold leading-tight">{t.school}</span>
        )}
      </th>
      {t.days.map((_, d) => {
        const s = cellState(t, d, now);
        const key = `${t.id}:${d}`;
        const prev = seen?.get(key);
        const fresh = !!prev && prev !== s.kind && s.kind in MARK_WORDS;
        seen?.set(key, s.kind);
        const isToday = d === today && !t.state.ended;
        const bg =
          s.kind === "Present"
            ? "bg-ink-wash/60"
            : s.kind === "Absent" || s.kind === "Silent" || s.kind === "Voided"
              ? "bg-red-wash/70"
              : s.kind === "Partial"
                ? "bg-amber-wash/70"
                : s.kind === "ended"
                  ? "bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(184,49,47,.08)_5px_7px)]"
                  : isToday
                    ? "bg-ink-wash"
                    : "";
        return (
          <td key={d} className={`border-b border-l border-rule p-0 text-center align-middle ${bg}`} title={cellTitle(t, d, s)}>
            <span className={`relative flex ${size} items-center justify-center`}>
              <Glyph s={s} required={t.terms.required} fresh={fresh} />
              {isToday && <span className="live-dot absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />}
            </span>
          </td>
        );
      })}
      {showMoney && (
        <>
          <td className="border-b border-l border-rule-strong px-3 text-right align-middle text-[14px] font-semibold text-ink tnum">
            {usd(t.state.paid, 0)}
          </td>
          <td className="border-b border-rule px-3 text-right align-middle text-[14px] font-semibold text-red tnum">
            {usd(t.state.refunded, 0)}
          </td>
        </>
      )}
    </tr>
  );
}

export function Register({
  terms,
  now,
  caption,
  dense,
}: {
  terms: TermView[];
  now: number;
  caption?: React.ReactNode;
  dense?: boolean;
}) {
  const seen = useRef(new Map<string, string>());
  const cols = Math.max(0, ...terms.map((t) => t.days.length));
  return (
    <div className="margin-line thin-scroll overflow-x-auto rounded-md border border-rule-strong shadow-[0_1px_0_rgba(28,34,43,.04),0_12px_32px_-18px_rgba(31,63,151,.35)]">
      <table className="w-max min-w-full border-separate border-spacing-0 pl-[56px] max-sm:pl-[22px]">
        {caption && <caption className="caption-bottom px-1 pt-3 pb-4 text-left text-[13px] text-muted">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-sheet py-2 pr-3 text-left align-bottom text-[12px] font-semibold text-muted">
              School
            </th>
            {Array.from({ length: cols }).map((_, d) => (
              <th key={d} scope="col" className="border-l border-rule pb-1.5 text-center align-bottom text-[11px] font-semibold text-muted tnum">
                {d + 1}
              </th>
            ))}
            <th scope="col" className="border-l border-rule-strong px-3 pb-1.5 text-right align-bottom text-[12px] font-semibold text-ink">
              Paid
            </th>
            <th scope="col" className="px-3 pb-1.5 text-right align-bottom text-[12px] font-semibold text-red">
              Returned
            </th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <RegisterRow key={t.id} t={t} now={now} seen={seen.current} dense={dense} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legend() {
  const item = (g: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-rule bg-sheet">{g}</span>
      <span>{label}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
      {item(<span className="font-serif text-[16px] font-semibold text-ink">P</span>, "paid in full")}
      {item(<span className="font-serif text-[15px] font-semibold text-amber">⅔</span>, "paid in part")}
      {item(<span className="font-serif text-[16px] font-semibold text-red">A</span>, "tests failed, refunded")}
      {item(<span className="font-serif text-[16px] font-semibold text-red">–</span>, "no test arrived, refunded")}
      {item(<span className="font-serif text-[15px] font-semibold text-cloth">C</span>, "closed by the school")}
      {item(<span className="font-serif text-[16px] font-semibold text-red line-through">V</span>, "challenge upheld")}
      {item(
        <span className="flex gap-[3px]">
          <span className="h-[6px] w-[6px] rounded-full bg-ink" />
          <span className="h-[6px] w-[6px] rounded-full border border-red" />
        </span>,
        "tests so far: passed, failed",
      )}
    </div>
  );
}
