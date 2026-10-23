"use client";

import { useEffect, useState } from "react";
import type { TermView, ReadingView, DayEventView } from "@/lib/server/reads";
import { Strands, StrandLegend } from "@/components/Strands";
import { usd, mbps, ago } from "@/lib/days";
import { txUrl, addrUrl, EXPLORER, ROLLCALL } from "@/lib/chain";
import { simByName } from "@/lib/schools";
import { RolePanel } from "./RolePanel";

type Payload = { term: TermView; readings: ReadingView[] | null; events: DayEventView[] | null; at: number };

function fmtTime(ts: number, dayLength: number) {
  const d = new Date(ts * 1000);
  return dayLength >= 86400
    ? d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST"
    : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";
}

export function TermClient({ initial, id }: { initial: Payload | null; id: number }) {
  const [data, setData] = useState<Payload | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => initial?.at ?? Math.floor(Date.now() / 1000));
  useEffect(() => {
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/term/${id}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "The term could not be read.");
      }
    };
    if (!initial) load();
    const a = setInterval(load, 8000);
    const b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [id, initial]);

  if (!data) return <p className="text-[15px] text-muted">{err ?? "Reading the term from the chain…"}</p>;
  const { term, readings, events } = data;
  const t = term.terms;
  const sim = simByName(term.school);
  const total = BigInt(t.ratePerDay) * BigInt(t.numDays);
  const dayLabel = t.dayLength >= 86400 ? "a day" : t.dayLength >= 3600 ? `${t.dayLength / 3600} hour` : `${t.dayLength / 60} minutes`;

  return (
    <div className="space-y-12">
      <div>
        <div className="duct rounded-2xl p-5 sm:p-8">
          <Strands terms={[term]} now={now} tone="duct" linkRows={false} />
          <div className="mt-5">
            <StrandLegend />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href={`/term/${term.id}/statement`} className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-sheet hover:bg-duct-2">
          Statement for this term
        </a>
        <a href={`/api/term/${term.id}/csv`} className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] font-semibold hover:border-ink">
          Download the register (CSV)
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-4">
        {[
          ["Locked at the start", usd(total.toString(), 0), "text-graphite"],
          ["Paid to the provider", usd(term.state.paid, 0), "text-ink"],
          ["Returned to the funder", usd(term.state.refunded, 0), "text-red"],
          [Number(term.state.slashed) ? "Bond held (cut so far)" : "Bond held", Number(term.state.slashed) ? `${usd(term.state.bondHeld, 0)} (−${usd(term.state.slashed, 0)})` : usd(term.state.bondHeld, 0), "text-cloth"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-sheet px-5 py-5">
            <dt className="text-[13px] text-muted">{l}</dt>
            <dd className={`mt-1 font-display text-[34px] font-bold leading-none tracking-[-0.03em] tnum ${c}`}>
              {v} <span className="font-sans text-[12px] font-medium text-muted">tUSD</span>
            </dd>
          </div>
        ))}
      </dl>

      {term.kind !== "sim" && term.kind !== "trial" && (
        <RolePanel
          term={term}
          now={now}
          onDone={() => fetch(`/api/term/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.term && setData(j))}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-[24px] font-semibold">The terms</h2>
          {sim && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sim.story}</p>}
          <table className="mt-5 w-full text-left text-[14px]">
            <tbody>
              {[
                ["Contracted network", `AS${t.asn}${sim ? `, ${sim.provider}` : ""}`],
                ["A test passes at", `${t.minDownKbps / 1000} Mbps down, ${t.minUpKbps / 1000} Mbps up, ${t.maxRttMs} ms or less`],
                ["Full pay for a day", t.required > 1 ? `a pass in each of ${t.required} equal parts of the day; fewer pays that share` : "one passing test"],
                ["Pay per school day", `${usd(t.ratePerDay)} tUSD`],
                ["School days", `${t.numDays}, each lasting ${dayLabel}`],
                ["First day starts", fmtTime(t.start, t.dayLength)],
                ["Late readings accepted for", `${t.lateWindow} s after a day ends`],
                ["Funder may challenge for", `${t.challengeWindow} s after that`],
                ["Provider bond", `${usd(t.bond, 0)} tUSD, ${usd(t.slash, 0)} cut per upheld challenge or early end`],
                ["Challenge deposit", Number(t.challengeDeposit) ? `${usd(t.challengeDeposit, 0)} tUSD, paid to the provider if a challenge fails` : "none"],
                ["Funder may end the term after", t.strikeLimit ? `${t.strikeLimit} missed days in a row` : "never"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-rule align-top">
                  <th className="w-[44%] py-2.5 pr-4 font-medium text-muted">{k}</th>
                  <td className="py-2.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-8 text-[17px] font-semibold">Keys</h3>
          <ul className="mt-2 space-y-1.5 text-[14px]">
            {[
              ["Funder", t.funder],
              ["Provider", t.provider],
              ["School probe", t.probe],
              ["Attester", t.attester],
              ["Arbiter", t.arbiter],
            ].map(([k, a]) => (
              <li key={k} className="flex flex-wrap justify-between gap-2">
                <span className="text-muted">{k}</span>
                <a className="font-mono text-[13px] text-ink underline-offset-2 hover:underline" href={addrUrl(a)}>
                  {a.slice(0, 8)}…{a.slice(-6)}
                </a>
              </li>
            ))}
          </ul>
          {term.openedTx && (
            <p className="mt-4 text-[14px]">
              <a className="text-ink underline" href={txUrl(term.openedTx)}>
                The transaction that opened this term
              </a>
            </p>
          )}
        </section>

        <section>
          <h2 className="text-[24px] font-semibold">What happened, day by day</h2>
          {events === null ? (
            <p className="mt-4 text-[14px] text-muted">The event history could not be read just now; the register above is current.</p>
          ) : events.length === 0 ? (
            <p className="mt-4 text-[14px] text-muted">No day has settled yet. The first settles {ago(t.start + t.dayLength + t.lateWindow + t.challengeWindow - now)} from now.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {[...events].reverse().slice(0, 40).map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-rule bg-sheet px-4 py-2.5 text-[14px]">
                  <span>
                    <span className="font-semibold">Day {e.day + 1}</span>{" "}
                    {e.kind === "settled"
                      ? `settled ${e.mark}: ${usd(e.paid ?? 0)} paid, ${usd(e.refunded ?? 0)} returned`
                      : e.kind === "closed"
                        ? `closed by the school: ${e.reason}`
                        : e.kind === "challenged"
                          ? `challenged by the funder: ${e.reason}`
                          : `challenge ${e.upheld ? "upheld, bond cut" : "rejected"}`}
                  </span>
                  <a className="shrink-0 text-ink underline" href={txUrl(e.tx)}>
                    tx
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-[24px] font-semibold">Every reading</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Each one was signed by the school’s probe and recorded by the attester with the network it ran over. Real tests
          carry M-Lab ids; simulated ones start with “sim:”.
        </p>
        {readings === null ? (
          <p className="mt-4 text-[14px] text-muted">Readings could not be read just now.</p>
        ) : readings.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted">No reading yet.</p>
        ) : (
          <div className="thin-scroll mt-5 overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead className="bg-ink-wash/50 text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Day</th>
                  <th className="px-4 py-2.5 font-semibold">Taken</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Down</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Up</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Round trip</th>
                  <th className="px-4 py-2.5 font-semibold">Network</th>
                  <th className="px-4 py-2.5 font-semibold">Result</th>
                  <th className="px-4 py-2.5 font-semibold">Test id</th>
                </tr>
              </thead>
              <tbody className="bg-sheet">
                {readings.slice(0, 200).map((r) => (
                  <tr key={r.testId + r.tx} className="border-t border-rule">
                    <td className="px-4 py-2 tnum">{r.day + 1}</td>
                    <td className="px-4 py-2 tnum">{fmtTime(r.takenAt, t.dayLength)}</td>
                    <td className="px-4 py-2 text-right tnum">{mbps(r.downKbps)} Mbps</td>
                    <td className="px-4 py-2 text-right tnum">{mbps(r.upKbps)} Mbps</td>
                    <td className="px-4 py-2 text-right tnum">{r.rttMs} ms</td>
                    <td className={`px-4 py-2 ${r.asn === t.asn ? "" : "text-red"}`}>AS{r.asn}</td>
                    <td className={`px-4 py-2 font-semibold ${r.pass ? "text-ink" : "text-red"}`}>{r.pass ? "passed" : "failed"}</td>
                    <td className="max-w-[260px] truncate px-4 py-2 font-mono text-[12px]">
                      {r.testId.startsWith("sim:") || r.testId.startsWith("offline:") ? (
                        <span className="text-muted">{r.testId}</span>
                      ) : (
                        <a className="text-ink underline" href={`/verify?test=${encodeURIComponent(r.testId)}`}>
                          {r.testId.split("|")[0]}
                        </a>
                      )}{" "}
                      <a className="text-muted underline" href={txUrl(r.tx)}>tx</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[13px] text-muted">
          Raw events:{" "}
          <a className="underline" href={`${EXPLORER}/address/${ROLLCALL}?tab=logs`}>
            the contract’s event log on Blockscout
          </a>
        </p>
      </section>
    </div>
  );
}
