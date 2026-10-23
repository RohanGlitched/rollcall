import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, PageHero } from "@/components/Site";
import { CountedNotChecked, StateStrands } from "@/components/Udise";
import { FunderCalculator } from "@/components/Calculator";

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
          <Block title="India counts working toilets, not working internet">
            <p>
              Every year UDISE+, the Ministry of Education’s census of all 1.47 million schools, records whether each school has
              electricity, water, toilets and computers, and separately whether each of them works. For internet it records
              one thing: whether the school has a connection. 934,000 schools do. How many of those connections work on a
              given school day is not recorded in UDISE+.
            </p>
            <div className="rounded-2xl border border-line bg-sheet p-5 sm:p-7">
              <CountedNotChecked />
            </div>
            <p>
              Roll Call is that missing column, produced by the school itself, every school day, in a form a payment can follow.
            </p>
          </Block>

          <section className="border-t border-line py-12">
            <h2 className="max-w-3xl text-[30px] leading-[1.08] font-bold">Connections laid, state by state. Light unknown.</h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
              From West Bengal’s 19% to Andhra Pradesh’s 99%, the share of schools with a connection varies five-fold. The share
              that works is not known in any state.
            </p>
            <div className="mt-8">
              <StateStrands />
            </div>
          </section>

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

          <section className="border-t border-line py-12">
            <h2 className="max-w-3xl text-[30px] leading-[1.08] font-bold">What a funder gets back</h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
              Move the sliders. A flat contract pays for every day; Roll Call pays for the days the school was online.
            </p>
            <div className="mt-8">
              <FunderCalculator />
            </div>
          </section>

          <Block title="Not only India">
            <p>
              The gap between a connected school and a working one is not Indian. Giga, the UNICEF and ITU initiative to connect
              every school, built Giga Meter because the same question has no answer elsewhere either; its open-source app runs
              M-Lab’s ndt7 test, the protocol Roll Call uses, in schools across dozens of countries (
              <a className="underline" href="https://meter.giga.global/">meter.giga.global</a>).
            </p>
            <p>
              Roll Call can read Giga Meter readings as its probe without changing the contract: each Giga Meter test already has
              an M-Lab test id and runs from inside the school. What it adds is the payment rule and the public register.
            </p>
          </Block>

          <Block title="Who adopts it first">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <b>Donors, CSR programmes and NGOs</b> that fund school connections today and already report outcomes. They can pay
                in stablecoins and use the register as their report from day one.
              </li>
              <li>
                <b>Giga-style programmes</b> that measure schools with M-Lab already, adding payment to measurement.
              </li>
              <li>
                <b>Governments last.</b> A universal service fund that cannot hold stablecoins can still run Roll Call in register mode:
                the same terms, readings and marks on chain, with its treasury paying in rupees what the register says each month.
              </li>
            </ol>
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
              settled day by the funder; the calculator above shows how large the money it protects is next to that fee.
            </p>
            <p>
              A probe can be any computer that is already in the school: a lab PC, the headteacher’s phone on the school
              Wi-Fi, or a Giga Meter installation. No new hardware is needed for a pilot.
            </p>
          </Block>

          <Block title="Who gains what">
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-left text-[15px]">
                <tbody className="bg-sheet">
                  {[
                    ["Pupils and teachers", "A line that is fixed in days, not weeks, because every dead day costs the provider."],
                    ["The headteacher", "A record of every outage the school can show anyone, without filing a complaint. The school holds the probe key and can declare holidays and floods before they count."],
                    ["The provider", "Payment the same week for every day it delivers, from money it can see is locked, and a bond that only moves on rules it agreed to."],
                    ["The funder", "Money back for every failed day, and a public register to report from instead of chasing invoices."],
                    ["The auditor", "Every reading named by an M-Lab test id it can look up, and a challenge with a deposit when something looks wrong."],
                  ].map(([who, what]) => (
                    <tr key={who} className="border-t border-line align-top first:border-t-0">
                      <th className="w-[34%] px-5 py-4 text-[16px] font-bold">{who}</th>
                      <td className="px-5 py-4 leading-relaxed">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <Block title="Consent and control for schools">
            <ul className="list-disc space-y-2 pl-5">
              <li>The school holds its probe key. Nobody else can sign its readings or close its days, and it can stop testing at any time.</li>
              <li>Readings carry speeds, a time and a network number. The school’s address goes on chain only as a salted hash, and M-Lab’s own data policy, which every tester agrees to, covers the address in M-Lab’s archive.</li>
              <li>No pupil or teacher data is involved: a probe measures the line, not the people using it.</li>
              <li>The rules are a public contract. A school, a provider or a journalist can read exactly what triggers payment before anyone signs.</li>
            </ul>
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
