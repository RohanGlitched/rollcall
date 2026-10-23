"use client";

import Link from "next/link";
import { SIM_SCHOOLS, FIBRE } from "@/lib/schools";
import { useOverview } from "./LiveRegister";
import { usd } from "@/lib/days";

export function SchoolStories() {
  const { data } = useOverview();
  return (
    <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
      {SIM_SCHOOLS.map((s) => {
        const t = data?.terms.find((x) => x.school === s.name);
        const marks = t?.days.map((d) => d.mark) ?? [];
        const count = (...m: string[]) => marks.filter((x) => m.includes(x)).length;
        const color = FIBRE[s.fibre];
        return (
          <article key={s.key} className="relative border-t border-line py-7 pl-7">
            <span
              className="absolute top-7 bottom-7 left-0 w-[5px] rounded-full"
              style={{ background: color, boxShadow: `0 0 14px ${color}66` }}
              aria-hidden
            />
            <p className="text-[13px] text-muted">
              {s.place}, {s.provider}, {s.fibre} fibre
            </p>
            <h3 className="mt-1 text-[24px] leading-tight font-bold">{s.name}</h3>
            <p className="mt-3 text-[16px] leading-relaxed">{s.story}</p>
            {t ? (
              <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                <dl className="flex gap-7 text-[13px]">
                  <div>
                    <dt className="text-muted">Days lit</dt>
                    <dd className="font-display text-[26px] leading-none font-bold text-paid tnum">{count("Present", "Partial")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Days returned</dt>
                    <dd className="font-display text-[26px] leading-none font-bold text-fault tnum">{count("Absent", "Silent", "Voided", "Closed")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Paid so far</dt>
                    <dd className="font-display text-[26px] leading-none font-bold tnum">{usd(t.state.paid, 0)}</dd>
                  </div>
                </dl>
                <Link href={`/term/${t.id}`} className="text-[14px] font-semibold text-ink underline decoration-2 underline-offset-4">
                  Open term {t.id}
                </Link>
                {t.state.ended && <span className="text-[13px] text-fault">This term has ended; the next opens on the hour.</span>}
              </div>
            ) : (
              <p className="mt-5 text-[13px] text-muted">Reading its term from the chain…</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
