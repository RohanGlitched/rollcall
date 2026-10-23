import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, PageHero, REPO } from "@/components/Site";
import { ProbeKit } from "./ProbeKit";

export const metadata: Metadata = {
  title: "Probe kit",
  description: "Turn any computer that stays on in a school into a Roll Call probe: real M-Lab tests in each part of the school day, signed, with offline reports when the line is down.",
};

const pre = "thin-scroll overflow-x-auto rounded-xl bg-graphite px-5 py-4 font-mono text-[13px] leading-relaxed text-sheet";

export default function ProbePage() {
  return (
    <>
      <PageHero
        title="Probe kit"
        lede={
          <>
            Any computer that stays on in the school can be its probe: the lab PC, the office laptop, a Raspberry Pi. Open this page
            on it, give the address below to the funder, and keep the tab open. Funders open the term on{" "}
            <Link className="underline decoration-glass/40 underline-offset-4 hover:decoration-glass" href="/open">
              Open a term
            </Link>
            .
          </>
        }
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-8">
        <ProbeKit />
        <section className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[28px] font-bold">Without a browser: a server or a Raspberry Pi</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
              The same probe as a Node 22 script. It runs one test, signs it and sends it; a scheduler runs it once in each part of
              the school day. Probe 0 runs exactly this, four times a day.
            </p>
            <pre className={`${pre} mt-5`}>{`git clone ${REPO}
cd rollcall/web && npm install
npx esbuild scripts/probe0.ts --bundle --platform=node \
  --format=esm --outfile=probe.mjs

# one key and one salt per school, kept on the device
export PROBE_KEY=0x…  SALT=…  TERM_ID=…
node probe.mjs`}</pre>
          </div>
          <div>
            <h2 className="text-[28px] font-bold">Schedule it</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
              Linux cron, four parts of a school day starting at 08:00:
            </p>
            <pre className={`${pre} mt-5`}>{`0 8,10,12,14 * * *  cd ~/probe && node probe.mjs >> probe.log 2>&1`}</pre>
            <p className="mt-5 text-[15.5px] leading-relaxed text-muted">Windows Task Scheduler (Probe 1 runs this way):</p>
            <pre className={`${pre} mt-3`}>{`schtasks /Create /SC DAILY /ST 10:00 /TN "Roll Call probe" ^
  /TR "cmd /c C:\probe\run.cmd"`}</pre>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
