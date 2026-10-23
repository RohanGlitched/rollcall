"use client";

import { useState } from "react";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** What a funder pays under a flat monthly contract versus paying by the working school day. */
export function FunderCalculator() {
  const [schools, setSchools] = useState(1000);
  const [monthly, setMonthly] = useState(30);
  const [works, setWorks] = useState(70);
  const schoolDays = 200;
  const flat = schools * monthly * 12;
  const perDay = (monthly * 12) / schoolDays;
  const rollcall = schools * schoolDays * (works / 100) * perDay;
  const back = flat - rollcall;
  const field = "w-full accent-[#1d5fd0]";
  return (
    <div className="grid gap-8 rounded-2xl border border-line bg-sheet p-6 sm:p-8 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <label className="block">
          <span className="flex justify-between text-[14px] font-semibold">
            Schools in the contract <span className="tnum">{fmt(schools)}</span>
          </span>
          <input className={field} type="range" min={10} max={20000} step={10} value={schools} onChange={(e) => setSchools(+e.target.value)} />
        </label>
        <label className="block">
          <span className="flex justify-between text-[14px] font-semibold">
            Price per school per month <span className="tnum">${fmt(monthly)}</span>
          </span>
          <input className={field} type="range" min={5} max={300} step={5} value={monthly} onChange={(e) => setMonthly(+e.target.value)} />
        </label>
        <label className="block">
          <span className="flex justify-between text-[14px] font-semibold">
            School days the line actually works <span className="tnum">{works}%</span>
          </span>
          <input className={field} type="range" min={10} max={100} step={1} value={works} onChange={(e) => setWorks(+e.target.value)} />
          <span className="mt-1 block text-[12.5px] text-muted">
            BharatNet’s service-ready village connections: 33% operational (CAG, 2026). Private-led: 90%.
          </span>
        </label>
      </div>
      <dl className="grid content-start gap-5">
        <div className="border-l-4 border-ink/20 pl-4">
          <dt className="text-[13px] text-muted">A flat contract pays, every year</dt>
          <dd className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] tnum">${fmt(flat)}</dd>
        </div>
        <div className="border-l-4 border-paid pl-4">
          <dt className="text-[13px] text-muted">Roll Call pays, for the days that worked</dt>
          <dd className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] text-paid tnum">${fmt(rollcall)}</dd>
        </div>
        <div className="border-l-4 border-fault pl-4">
          <dt className="text-[13px] text-muted">Returned to the funder, or never owed</dt>
          <dd className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] text-fault tnum">${fmt(back)}</dd>
        </div>
        <p className="text-[12.5px] leading-snug text-muted">
          Assumes {schoolDays} school days a year, with the monthly price spread over them, and that providers keep the same price
          when part of it is at risk; a provider may ask for more per working day. Illustrative only: enter your own numbers.
        </p>
      </dl>
    </div>
  );
}
