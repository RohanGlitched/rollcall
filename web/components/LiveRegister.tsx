"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { TermView } from "@/lib/server/reads";
import { Strands, StrandLegend } from "./Strands";
import { SIM_SCHOOLS, REAL_PROBE_NAME } from "@/lib/schools";
import { currentDay, usd, ago } from "@/lib/days";

export type Overview = { terms: TermView[]; totals: { terms: number; trials: number }; at: number };

function usePoll(initial: Overview | null, everyMs = 15_000) {
  const [data, setData] = useState<Overview | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => initial?.at ?? Math.floor(Date.now() / 1000));
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/overview", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "The register could not be read.");
        if (!stop) {
          setData(j);
          setErr(null);
        }
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "The register could not be read.");
      }
    };
    const id = setInterval(load, everyMs);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const vis = () => !document.hidden && load();
    document.addEventListener("visibilitychange", vis);
    if (!initial) load();
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [everyMs, initial]);
  return { data, err, now };
}

type Ctx = { data: Overview | null; err: string | null; now: number };
const OverviewCtx = createContext<Ctx>({ data: null, err: null, now: 0 });

/** One poller for the whole page; every live block reads from it. */
export function OverviewProvider({ initial, children }: { initial: Overview | null; children: React.ReactNode }) {
  const v = usePoll(initial);
  return <OverviewCtx.Provider value={v}>{children}</OverviewCtx.Provider>;
}
export const useOverview = () => useContext(OverviewCtx);

export function simTerms(o: Overview | null) {
  if (!o) return [];
  return SIM_SCHOOLS.map((s) => o.terms.find((t) => t.school === s.name)).filter(Boolean) as TermView[];
}

export function LiveRegister() {
  const { data, err, now } = useOverview();
  const sims = simTerms(data);
  const t0 = sims[0];
  const day = t0 ? currentDay(t0, now) : -1;
  const nextIn = t0 ? t0.terms.start + (day + 1) * t0.terms.dayLength - now : 0;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[15px] text-glass">
          {t0 && day >= 0 && day < t0.terms.numDays ? (
            <>
              School day {day + 1} of {t0.terms.numDays} is running. It closes in <span className="font-semibold tnum">{ago(nextIn)}</span>.
            </>
          ) : t0 && day < 0 ? (
            <>The next term starts in {ago(t0.terms.start - now)}.</>
          ) : (
            "Reading the register from the chain…"
          )}
        </p>
        <p className="text-[13px] text-glass-muted">Six simulated schools on a fast clock: one school day lasts one hour. Every strand is read from the contract.</p>
      </div>
      {sims.length ? (
        <Strands terms={sims} now={now} tone="duct" />
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-xl border border-duct-line text-[15px] text-glass-muted">
          {err ?? "Reading the register from the chain…"}
        </div>
      )}
      <div className="mt-6">
        <StrandLegend />
      </div>
      {err && sims.length > 0 && <p className="mt-3 text-[13px] text-[#ff7a70]">Live updates paused: {err}</p>}
    </div>
  );
}

export function MoneyStrip() {
  const { data } = useOverview();
  const terms = data?.terms ?? [];
  const sum = (f: (t: TermView) => string) => terms.reduce((a, t) => a + Number(f(t)), 0);
  const items = [
    { label: "Locked for days still to come", v: sum((t) => t.state.escrow), c: "#eaf2f0" },
    { label: "Paid to providers for working days", v: sum((t) => t.state.paid), c: "#9cc2ff" },
    { label: "Returned to funders for failed days", v: sum((t) => t.state.refunded), c: "#ff8a80" },
    { label: "Provider bonds held", v: sum((t) => t.state.bondHeld), c: "#8fe0b0" },
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="border-l border-duct-line pl-5">
            <dt className="text-[13px] text-glass-muted">{i.label}</dt>
            <dd className="mt-2 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tnum sm:text-[44px]" style={{ color: i.c }}>
              {data ? usd(i.v, 0) : "—"}
              <span className="ml-2 font-sans text-[13px] font-medium tracking-normal text-glass-muted">tUSD</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[12px] text-glass-muted">
        Across the terms on this page{data ? `, out of ${data.totals.terms} opened on chain so far (${data.totals.trials} by visitors)` : ""}. Test dollars, no real value.
      </p>
    </div>
  );
}

export function VisitorTerms() {
  const { data, now } = useOverview();
  const trials = (data?.terms ?? []).filter((t) => t.kind === "trial").slice(0, 5);
  if (!trials.length)
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-[15px] text-muted">
        No visitor has opened a term yet.{" "}
        <Link href="/test" className="font-semibold text-ink underline underline-offset-4">
          Be the first school
        </Link>
        .
      </p>
    );
  return (
    <div className="duct rounded-2xl p-5 sm:p-7">
      <Strands terms={trials} now={now} tone="duct" />
    </div>
  );
}

export function ProbeZeroRow() {
  const { data, now } = useOverview();
  const t = data?.terms.find((x) => x.school === REAL_PROBE_NAME);
  if (!t)
    return <p className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-[15px] text-muted">Probe 0’s term starts at midnight IST.</p>;
  const shown = { ...t, days: t.days.slice(0, Math.min(t.days.length, Math.max(14, currentDay(t, now) + 4))) };
  return (
    <div className="duct rounded-2xl p-5 sm:p-7">
      <Strands terms={[shown]} now={now} tone="duct" />
    </div>
  );
}
