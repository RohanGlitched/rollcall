import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, PageHero } from "@/components/Site";

export const metadata: Metadata = {
  title: "Why pay by the working day",
  description: "What breaks school connectivity, who would pay through Roll Call, how a district pilot would run, and what has to be true for it to work.",
};

const AUDIT = "https://www.policyedge.in/p/bharatnet-faces-major-operational-gaps-despite-near-complete-rural-fibre-coverage";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule py-12 md:grid-cols-[300px_1fr]">
      <h2 className="text-[30px] font-bold leading-[1.08]">{title}</h2>
      <div className="max-w-3xl space-y-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Why() {
  const models = [
    { m: "Private-led", v: 90.11 },
    { m: "State-led", v: 39.8 },
    { m: "Central public-sector-led", v: 10.74 },
  ];
  return (
    <>
      <PageHero
        title="Why pay by the working day"
        lede="A school that is “connected” on a map and offline in the classroom is the most common failure in school connectivity. It is also the one no payment system notices."
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">

        <div className="mt-10">
          <Block title="The same fibre, very different results">
            <p>
              India’s auditor found BharatNet’s village connections working in 33.2% of the places marked service ready. The
              average hides the lesson: how the network was run, and how its operators were paid, changed everything.
            </p>
            <div className="space-y-3 rounded-md border border-rule bg-sheet p-5">
              <p className="text-[13px] text-muted">Service-ready village councils actually operational, by delivery model (November 2025)</p>
              {models.map((x) => (
                <div key={x.m} className="grid grid-cols-[150px_1fr_64px] items-center gap-3 text-[14px] sm:grid-cols-[210px_1fr_64px]">
                  <span>{x.m}</span>
                  <span className="h-3 overflow-hidden rounded-sm bg-red-wash">
                    <span className="block h-full bg-ink" style={{ width: `${x.v}%` }} />
                  </span>
                  <span className="text-right font-semibold tnum">{x.v.toFixed(1)}%</span>
                </div>
              ))}
              <p className="text-[12px] text-muted">
                CAG Report No. 19 of 2026 on BharatNet, as reported by{" "}
                <a className="underline" href={AUDIT}>The Policy Edge</a>. The private-led model paired milestone payments with
                seven-year maintenance contracts.
              </p>
            </div>
            <p>
              Operators respond to what they are paid for. Roll Call makes the thing that is paid for the thing a school
              needs: a working line on a school day, measured from inside the school.
            </p>
          </Block>

          <Block title="Who would pay through it">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <b>Universal service funds</b> (India’s Digital Bharat Nidhi and its equivalents) already pay operators to serve
                places markets skip. A term per school, settled daily, is a payment rail they can adopt contract by contract.
              </li>
              <li>
                <b>State education departments</b> paying for school broadband out of their own budgets, who today have no
                way to withhold payment for a dead line short of a dispute.
              </li>
              <li>
                <b>Donors and CSR programmes</b> that fund school connections and want to show where every rupee went. The
                register is the report.
              </li>
              <li>
                <b>Giga-style programmes</b> that already measure schools with M-Lab’s protocol and fund connectivity through
                credits; Roll Call can read their measurements instead of running its own probe.
              </li>
            </ul>
            <p>
              Funders keep the money for every day that fails. Providers get something they rarely have: payment the same week
              for every day they deliver, from a contract that cannot be argued with.
            </p>
          </Block>

          <Block title="How it pays for itself">
            <p>
              Running one school for a year takes about 70 million gas on Base, priced live on{" "}
              <Link className="text-ink underline" href="/verify">the verify page</Link>. The cost that matters is the
              attester: an organisation that checks networks and stands behind its word. It can be paid a small fee per
              settled day by the funder, which is still far cheaper than the money a funder recovers from one week of
              silent days.
            </p>
            <p>
              A probe can be any computer that is already in the school: a lab PC, the headteacher’s phone on the school
              Wi-Fi, or a Giga Meter installation. No new hardware is needed for a pilot.
            </p>
          </Block>

          <Block title="A first pilot">
            <ol className="list-decimal space-y-2 pl-5">
              <li>One district, 20 to 50 schools that already have a fibre or wireless line and a computer that stays on during school hours.</li>
              <li>The funder moves one term’s connectivity budget into Roll Call terms, with the provider’s agreement, at the price they already pay.</li>
              <li>Three attesters (for example a university network lab, the funder’s auditor and an NGO), each checking every reading.</li>
              <li>Real terms use stablecoins on a public chain; the funder can convert to and from rupees through a regulated partner.</li>
              <li>After one term, compare days paid against the provider’s own uptime reports and against M-Lab’s archive.</li>
            </ol>
          </Block>

          <Block title="What has to be true">
            <ul className="list-disc space-y-2 pl-5">
              <li>The probe is in the school and stays there. A school that colludes with a provider can still fake presence by running tests elsewhere on the same network; the archive check and site visits remain the funder’s tools.</li>
              <li>A failed day is the provider’s fault often enough to be worth paying by. Power cuts and holidays are handled by school closures, which never count against the provider.</li>
              <li>Providers accept a contract with automatic refunds. The bond and daily settlement are what make it acceptable: they are paid fast for the days they deliver.</li>
              <li>The attesters are independent of the provider. That is why the design calls for several, and why each reading names an M-Lab test anyone can check.</li>
            </ul>
          </Block>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/test" className="rounded-md bg-ink px-5 py-3 text-[15px] font-semibold text-sheet hover:bg-ink-soft">
            Be the school for three minutes
          </Link>
          <Link href="/how" className="rounded-md border border-rule-strong bg-sheet px-5 py-3 text-[15px] font-semibold hover:border-ink hover:text-ink">
            Read the contract’s rules
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
