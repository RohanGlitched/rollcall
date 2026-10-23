import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, PageHero } from "@/components/Site";

export const metadata: Metadata = {
  title: "Afterbell: the school’s internet, shared after the bell",
  description:
    "An idea: after school hours the school’s internet line becomes the village’s public Wi-Fi under PM-WANI, and every rupee is split on chain to keep the school connected, pay a local operator and pay the provider.",
};

const AUDIT = "https://www.policyedge.in/p/bharatnet-faces-major-operational-gaps-despite-near-complete-rural-fibre-coverage";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One week of a school's line, hour by hour: school use, Afterbell hours, and the night. */
function Week() {
  const kind = (d: number, h: number) => {
    const school = d < 5 && h >= 9 && h < 15;
    if (school) return "school";
    if ((d < 5 && h >= 15 && h < 21) || (d >= 5 && h >= 8 && h < 21)) return "after";
    return "night";
  };
  const color = { school: "#3d8bff", after: "#ffb347", night: "rgba(234,242,240,.07)" } as const;
  return (
    <div className="duct rounded-2xl p-5 sm:p-8">
      <div className="grid grid-cols-[34px_repeat(24,minmax(0,1fr))] gap-[3px] text-[10.5px] text-glass-muted">
        <span />
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h} className="text-center tnum">
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
        {DAYS.map((d, i) => (
          <div key={d} className="contents">
            <span className="self-center">{d}</span>
            {Array.from({ length: 24 }).map((_, h) => {
              const k = kind(i, h);
              return (
                <span
                  key={h}
                  className="h-5 rounded-[3px] sm:h-7"
                  style={{ background: color[k], boxShadow: k === "night" ? "none" : `0 0 10px ${color[k]}55` }}
                  title={`${d} ${h}:00 ${k === "school" ? "school hours" : k === "after" ? "Afterbell hours" : "night"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-glass-muted">
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm bg-[#3d8bff]" /> the school uses its line: 30 hours a week
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm bg-[#ffb347]" /> Afterbell opens it to the village: 56 hours a week
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm bg-white/10" /> night: off
        </li>
      </ul>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-12 md:grid-cols-[300px_1fr]">
      <h2 className="text-[28px] leading-[1.08] font-bold">{title}</h2>
      <div className="max-w-3xl space-y-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Afterbell() {
  return (
    <>
      <PageHero
        kicker="An idea for the Idea Track, from the team behind Roll Call"
        title="Afterbell: the school’s internet, shared after the bell."
        lede="When the school day ends, the school’s line becomes the village’s public Wi-Fi. Every rupee is split on a public ledger: first to keep the school connected, then to a local operator and the provider."
      >
        <Week />
      </PageHero>
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">
        <Block title="Paid for, then left idle">
          <p>
            India’s auditor found that BharatNet, the fibre network that reaches every village council, uses only{" "}
            <b>17.91% of the bandwidth</b> available at its service-ready connections (CAG Report No. 19 of 2026, as summarised by{" "}
            <a className="underline" href={AUDIT}>The Policy Edge</a>).
          </p>
          <p>
            A school line is the clearest case: it is used about six hours a school day, about 200 days a year, roughly 1,200 of the
            year’s 8,760 hours. In the evenings the same village’s students have nowhere affordable to get online for homework,
            applications and exams, while the school pays its bill out of a small budget.
          </p>
        </Block>

        <Block title="How it works">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <b>After the bell, a separate public network opens on the school’s router.</b> India’s public Wi-Fi framework, PM-WANI, lets
              any shop or establishment run one as a Public Data Office without a licence, and TRAI caps what a provider may charge it for
              the backhaul. During school hours it is off; children’s devices never share a network with the public.
            </li>
            <li>
              <b>Villagers buy time in rupees,</b> by UPI at the operator’s shop or in a PM-WANI app, for example ₹10 an hour. Nobody
              touches crypto.
            </li>
            <li>
              <b>Every sale is split by a contract, in public.</b> The School Management Committee, the parent-led body every government
              school has under the Right to Education Act, approves the split on chain.
            </li>
          </ol>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line">
            <div className="flex h-12 text-[13.5px] font-semibold text-white">
              <div className="flex items-center justify-center bg-[#1d5fd0]" style={{ width: "50%" }}>
                50% school’s connectivity fund
              </div>
              <div className="flex items-center justify-center bg-[#c27a12]" style={{ width: "30%" }}>
                30% operator
              </div>
              <div className="flex items-center justify-center bg-[#566470]" style={{ width: "20%" }}>
                20% provider
              </div>
            </div>
            <p className="bg-sheet px-4 py-3 text-[13px] text-muted">An example split. The committee sets it; changing it needs the committee’s signature.</p>
          </div>
        </Block>

        <Block title="Why Web3 here">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Four parties who do not answer to each other share every sale: a school, a private operator, a provider and a village
              committee. A contract settles each sale the same day, in public, without an accountant in the middle.
            </li>
            <li>The split is a rule nobody can quietly change; the school’s share is protected by the committee’s signature.</li>
            <li>Stablecoin rails settle tiny amounts cheaply, while users and the operator see only rupees through a payment partner.</li>
            <li>
              It composes with{" "}
              <Link className="underline" href="/">
                Roll Call
              </Link>
              : Roll Call keeps the line working by day, paying the provider only for days it works; Afterbell makes the same line earn in
              the evening.
            </li>
          </ul>
        </Block>

        <Block title="Impact">
          <ul className="list-disc space-y-2 pl-5">
            <li>A school line that pays for itself instead of depending on a grant that can lapse.</li>
            <li>Evening internet for students near a place their families already trust.</li>
            <li>A small local job in every school village that adopts it.</li>
            <li>Infrastructure the country already paid for, used: a direct answer to the 17.91% finding.</li>
          </ul>
        </Block>

        <Block title="Risks, and how they are handled">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Child safety.</b> The public network runs only after hours, separate from school devices, with PM-WANI’s user
              authentication and content norms. The committee can switch it off with one signature.
            </li>
            <li>
              <b>The school’s own use.</b> School hours always win: the public network turns off automatically before the bell.
            </li>
            <li>
              <b>Provider terms.</b> TRAI’s cap on backhaul pricing for public Wi-Fi applies, and the provider’s share is written into the split.
            </li>
            <li>
              <b>Cash and crypto.</b> Users and operators deal only in rupees; stablecoins move only between the contract and the payment partner.
            </li>
          </ul>
        </Block>

        <Block title="A pilot, and what we would build for the finals">
          <p>
            Ten schools that already have a working line, three months, then publish hours sold, revenue, the share of each school’s bill
            it covered, and any incidents.
          </p>
          <p>
            For the finals: the split contract with committee-signed changes, a voucher registry tested against a captive portal on a
            real school router, the village dashboard, and one school shown in both Roll Call (daytime uptime paid to the provider) and
            Afterbell (evening revenue paid to the school).
          </p>
        </Block>
      </main>
      <SiteFooter />
    </>
  );
}
