import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/Site";
import { termNames, readTerms } from "@/lib/server/reads";
import { usd } from "@/lib/days";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Every term on chain", description: "Every term opened on the Roll Call contract, newest first." };

export default async function Terms() {
  const names = await termNames().catch(() => null);
  const ids = names ? [...names.keys()].sort((a, b) => b - a).slice(0, 150) : [];
  const terms = names ? await readTerms(ids).catch(() => []) : [];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 pt-12 sm:px-6 sm:pt-16">
        <h1 className="text-[38px] font-semibold leading-[1.08] sm:text-[52px]">Every term on chain</h1>
        <p className="mt-4 max-w-2xl text-[17px] text-muted">
          Newest first{names ? `, ${names.size} in all` : ""}. Simulated schools reopen a term each time one ends; visitor terms come from Be the school.
        </p>
        {!names ? (
          <p className="mt-10 text-[15px] text-red">The list could not be read just now. Try again in a minute.</p>
        ) : (
          <div className="thin-scroll mt-10 overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="bg-ink-wash/50 text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Term</th>
                  <th className="px-4 py-3 font-semibold">School</th>
                  <th className="px-4 py-3 font-semibold">Days settled</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold">Returned</th>
                  <th className="px-4 py-3 font-semibold">State</th>
                </tr>
              </thead>
              <tbody className="bg-sheet">
                {terms.map((t) => (
                  <tr key={t.id} className="border-t border-rule">
                    <td className="px-4 py-2.5 tnum">
                      <Link className="font-semibold text-ink underline" href={`/term/${t.id}`}>{t.id}</Link>
                    </td>
                    <td className="px-4 py-2.5">{t.school}</td>
                    <td className="px-4 py-2.5 tnum">{t.state.settledDays} of {t.terms.numDays}</td>
                    <td className="px-4 py-2.5 text-right text-ink tnum">{usd(t.state.paid)}</td>
                    <td className="px-4 py-2.5 text-right text-red tnum">{usd(t.state.refunded)}</td>
                    <td className="px-4 py-2.5 text-muted">{t.state.ended ? "ended" : t.state.accepted ? "running" : "not accepted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
