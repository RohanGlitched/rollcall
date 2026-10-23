"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TermView } from "@/lib/server/reads";
import { Strands, StrandLegend } from "@/components/Strands";
import { usd } from "@/lib/days";

export function ReplayClient({ initial }: { initial: { terms: TermView[]; at: number } | null }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(initial?.at ?? Math.floor(Date.now() / 1000));
  useEffect(() => {
    const load = () =>
      !document.hidden &&
      fetch("/api/replay", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => j.terms && setData(j))
        .catch(() => {});
    const a = setInterval(load, 4000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 500);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  const terms = data?.terms ?? [];
  if (!terms.length) return <p className="text-[15px] text-glass-muted">No replay has run yet.</p>;
  const t0 = terms[0].terms;
  const day = Math.floor((now - t0.start) / t0.dayLength);
  const running = terms.some((t) => !t.state.ended);
  const sum = (f: (t: TermView) => string) => terms.reduce((a, t) => a + Number(f(t)), 0);
  return (
    <div>
      <p className="mb-5 text-[15px] text-glass">
        {now < t0.start
          ? `The replay starts in ${t0.start - now} seconds.`
          : running && day < t0.numDays
            ? `School day ${day + 1} of ${t0.numDays}. A day lasts one minute.`
            : running
              ? "The last days are settling."
              : `Finished. Ran ${new Date(t0.start * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST.`}
      </p>
      <Strands terms={terms} now={now} tone="duct" />
      <div className="mt-6">
        <StrandLegend />
      </div>
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
        {[
          ["Paid for working days", sum((t) => t.state.paid), "#9cc2ff"],
          ["Returned to funders", sum((t) => t.state.refunded), "#ff8a80"],
          ["Bonds cut", sum((t) => t.state.slashed), "#ffd23f"],
          ["Still locked", sum((t) => t.state.escrow), "#eaf2f0"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="border-l border-duct-line pl-5">
            <dt className="text-[13px] text-glass-muted">{l}</dt>
            <dd className="mt-2 font-display text-[36px] leading-none font-bold tracking-[-0.03em] tnum" style={{ color: c as string }}>
              {usd(v as number, 0)} <span className="font-sans text-[13px] font-medium tracking-normal text-glass-muted">tUSD</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-[13.5px] text-glass-muted">
        Terms{" "}
        {terms.map((t, i) => (
          <span key={t.id}>
            <Link className="underline" href={`/term/${t.id}`}>
              {t.id}
            </Link>
            {i < terms.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        on the same contract as everything else.
      </p>
    </div>
  );
}
