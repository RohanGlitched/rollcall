import Link from "next/link";
import { SiteHeader, SiteFooter, REPO } from "@/components/Site";
import { OverviewProvider, LiveRegister, MoneyStrip, VisitorTerms, ProbeZeroRow, LatestReal, type Overview } from "@/components/LiveRegister";
import { SchoolStories } from "@/components/Stories";
import { CableSection } from "@/components/CableSection";
import { CountedNotChecked } from "@/components/Udise";
import { overview } from "@/lib/server/reads";
import { ROLLCALL, addrUrl } from "@/lib/chain";

export const dynamic = "force-dynamic";

const AUDIT = "https://www.policyedge.in/p/bharatnet-faces-major-operational-gaps-despite-near-complete-rural-fibre-coverage";

function Head({ title, lede }: { title: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-[34px] font-bold leading-[1.05] sm:text-[48px]">{title}</h2>
      {lede && <div className="mt-5 text-[18px] leading-relaxed text-muted">{lede}</div>}
    </div>
  );
}

const STEPS = [
  {
    h: "The school measures",
    p: "A probe in the school runs an M-Lab ndt7 test several times a day against the nearest M-Lab server: download, upload, round trip. Giga uses the same protocol to measure schools.",
    who: "School",
  },
  {
    h: "The probe signs",
    p: "A key only the school holds signs the numbers and the M-Lab test id. Change one digit and the signature breaks.",
    who: "School",
  },
  {
    h: "The line is identified",
    p: "The attester looks up which network the test ran over, and refuses a reading sent from any other. A test over a phone hotspot earns the contracted provider nothing.",
    who: "Attester",
  },
  {
    h: "The contract pays",
    p: "The day is split into parts, and a test has to pass in each. After a late window and a challenge window anyone can settle it: every part passed pays in full, some pays that share, none returns the day to the funder.",
    who: "Contract",
  },
];

