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
          <Rule n={1} title="A term is paid for up front, by four separate keys">
            <p>
              The funder opens a term naming the school’s probe key, the provider, the attester, the arbiter, the contracted
              network, the pass bar and the daily rate. The contract takes the whole term’s money at once
              (<span className={code}>rate × days</span>), so the provider can see it exists before doing any work. It refuses a
              term where one key holds two roles, so nobody can be both the judge and a party.
            </p>
            <p>
              The provider accepts by posting a bond before the first day starts. Until it does, the funder can take the money back.
            </p>
          </Rule>

          <Rule n={2} title="A reading needs two signatures">
            <p>
              The probe in the school signs the reading with EIP-712: when it was taken, download, upload, round-trip time, a hash
              of the M-Lab test ids (download and upload) and a salted hash of the client address. Change one digit and the
              signature breaks.
            </p>
            <p>
              The term’s attester submits it, adding one fact the probe cannot vouch for: the network number (ASN) of the address
              M-Lab saw, looked up in RIPEstat. It refuses a reading sent from a different network than the one the test ran over.
              The contract checks the probe’s signature and that the full test ids match the signed hash. A test can be used once, ever.
            </p>
          </Rule>

          <Rule n={3} title="A day is split into parts, and each part has to pass">
            <p>
              A reading passes when all four hold: it ran over the contracted network, download and upload are at least the bar,
              and the round trip is at most the bar. The result goes on chain with the full M-Lab test ids in the{" "}
              <span className={code}>ReadingRecorded</span> event.
            </p>
            <p>
              The school’s opening hours each day are divided into as many equal parts as the term requires passes, and only the
              first pass in each part counts. A line that works for half an hour cannot earn a whole day by retrying, and a probe
              never has to test at night: a pass outside school hours counts for nothing.
            </p>
            <p>
              A day holds at most 24 failing readings, so a probe cannot flood a day, but a pass the day still needs is always accepted.
            </p>
          </Rule>

          <Rule n={4} title="A probe that cannot get online says so">
            <p>
              When the line is dead the probe cannot reach M-Lab, so it signs an offline report instead, with zero speeds and a test
              id that starts with <span className={code}>offline:</span>. Because the line it would use is down, the report is meant
              to travel another way, such as the headteacher’s phone on mobile data, and the contract accepts it until the day settles
              (a test with speeds must arrive within the late window). That makes the difference between a dead line and a dead device
              visible on chain, even in a cut that lasts weeks.
            </p>
          </Rule>

          <Rule n={5} title="A day closes, waits, then settles">
            <p>
              A reading counts for the school day it was taken in, and may arrive until the late window after that day ends. Then
              the challenge window runs. After both, anyone can settle the day; the demo’s attester does it so visitors never need gas.
              Days settle strictly in order, so runs of failures are counted correctly.
            </p>
          </Rule>

          <Rule n={6} title="The mark decides the money">
            <ul className="space-y-2">
              <li><b className="text-paid">Present</b>: a pass in every part of the day. Paid in full.</li>
              <li><b className="text-part">Partial</b>: passes in some parts. The provider gets that share; the rest goes back. Fewer than half the parts is also a strike.</li>
              <li><b className="text-fault">Absent</b>: the probe reported (failed tests or offline reports) and nothing passed. Refunded, and a strike against the provider.</li>
              <li><b className="text-fault">Silent</b>: nothing reported at all, which is what a power cut or a switched-off device looks like. Refunded, no strike.</li>
              <li><b className="text-sleeve">Closed</b>: the school declared it before any test that day. Refunded, no strike.</li>
              <li><b className="text-fault">Voided</b>: a challenge was upheld. Refunded, a strike, and part of the bond goes to the funder.</li>
            </ul>
          </Rule>

          <Rule n={7} title="Only the school can close a day, and only before it tests">
            <p>
              Weekends, holidays, exams and floods are not the provider’s fault. The probe key signs a closure for a day or a run of up
              to 31 days with a reason. It is accepted only while those days have not ended and have no reading at all, so a closure
              can neither erase a failure the probe saw nor take back a pass the provider earned, and the same closure cannot be sent twice.
            </p>
          </Rule>

          <Rule n={8} title="The funder can challenge; the arbiter decides, or the challenge lapses">
            <p>
              Once a day has ended and before it settles, the funder can challenge it, for example when its test ids are missing from
              M-Lab’s public archive, by staking the term’s challenge deposit. Upheld: the day is voided, the deposit comes back and
              the bond is cut. Rejected: the deposit goes to the provider. If the arbiter stays silent for one more challenge window,
              the challenge lapses, the day settles as measured and the deposit goes to the provider, so nobody can freeze a term.
            </p>
          </Rule>

          <Rule n={9} title="Repeated failure ends the term">
            <p>
              Absent days, voided days and days passing fewer than half their parts are strikes; a day passing at least half resets the
              count; silent and closed days leave it alone. One weak pass a day cannot keep a failing line in a term forever. After the agreed
              number of strikes in a row, the funder can end the term: unserved days come back with a cut of the bond, the rest of the
              bond goes back to the provider. A finished day with any passing test must settle first, so a day the provider earned is
              always paid.
            </p>
          </Rule>

          <Rule n={10} title="Money is never created or lost">
            <p>
              Every unit the contract holds is owed for a future day, held as bond, or held as a challenge deposit. A fuzz test runs 500
              random terms (random speeds, networks, parts of the day, closures, challenges and lapses) and checks after each that
              nothing was created or lost, that paid plus refunded covers every day, and that no day paid more than its rate.
            </p>
          </Rule>
        </div>

        <section className="mt-6 rounded-md border border-rule bg-sheet p-6 sm:p-8">
          <h2 className="text-[24px] font-semibold">What the demo simplifies</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
            <li>The four roles are four separate keys, but all four are held by this demo’s server. In a real term they are four organisations.</li>
            <li>One attester per term. A quorum of attesters, each checking the network independently, is the next step.</li>
            <li>The visitor’s probe key lives in browser storage. A school device would keep it in hardware.</li>
            <li>The test dollar has no value and anyone can see its owner mints it for the demo.</li>
            <li>Speeds are what M-Lab’s server counted, relayed by the probe (falling back to the browser’s own count if the server sends none). Only an archive check proves they were not edited before signing, which is why challenges exist.</li>
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
