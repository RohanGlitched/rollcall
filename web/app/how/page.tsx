import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, REPO, PageHero } from "@/components/Site";
import { ROLLCALL, addrUrl } from "@/lib/chain";

export const metadata: Metadata = {
  title: "How a school day is decided",
  description: "Every rule the Roll Call contract enforces: readings, the network check, day marks, late and challenge windows, closures, strikes and bonds.",
};

function Rule({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule py-10 md:grid-cols-[300px_1fr]">
      <div>
        <span className="text-[14px] font-semibold text-paid tnum">Rule {n}</span>
        <h2 className="mt-1 text-[28px] font-bold leading-[1.1]">{title}</h2>
      </div>
      <div className="max-w-3xl space-y-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

const code = "rounded bg-ink-wash/70 px-1.5 py-0.5 font-mono text-[13.5px] text-ink";

export default function How() {
  return (
    <>
      <PageHero
        title="How a school day is decided"
        lede={
          <>
            The rules the contract enforces, in the order they apply. The contract is{" "}
            <a className="underline decoration-glass/40 underline-offset-4 hover:decoration-glass" href={addrUrl(ROLLCALL)}>verified on Blockscout</a>, and every
            rule below is covered by a test in{" "}
            <a className="underline decoration-glass/40 underline-offset-4 hover:decoration-glass" href={`${REPO}/blob/main/contracts/test/RollCall.t.sol`}>RollCall.t.sol</a>.
          </>
        }
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">
        <div className="mt-6">
          <Rule n={1} title="A term is paid for up front">
            <p>
              The funder opens a term with the school’s probe key, the provider’s payout address, the contracted network,
              the pass bar and the daily rate. The contract takes the whole term’s money at once (<span className={code}>rate × days</span>),
              so the provider can see it exists before doing any work.
            </p>
            <p>
              The provider accepts by posting a bond before the first day starts. Until it does, the funder can take the
              money back. Nothing is paid for days before the provider accepted.
            </p>
          </Rule>

          <Rule n={2} title="A reading needs two signatures">
            <p>
              The probe in the school signs the reading: when it was taken, download, upload, round-trip time, a hash of the
              M-Lab test id and a hash of the client address. It signs with EIP-712, so the numbers are readable in any wallet and
              bound to this contract on this chain.
            </p>
            <p>
              The attester submits it, adding one fact the probe cannot vouch for: the network number (ASN) of the address
              M-Lab saw. It looks that up in RIPEstat, and refuses a reading that was sent from a different network than the
              one the test ran over. The contract checks the probe’s signature and that the full M-Lab test id matches the
              signed hash. A test id can be used once, ever.
            </p>
          </Rule>

          <Rule n={3} title="A reading passes or fails on its own">
            <p>
              A reading passes when all four hold: it ran over the contracted network, download is at least the bar,
              upload is at least the bar, and the round trip is at most the bar. The result is written on chain next to the
              reading, with the full M-Lab test id, in the <span className={code}>ReadingRecorded</span> event.
            </p>
            <p>A school day takes at most 24 readings, so a probe cannot flood a day to drown out failures.</p>
          </Rule>

          <Rule n={4} title="A day closes, waits, then settles">
            <p>
              A reading counts for the school day it was taken in, and may arrive until the late window after that day ends
              (a probe that lost its link can catch up). Then the challenge window runs. After both, anyone can settle the
              day; the demo’s house does it so visitors never need gas.
            </p>
            <p>Days settle strictly in order, so a run of missed days is always counted correctly.</p>
          </Rule>

          <Rule n={5} title="The mark decides the money">
            <ul className="space-y-2">
              <li><b className="text-ink">Present</b>: at least the required number of passing readings. The day is paid in full.</li>
              <li><b className="text-amber">Partial</b>: some passing readings. The provider gets that share of the day; the rest goes back.</li>
              <li><b className="text-red">Absent</b>: readings arrived, none passed. The day goes back to the funder.</li>
              <li><b className="text-red">Silent</b>: no reading arrived at all. A dead line cannot report, so silence is treated as absence.</li>
              <li><b className="text-cloth">Closed</b>: the school said so before the day ended. The day goes back, and it does not count against the provider.</li>
              <li><b className="text-red">Voided</b>: a challenge was upheld. The day goes back and the provider loses part of its bond.</li>
            </ul>
          </Rule>

          <Rule n={6} title="Only the school can close a day, and only in advance">
            <p>
              Holidays, exams, floods and power cuts are not the provider’s fault. The probe key signs a closure with a reason, and it
              must arrive before the day ends, so nobody can turn a failed day into a closed one afterwards.
            </p>
          </Rule>

          <Rule n={7} title="The funder can challenge; an arbiter decides">
            <p>
              Before a day settles, the funder can challenge it, for example when its M-Lab test ids are missing from M-Lab’s
              public archive or its speeds there differ from what was signed. The day then waits for the arbiter. Upheld:
              the day is voided and the bond is cut by the agreed amount, paid to the funder. Rejected: the day settles as measured.
            </p>
          </Rule>

          <Rule n={8} title="Repeated failure ends the term">
            <p>
              Absent, silent and voided days count as strikes; a working day resets the count; closed days leave it alone.
              After the agreed number of strikes in a row, the funder can end the term: every unserved day comes back, plus a
              cut of the bond. The rest of the bond goes back to the provider.
            </p>
          </Rule>

          <Rule n={9} title="Money is never created or lost">
            <p>
              Every unit the contract holds is either still owed for a future day, held as bond, paid to the provider, or
              returned to the funder. A fuzz test runs 500 random terms (random speeds, networks, closures and challenges) and
              checks this after each one, along with “the provider is never paid more than the rate for any day”.
            </p>
          </Rule>
        </div>

        <section className="mt-6 rounded-md border border-rule bg-sheet p-6 sm:p-8">
          <h2 className="text-[24px] font-semibold">What the demo simplifies</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
            <li>One house key plays funder, arbiter and attester, and a second plays the provider. In a real term these are four organisations.</li>
            <li>A single attester. The design allows a quorum of attesters, each checking the network independently; that is the next step.</li>
            <li>The visitor’s probe key lives in browser storage. A school device would keep it in hardware.</li>
            <li>The test dollar has no value and anyone can see its owner mints it for the demo.</li>
            <li>Speeds are what M-Lab’s server counted, sent by the probe. Only an archive check proves they were not edited before signing, which is why challenges exist.</li>
          </ul>
          <p className="mt-5 text-[15px]">
            <Link href="/verify" className="font-semibold text-ink underline underline-offset-4">Check any of this yourself</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
