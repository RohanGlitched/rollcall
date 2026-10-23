import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter, Mark } from "@/components/Site";
import { readTerm, dayEventsFor } from "@/lib/server/reads";
import { addrUrl, txUrl, ROLLCALL } from "@/lib/chain";
import { usd } from "@/lib/days";
import { simByName } from "@/lib/schools";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Statement for term ${(await params).id}` };
}

const MARK_LABEL: Record<string, string> = {
  Present: "Paid in full",
  Partial: "Paid in part",
  Absent: "Line failed",
  Silent: "Nothing reported",
  Closed: "School closed",
  Voided: "Challenge upheld",
  Open: "Not settled yet",
};

function fmtDay(ts: number, dayLength: number) {
  const d = new Date(ts * 1000);
  return dayLength >= 86400
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";
}

/** A printable statement for one term: what a treasury that cannot hold stablecoins would pay against ("register mode"). */
export default async function Statement({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const term = await readTerm(id).catch(() => null);
  if (!term) notFound();
  const events = await dayEventsFor(id).catch(() => []);
  const t = term.terms;
  const sim = simByName(term.school);
  const settled = (d: number) => events.find((e) => e.kind === "settled" && e.day === d);
  const count = (m: string) => term.days.filter((d) => d.mark === m).length;
  const issued = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main className="mx-auto max-w-[960px] px-4 pt-10 pb-6 sm:px-8 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/term/${id}`} className="text-[14px] font-semibold text-ink underline underline-offset-4">
            Back to term {id}
          </Link>
          <div className="flex gap-3">
            <a href={`/api/term/${id}/csv`} className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] font-semibold hover:border-ink">
              Download CSV
            </a>
            <PrintButton />
          </div>
        </div>

        <article className="rounded-2xl border border-line bg-white p-8 shadow-sm sm:p-12 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <Mark size={26} />
                <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Roll Call</span>
              </div>
              <h1 className="mt-5 text-[30px] leading-tight font-bold">Statement for term {id}</h1>
              <p className="mt-1 text-[16px]">{term.school}{sim ? `, ${sim.place} (simulated)` : ""}</p>
            </div>
            <dl className="text-right text-[13px] leading-relaxed text-muted">
              <div>Issued {issued} IST</div>
              <div>Contract {ROLLCALL.slice(0, 10)}…{ROLLCALL.slice(-6)} on Base Sepolia</div>
              <div>{term.state.ended ? "Term ended" : `${term.state.settledDays} of ${t.numDays} days settled`}</div>
            </dl>
          </header>

          <section className="grid gap-6 border-b border-line py-6 text-[14px] sm:grid-cols-2">
            <table className="w-full table-fixed">
              <tbody>
                {[
                  ["Funder", t.funder],
                  ["Provider", t.provider],
                  ["School probe", t.probe],
                  ["Attester", t.attester],
                  ["Arbiter", t.arbiter],
                ].map(([k, a]) => (
                  <tr key={k}>
                    <th className="w-32 py-1 pr-3 text-left font-medium text-muted">{k}</th>
                    <td className="truncate py-1 font-mono text-[12.5px]">
                      <a href={addrUrl(a)} className="hover:underline">
                        {a}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full">
              <tbody>
                {[
                  ["Contracted network", `AS${t.asn}`],
                  ["Pass bar", `${t.minDownKbps / 1000} Mbps down, ${t.minUpKbps / 1000} up, ≤ ${t.maxRttMs} ms`],
                  ["Full day", t.required > 1 ? `a pass in each of ${t.required} parts${t.schoolHours ? ` of ${t.schoolHours / 3600} school hours` : ""}` : "one passing test"],
                  ["Rate", `${usd(t.ratePerDay)} tUSD per school day`],
                  ["School days", `${t.numDays} from ${fmtDay(t.start, t.dayLength)}`],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <th className="w-40 py-1 pr-3 text-left font-medium text-muted">{k}</th>
                    <td className="py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="thin-scroll overflow-x-auto py-6">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead className="border-b border-ink text-[12px] text-muted">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Day</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Result</th>
                  <th className="py-2 pr-3 text-right font-semibold">Parts</th>
                  <th className="py-2 pr-3 text-right font-semibold">Paid</th>
                  <th className="py-2 pr-3 text-right font-semibold">Returned</th>
                  <th className="py-2 font-semibold print:hidden">Record</th>
                </tr>
              </thead>
              <tbody>
                {term.days.map((d, i) => {
                  const st = settled(i);
                  return (
                    <tr key={i} className="border-b border-line">
                      <td className="py-1.5 pr-3 tnum">{i + 1}</td>
                      <td className="py-1.5 pr-3 tnum">{fmtDay(t.start + i * t.dayLength, t.dayLength)}</td>
                      <td className={`py-1.5 pr-3 ${d.mark === "Present" ? "text-paid" : d.mark === "Partial" ? "text-part" : d.mark === "Open" ? "text-faint" : "text-fault"}`}>
                        {MARK_LABEL[d.mark]}
                      </td>
                      <td className="py-1.5 pr-3 text-right tnum">{d.mark === "Open" ? "" : `${d.passes}/${t.required}`}</td>
                      <td className="py-1.5 pr-3 text-right tnum">{st ? usd(st.paid ?? 0) : ""}</td>
                      <td className="py-1.5 pr-3 text-right tnum">{st ? usd(st.refunded ?? 0) : ""}</td>
                      <td className="py-1.5 print:hidden">
                        {st && (
                          <a href={txUrl(st.tx)} className="text-ink underline">
                            tx
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-[14px] font-semibold">
                <tr className="border-t-2 border-ink">
                  <td colSpan={4} className="py-2">
                    {count("Present")} full, {count("Partial")} part, {count("Absent") + count("Voided")} failed, {count("Silent")} unreported, {count("Closed")} closed
                  </td>
                  <td className="py-2 pr-3 text-right text-paid tnum">{usd(term.state.paid)}</td>
                  <td className="py-2 pr-3 text-right text-fault tnum">{usd(term.state.refunded)}</td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
            {Number(term.state.slashed) > 0 && (
              <p className="mt-3 text-[13px]">Provider bond cut and paid to the funder: {usd(term.state.slashed)} tUSD.</p>
            )}
          </section>

          <section className="rounded-xl bg-ground p-5 text-[13.5px] leading-relaxed print:border print:border-line print:bg-white">
            <p className="font-semibold">Register mode</p>
            <p className="mt-1">
              A funder whose treasury cannot hold stablecoins can run the same term with the contract as the register and pay the
              provider the “Paid” total above in its own currency. Every line is decided by the contract from probe-signed readings,
              and each one links to the transaction that settled it.
            </p>
          </section>
        </article>
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </>
  );
}