export default async function Home() {
  const initial = (await overview().catch(() => null)) as Overview | null;
  return (
    <OverviewProvider initial={initial}>
      <div className="duct">
        <SiteHeader tone="duct" />
        <section className="mx-auto max-w-[1280px] px-4 pt-14 pb-16 sm:px-8 sm:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <h1 className="text-[48px] leading-[0.95] font-bold tracking-[-0.045em] text-glass sm:text-[84px]">
              School internet, paid by the day it works.
            </h1>
            <div className="lg:pb-2">
              <p className="text-[18px] leading-relaxed text-glass/80">
                A funder locks a term’s money in a contract. Every school day, a probe inside the school runs a real speed
                test. The provider is paid for the days the school was online over the line it was paid to run. Every other
                day goes back to the funder.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/test" className="rounded-full bg-glass px-6 py-3 text-[15px] font-semibold text-duct hover:bg-white">
                  Be the school for three minutes
                </Link>
                <Link href="/how" className="rounded-full border border-glass/25 px-6 py-3 text-[15px] font-semibold text-glass hover:border-glass/60">
                  How a day is decided
                </Link>
              </div>
            </div>
          </div>

          <div id="register" className="mt-16 scroll-mt-24 rounded-2xl border border-duct-line/80 bg-duct-2/40 p-5 sm:p-8">
            <LiveRegister />
          </div>

          <div className="mt-14">
            <MoneyStrip />
          </div>
        </section>
      </div>

      <main>
        {/* ------------------------------------------------------------ problem */}
        <section id="problem" className="mx-auto mt-28 max-w-[1280px] px-4 sm:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Head
                title="Paid for being ready. Not for working."
                lede="India’s auditor checked BharatNet, the programme running fibre to every village council. Most connections were marked ready; a third of those were working."
              />
              <dl className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-3">
                {[
                  { n: "96.7%", t: "of 226,000 village councils marked service ready" },
                  { n: "33.2%", t: "of those connections actually operational" },
                  { n: "17 days", t: "average to restore a fibre fault; cuts caused 48% of downtime" },
                ].map((x) => (
                  <div key={x.n} className="border-t-2 border-ink pt-4">
                    <dt className="font-display text-[44px] leading-none font-bold tracking-[-0.04em] tnum">{x.n}</dt>
                    <dd className="mt-3 text-[14.5px] leading-snug text-muted">{x.t}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[12.5px] text-faint">
                CAG Report No. 19 of 2026, performance audit of BharatNet, figures as of November 2025, as reported by{" "}
                <a className="underline hover:text-ink" href={AUDIT}>
                  The Policy Edge
                </a>
                .
              </p>
            </div>
            <figure className="flex flex-col items-center">
              <CableSection size={420} />
              <figcaption className="mt-5 max-w-sm text-center text-[13.5px] leading-snug text-muted">
                One hundred village connections as fibres in a cable, seen end-on. Ninety-seven are laid. Thirty-two carry light.
              </figcaption>
            </figure>
          </div>
          <div className="mt-20 grid gap-10 border-t border-line pt-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div>
              <h3 className="text-[30px] leading-[1.08] font-bold">Nobody counts whether school internet works.</h3>
              <p className="mt-4 text-[17px] leading-relaxed text-muted">
                India’s school census records whether 1.47 million schools have electricity, water, toilets and computers, and
                whether each of them works. For internet it records only whether a connection exists.
              </p>
              <Link href="/why" className="mt-5 inline-block text-[15px] font-semibold text-ink underline decoration-2 underline-offset-4">
                The state-by-state picture
              </Link>
            </div>
            <div className="rounded-2xl border border-line bg-sheet p-5 sm:p-7">
              <CountedNotChecked />
            </div>
          </div>
          <div className="mt-16 grid gap-10 border-t border-line pt-10 md:grid-cols-2">
            <p className="text-[18px] leading-relaxed">
              Schools live with the same gap. A connection is paid for when it is installed, or when a month ends, and nobody
              in the school can say “it was down all week” in a way a payment system will hear. The provider is paid either
              way, so a cut cable can wait 17 days.
            </p>
            <p className="text-[18px] leading-relaxed">
              Roll Call makes the school’s own speed test the payment trigger. A day the school was online over the paid-for
              line earns that day’s fee. A day it was not earns nothing, and the money goes back to the funder. Fixing a fault
              fast becomes the cheapest thing a provider can do.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------------- how */}
        <section id="how" className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <Head title="How one school day is decided" lede="Three parties who need not trust each other. Only the contract moves money." />
          <div className="relative mt-14">
            {/* the strand the steps are spliced onto */}
            <div className="absolute top-[13px] right-0 left-0 h-[6px] rounded-full bg-[linear-gradient(90deg,#3d8bff,#2fcb74_55%,#1d5fd0)] opacity-90 max-md:hidden" aria-hidden />
            <ol className="relative grid gap-10 md:grid-cols-4 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.h} className="relative max-md:border-l-4 max-md:border-paid/60 max-md:pl-5">
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-ground bg-ink text-[13px] font-bold text-sheet tnum max-md:hidden">
                    {i + 1}
                  </span>
                  <p className="mt-5 text-[13px] font-semibold text-paid">
                    Step {i + 1}, by the {s.who.toLowerCase()}
                  </p>
                  <h3 className="mt-1 text-[24px] leading-tight font-bold">{s.h}</h3>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{s.p}</p>
                </li>
              ))}
            </ol>
          </div>
          <LatestReal />
          <p className="mt-10 text-[15px]">
            <Link href="/how" className="font-semibold text-ink underline decoration-2 underline-offset-4">
              Every rule the contract enforces
            </Link>
          </p>
        </section>

        {/* ---------------------------------------------------------- stories */}
        <section id="schools" className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <Head
            title="Six schools, six things a real term goes through"
            lede="Each simulated school follows a script built from what actually breaks school connections. The contract decides every mark you see on its strand."
          />
          <div className="mt-12">
            <SchoolStories />
          </div>
        </section>

        {/* ------------------------------------------------------- real tests */}
        <section id="visitors" className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <Head
                title="Visitors who ran a real test"
                lede={
                  <>
                    Each strand is a term somebody opened from{" "}
                    <Link href="/test" className="text-ink underline underline-offset-4">
                      Be the school
                    </Link>
                    : three two-minute days, contracted to their own network, real M-Lab tests.
                  </>
                }
              />
              <div className="mt-8">
                <VisitorTerms />
              </div>
            </div>
            <div id="probe-zero">
              <Head
                title="Probe 0 keeps the real calendar"
                lede="A server in a data centre plays a school on fibre: four real M-Lab tests a day, a sixty-day term. Its test ids can be looked up in M-Lab’s archive."
              />
              <div className="mt-8">
                <ProbeZeroRow />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ trust */}
        <section id="trust" className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <Head title="Who has to agree before money moves" lede="No single party can pay itself. Each role is a separate key, and the contract refuses any term where one key holds two roles." />
          <div className="mt-12 border-t-2 border-ink">
            {[
              ["School probe", "Sign what it measured, or that it could not get online. Mark a day closed before any test runs: holiday, flood, exams.", "Pay anyone, or vouch for which network it used."],
              ["Attester", "Say which network a test ran over. Record readings the probe signed.", "Change a number the probe signed, or count one test twice."],
              ["Funder", "Lock the term’s money. Challenge a finished day, staking a deposit it loses if wrong. End the term after repeated absent days.", "Take back a day the provider earned, unless the arbiter agrees."],
              ["Provider", "Accept the terms and post a bond. Collect for every working day, the same week.", "Be paid for a day the probe did not see working."],
              ["Arbiter", "Decide a challenge. Upheld voids the day and cuts the bond; silence lets it lapse.", "Move money any other way."],
              ["Anyone", "Settle finished days. Read every reading. Check test ids against M-Lab’s archive.", "Move money any other way, or change a mark."],
            ].map(([r, c, n]) => (
              <div key={r} className="grid gap-2 border-b border-line py-5 md:grid-cols-[200px_1fr_1fr] md:gap-8">
                <h3 className="text-[20px] font-bold">{r}</h3>
                <p className="text-[15.5px] leading-relaxed">{c}</p>
                <p className="text-[15.5px] leading-relaxed text-muted">
                  <span className="font-semibold text-fault">Cannot </span>
                  {n.charAt(0).toLowerCase() + n.slice(1)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- compare */}
        <section id="compare" className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <Head title="How school connections are paid for today" lede="Roll Call does not replace the people who build networks. It changes what triggers the payment." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line md:grid-cols-3">
            {[
              { m: "Milestone contracts", pay: "A connection is installed and declared ready; monthly fees after that.", down: "Usually nothing changes. An audit may find it years later.", on: false },
              {
                m: "Giga Connectivity Credits",
                pay: "A provider earns credits for connecting a school, redeemable for subsidies or tax relief.",
                down: "Rewards connecting. Quality is measured separately with Giga Meter.",
                on: false,
              },
              {
                m: "Roll Call",
                pay: "Each school day the school’s own M-Lab tests pass, over the contracted network.",
                down: "That day’s money returns to the funder within the week. Repeated outages end the term and cut the bond.",
                on: true,
              },
            ].map((x) => (
              <div key={x.m} className={`p-7 ${x.on ? "duct" : "bg-sheet"}`}>
                <h3 className={`text-[24px] font-bold ${x.on ? "text-glass" : ""}`}>{x.m}</h3>
                <p className={`mt-5 text-[13px] font-semibold ${x.on ? "text-glass-muted" : "text-faint"}`}>Pays when</p>
                <p className={`mt-1 text-[15.5px] leading-relaxed ${x.on ? "text-glass" : ""}`}>{x.pay}</p>
                <p className={`mt-5 text-[13px] font-semibold ${x.on ? "text-glass-muted" : "text-faint"}`}>When the line is down</p>
                <p className={`mt-1 text-[15.5px] leading-relaxed ${x.on ? "text-glass" : "text-muted"}`}>{x.down}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-[13px] text-muted">
            Giga is the UNICEF and ITU initiative to connect every school. Its measurement tool,{" "}
            <a className="underline" href="https://meter.giga.global/">
              Giga Meter
            </a>
            , runs the same M-Lab ndt7 protocol as Roll Call, so Roll Call could read Giga Meter results instead of its own probe.
          </p>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="mx-auto mt-32 max-w-[1280px] px-4 sm:px-8">
          <div className="duct overflow-hidden rounded-3xl px-6 py-14 sm:px-14 sm:py-20">
            <h2 className="max-w-3xl text-[38px] leading-[1.02] font-bold text-glass sm:text-[60px]">Take the register yourself.</h2>
            <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-glass/80">
              Your browser becomes the school’s probe. The house opens a three-day term contracted to your network, you run real
              M-Lab tests, and you watch the contract light or cut each two-minute day. No wallet, no sign-up.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/test" className="rounded-full bg-glass px-6 py-3 text-[15px] font-semibold text-duct hover:bg-white">
                Be the school for three minutes
              </Link>
              <a href={addrUrl(ROLLCALL)} className="rounded-full border border-glass/25 px-6 py-3 text-[15px] font-semibold text-glass hover:border-glass/60">
                The contract on Blockscout
              </a>
              <a href={REPO} className="rounded-full border border-glass/25 px-6 py-3 text-[15px] font-semibold text-glass hover:border-glass/60">
                Source code
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </OverviewProvider>
  );
}
