import type { Metadata } from "next";
import { SiteFooter, PageHero } from "@/components/Site";
import { ReplayClient } from "./ReplayClient";
import { termNames, readTerms } from "@/lib/server/reads";
import { kindOf } from "@/lib/schools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "A whole term in 24 minutes",
  description: "The six simulated schools on a one-minute clock: every reading, closure, challenge and payment of a 24-day term, on chain, in 24 minutes.",
};

export default async function ReplayPage() {
  const names = await termNames().catch(() => null);
  const ids = names ? [...names.entries()].filter(([, n]) => kindOf(n.school) === "replay").map(([id]) => id).sort((a, b) => b - a).slice(0, 6).sort((a, b) => a - b) : [];
  const terms = ids.length ? await readTerms(ids).catch(() => []) : [];
  return (
    <>
      <PageHero
        title="A whole term in 24 minutes"
        lede="The same six schools and the same contract, on a clock where a school day lasts one minute. Every reading, closure, challenge, payment and refund below happened on chain."
      >
        <div className="rounded-2xl border border-duct-line/80 bg-duct-2/40 p-5 sm:p-8">
          <ReplayClient initial={terms.length ? { terms, at: Math.floor(Date.now() / 1000) } : null} />
        </div>
      </PageHero>
      <SiteFooter />
    </>
  );
}
