import { UDISE_INDIA, UDISE_STATES, UDISE_SOURCE } from "@/lib/udise";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (a: number, b: number) => (a / b) * 100;

/** Every facility India's school census counts twice (present, working) except internet. */
export function CountedNotChecked() {
  const total = UDISE_INDIA.schools;
  return (
    <div className="space-y-5">
      {UDISE_INDIA.facilities.map((f) => {
        const has = pct(f.has, total);
        const works = f.works === null ? null : pct(f.works, total);
        const internet = f.works === null;
        return (
          <div key={f.name} className="grid gap-2 sm:grid-cols-[150px_1fr_190px] sm:items-center sm:gap-5">
            <p className={`text-[15px] font-semibold ${internet ? "text-ink" : ""}`}>{f.name}</p>
            <div className="relative h-6 rounded-full bg-line/60">
              <div className="absolute inset-y-0 left-0 rounded-full border-2 border-ink/25" style={{ width: `${has}%` }} />
              {works !== null ? (
                <div className="absolute inset-y-[5px] left-[5px] rounded-full bg-paid" style={{ width: `calc(${works}% - 10px)` }} />
              ) : (
                <div
                  className="absolute inset-y-[5px] left-[5px] rounded-full"
                  style={{
                    width: `calc(${has}% - 10px)`,
                    background: "repeating-linear-gradient(135deg, rgba(216,68,58,.55) 0 6px, transparent 6px 12px)",
                  }}
                />
              )}
            </div>
            <p className="text-[13.5px] leading-snug text-muted tnum">
              {internet ? (
                <>
                  {fmt(f.has)} have it.{" "}
                  <span className="font-semibold text-fault">Working: not recorded.</span>
                </>
              ) : (
                <>
                  {fmt(f.has)} have it, {fmt(f.works!)} work
                </>
              )}
            </p>
          </div>
        );
      })}
      <p className="pt-2 text-[12.5px] text-faint">
        Out of {fmt(total)} schools. Outline: schools that have the facility. Fill: schools where it works. Source:{" "}
        <a className="underline hover:text-ink" href={UDISE_SOURCE.url}>
          {UDISE_SOURCE.label}
        </a>
        .
      </p>
    </div>
  );
}

/** Each state as a strand: the share of its schools with an internet connection, none of it known to be lit. */
export function StateStrands() {
  const rows = UDISE_STATES.map(([s, t, i]) => ({ s, t, i, p: pct(i, t) }))
    .filter((r) => r.t >= 1000)
    .sort((a, b) => b.p - a.p);
  return (
    <div className="duct rounded-2xl p-5 sm:p-8">
      <div className="grid gap-x-10 gap-y-1.5 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.s} className="grid grid-cols-[minmax(0,150px)_1fr_48px] items-center gap-3 py-1">
            <span className="truncate text-[13px] text-glass/85" title={r.s}>
              {r.s}
            </span>
            <span className="relative h-[6px] rounded-full bg-white/5">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${r.p}%`, background: "linear-gradient(90deg, rgba(159,178,194,.55), rgba(159,178,194,.25))" }}
              />
              <span className="absolute -top-[5px] text-[11px] font-bold text-[#ff8a80]" style={{ left: `calc(${r.p}% + 4px)` }}>
                ?
              </span>
            </span>
            <span className="text-right text-[12.5px] font-semibold text-glass tnum">{r.p.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] text-glass-muted">
        Share of each state’s schools with an internet facility (states and UTs with at least 1,000 schools). The strands are
        drawn unlit because nobody records whether they carry light. Source:{" "}
        <a className="underline hover:text-glass" href={UDISE_SOURCE.url}>
          {UDISE_SOURCE.label}
        </a>
        .
      </p>
    </div>
  );
}
