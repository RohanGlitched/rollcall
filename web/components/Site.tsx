import Link from "next/link";
import { ROLLCALL, TEST_DOLLAR, addrUrl } from "@/lib/chain";

export const REPO = "https://github.com/RohanGlitched/rollcall";

/** The mark: six fibres in their colour code, one of them cut. */
export function Mark({ size = 28 }: { size?: number }) {
  const cols = ["#3d8bff", "#ff8a2a", "#2fcb74", "#c08a55", "#9fb2c2", "#a585ff"];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect width="28" height="28" rx="7" fill="#0c1a22" />
      {cols.map((c, i) => {
        const y = 5.5 + i * 3.4;
        return i === 1 ? (
          <g key={c}>
            <line x1="5" x2="12" y1={y} y2={y} stroke={c} strokeWidth="2" strokeLinecap="round" />
            <line x1="16" x2="23" y1={y} y2={y} stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
          </g>
        ) : (
          <line key={c} x1="5" x2="23" y1={y} y2={y} stroke={c} strokeWidth="2" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-glass" : "text-ink"}`}>
      <Mark />
      <span className="font-display text-[20px] font-bold tracking-[-0.03em]">Roll Call</span>
    </span>
  );
}

const NAV = [
  { href: "/#register", label: "Register" },
  { href: "/how", label: "How it works" },
  { href: "/why", label: "Why" },
  { href: "/verify", label: "Verify" },
];

export function SiteHeader({ tone = "light" }: { tone?: "light" | "duct" }) {
  const dark = tone === "duct";
  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur ${
        dark ? "border-duct-line/70 bg-duct/85 text-glass" : "border-line bg-ground/85 text-ink"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Roll Call home" className="rounded-sm">
          <Wordmark light={dark} />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[14px] font-medium">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-2 max-md:hidden ${dark ? "text-glass/80 hover:bg-white/5 hover:text-glass" : "text-ink/75 hover:bg-black/[.04] hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/test"
            className={`ml-2 rounded-full px-4 py-2 font-semibold ${dark ? "bg-glass text-duct hover:bg-white" : "bg-ink text-sheet hover:bg-duct-2"}`}
          >
            Be the school
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="duct mt-32">
      <div className="mx-auto max-w-[1280px] px-4 pt-16 pb-10 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark light />
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-glass-muted">
              School internet, paid by the day it works. Built for Web3 for Social Good 2026 (Singapore Management
              University, GSR Foundation, University of Málaga). Runs on Base Sepolia with a test dollar that has no value.
            </p>
          </div>
          {[
            {
              h: "Use it",
              l: [
                ["/test", "Be the school for three minutes"],
                ["/#register", "The live register"],
                ["/terms", "Every term on chain"],
              ],
            },
            {
              h: "Understand it",
              l: [
                ["/how", "How a school day is decided"],
                ["/why", "Why pay by the working day"],
                ["/verify", "Check it yourself"],
              ],
            },
            {
              h: "Source",
              l: [
                [REPO, "Code on GitHub"],
                [addrUrl(ROLLCALL), "Roll Call contract"],
                [addrUrl(TEST_DOLLAR), "Test dollar contract"],
                ["https://www.measurementlab.net/", "Speed tests by M-Lab"],
              ],
            },
          ].map((c) => (
            <div key={c.h}>
              <h2 className="font-sans text-[13px] font-semibold tracking-normal text-glass-muted">{c.h}</h2>
              <ul className="mt-3 space-y-2 text-[14px]">
                {c.l.map(([href, label]) => (
                  <li key={href}>
                    {href.startsWith("http") ? (
                      <a className="text-glass/90 hover:text-white hover:underline" href={href}>
                        {label}
                      </a>
                    ) : (
                      <Link className="text-glass/90 hover:text-white hover:underline" href={href}>
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex gap-[3px]" aria-hidden>
          {["#3d8bff", "#ff8a2a", "#2fcb74", "#c08a55", "#9fb2c2", "#a585ff", "#ff8fb8", "#34d1dd"].map((c) => (
            <span key={c} className="h-[3px] flex-1 rounded-full" style={{ background: c, opacity: 0.8 }} />
          ))}
        </div>
        <p className="mt-6 max-w-4xl text-[12px] leading-relaxed text-glass-muted">
          Simulated schools are labelled as such; they use private network numbers (AS64512 and up) and test ids that start
          with “sim:”. Tests run by visitors and by Probe 0 are real M-Lab tests. M-Lab publishes every test in its open
          archive, including the address it ran from; Roll Call writes only a hash of that address on chain.
        </p>
      </div>
    </footer>
  );
}
