"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";
import { runNdt7, type Ndt7Progress, type Ndt7Result } from "@/lib/ndt7";
import { DOMAIN, READING_TYPES, CLOSURE_TYPES, txUrl } from "@/lib/chain";
import { Strands, StrandLegend } from "@/components/Strands";
import type { TermView, ReadingView, DayEventView } from "@/lib/server/reads";
import { cellState, currentDay, mbps, usd, ago } from "@/lib/days";
import { TRIAL } from "@/lib/schools";

const KEY_STORE = "rollcall.probe.v1";
const TERM_STORE = "rollcall.trial.v2";
const SALT_STORE = "rollcall.salt.v1";

function probeSalt(): string {
  try {
    const s = localStorage.getItem(SALT_STORE);
    if (s && /^[0-9a-f]{32}$/.test(s)) return s;
    const n = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(SALT_STORE, n);
    return n;
  } catch {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

function probeKey(): Hex {
  try {
    const k = localStorage.getItem(KEY_STORE);
    if (k && /^0x[0-9a-f]{64}$/i.test(k)) return k as Hex;
    const n = generatePrivateKey();
    localStorage.setItem(KEY_STORE, n);
    return n;
  } catch {
    return generatePrivateKey();
  }
}

type TermPayload = { term: TermView; readings: ReadingView[] | null; events: DayEventView[] | null; at: number };
type Step = { label: string; state: "wait" | "run" | "done" | "fail"; detail?: React.ReactNode };

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px]">
          <span
            className={`mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              s.state === "done"
                ? "bg-ink text-sheet"
                : s.state === "fail"
                  ? "bg-red text-sheet"
                  : s.state === "run"
                    ? "border-2 border-ink text-ink"
                    : "border border-rule-strong text-pencil"
            }`}
            aria-hidden
          >
            {s.state === "done" ? "✓" : s.state === "fail" ? "!" : i + 1}
          </span>
          <span>
            <span className={s.state === "wait" ? "text-muted" : "text-graphite"}>{s.label}</span>
            {s.state === "run" && <span className="live-dot ml-2 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />}
            {s.detail && <span className="mt-0.5 block text-[13px] text-muted">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Gauge({ p, result }: { p: Ndt7Progress | null; result: Ndt7Result | null }) {
  const phase = result ? "done" : p?.phase ?? "locate";
  const val = result ? null : p?.mbps ?? 0;
  const frac = p && (p.phase === "download" || p.phase === "upload") ? Math.min(1, p.elapsed / 10) : phase === "done" ? 1 : 0;
  return (
    <div className="rounded-md border border-rule bg-sheet p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          {phase === "locate" ? "Finding the nearest M-Lab server" : phase === "download" ? "Download" : phase === "upload" ? "Upload" : "Test finished"}
        </p>
        {result && <p className="text-[12px] text-muted">{result.machine.split(".")[0]}, {result.city}</p>}
      </div>
      {result ? (
        <dl className="mt-2 grid grid-cols-3 gap-3">
          {[
            ["Download", `${mbps(result.downKbps)}`, "Mbps"],
            ["Upload", `${mbps(result.upKbps)}`, "Mbps"],
            ["Round trip", `${result.rttMs}`, "ms"],
          ].map(([l, v, u]) => (
            <div key={l}>
              <dt className="text-[12px] text-muted">{l}</dt>
              <dd className="font-display text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink tnum">
                {v}
                <span className="ml-1 font-sans text-[12px] font-medium text-muted">{u}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 font-display text-[56px] font-bold leading-none tracking-[-0.04em] text-ink tnum">
          {val !== null ? val.toFixed(1) : "—"}
          <span className="ml-2 font-sans text-[14px] font-medium text-muted">Mbps</span>
        </p>
      )}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-rule">
        <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

export function TrialClient() {
  const [network, setNetwork] = useState<{ asn?: number; holder?: string; error?: string } | null>(null);
  const [contract, setContract] = useState<"mine" | "other">("mine");
  const [termId, setTermId] = useState<number | null>(null);
  const [data, setData] = useState<TermPayload | null>(null);
  const [opening, setOpening] = useState<Step[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState<Ndt7Progress | null>(null);
  const [result, setResult] = useState<Ndt7Result | null>(null);
  const [testSteps, setTestSteps] = useState<Step[] | null>(null);
  const [lastTx, setLastTx] = useState<{ kind: string; tx: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [auto, setAuto] = useState(true);
  const settling = useRef(false);
  const autoRan = useRef(new Set<number>());

  // resume an open term after a reload
  useEffect(() => {
    try {
      const t = Number(localStorage.getItem(TERM_STORE));
      if (t > 0) setTermId(t);
    } catch {}
    fetch("/api/network")
      .then((r) => r.json())
      .then(setNetwork)
      .catch(() => setNetwork({ error: "Your network could not be identified." }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 500);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!termId) return;
    try {
      const r = await fetch(`/api/term/${termId}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e) {
      // keep the last good copy on screen
    }
  }, [termId]);

  useEffect(() => {
    if (!termId) return;
    load();
    const id = setInterval(() => !document.hidden && load(), 3000);
    return () => clearInterval(id);
  }, [termId, load]);

  const term = data?.term ?? null;
  const t = term?.terms;

  // settle each day as soon as its windows have passed; anyone may, the house pays the gas
  useEffect(() => {
    if (!term || !t || term.state.ended || settling.current) return;
    const next = term.state.nextToSettle;
    const due = t.start + (next + 1) * t.dayLength + t.lateWindow + t.challengeWindow;
    if (now < due + 2) return;
    settling.current = true;
    fetch("/api/settle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ termId: term.id }) })
      .then((r) => r.json())
      .then((j) => {
        if (j.tx) setLastTx({ kind: `Settled through day ${j.upTo + 1}`, tx: j.tx });
        return load();
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => (settling.current = false), 4000);
      });
  }, [now, term, t, load]);

  async function openTerm() {
    setErr(null);
    const probe = privateKeyToAccount(probeKey()).address;
    setOpening([
      { label: "Making this browser the school’s probe", state: "done", detail: <>Probe key {probe.slice(0, 10)}… kept in this browser only.</> },
      { label: "The funder locks three days of pay; the provider posts its bond", state: "run", detail: "Two transactions on Base Sepolia, paid by the house." },
      { label: "Term opens for the first school day", state: "wait" },
    ]);
    try {
      const r = await fetch("/api/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ probe, contract }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "The term could not be opened.");
      try {
        localStorage.setItem(TERM_STORE, String(j.termId));
      } catch {}
      setOpening([
        { label: "Making this browser the school’s probe", state: "done" },
        {
          label: "The funder locks three days of pay; the provider posts its bond",
          state: "done",
          detail: (
            <>
              <a className="underline" href={txUrl(j.openTx)}>open</a> and <a className="underline" href={txUrl(j.acceptTx)}>accept</a> confirmed.
            </>
          ),
        },
        { label: `Term ${j.termId} contracted to ${j.holder} (AS${j.asn})`, state: "done" },
      ]);
      setTermId(j.termId);
    } catch (e) {
      setOpening(null);
      setErr(e instanceof Error ? e.message : "The term could not be opened.");
    }
  }

  async function runTest() {
    if (!term || !t) return;
    setErr(null);
    setTesting(true);
    setResult(null);
    setProgress(null);
    const steps: Step[] = [
      { label: "Run an M-Lab speed test from this browser", state: "run" },
      { label: "Sign the numbers with the school’s probe key", state: "wait" },
      { label: "Attester checks which network the test ran over", state: "wait" },
      { label: "Contract records the reading", state: "wait" },
    ];
    setTestSteps([...steps]);
    const mark = (i: number, s: Step["state"], detail?: React.ReactNode) => {
      steps[i] = { ...steps[i], state: s, detail: detail ?? steps[i].detail };
      setTestSteps([...steps]);
    };
    try {
      const res = await runNdt7(setProgress);
      setResult(res);
      mark(0, "done", <>M-Lab test id <span className="break-all">{res.uuid}</span></>);
      mark(1, "run");
      const acct = privateKeyToAccount(probeKey());
      const takenAt = Math.max(res.finishedAt, t.start + 1);
      const salt = probeSalt();
      const ids = res.upUuid ? `${res.uuid}|${res.upUuid}` : res.uuid;
      const message = {
        termId: BigInt(term.id),
        takenAt: BigInt(takenAt),
        downKbps: res.downKbps,
        upKbps: res.upKbps,
        rttMs: res.rttMs,
        testId: keccak256(toBytes(ids)),
        clientHash: keccak256(toBytes(`${salt}:${res.clientIp}`)),
      };
      const sig = await acct.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message });
      mark(1, "done", <>Signed by {acct.address.slice(0, 10)}…. Only a salted hash of your address goes on chain.</>);
      mark(2, "run");
      const r = await fetch("/api/reading", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          termId: term.id,
          takenAt,
          downKbps: res.downKbps,
          upKbps: res.upKbps,
          rttMs: res.rttMs,
          uuid: res.uuid,
          upUuid: res.upUuid,
          salt,
          client: res.client,
          machine: res.machine,
          sig,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        mark(2, "fail", j.error);
        throw new Error(j.error || "The reading was refused.");
      }
      mark(2, "done", <>The test ran over {j.holder} (AS{j.asn}). The term is contracted to AS{t.asn}.</>);
      mark(
        3,
        "done",
        <>
          {j.pass ? "It passes the term’s bar." : "It does not pass the term’s bar, so it counts as a failed test."}{" "}
          <a className="underline" href={txUrl(j.tx)}>See the transaction</a>.
        </>,
      );
      setLastTx({ kind: "Reading recorded", tx: j.tx });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The test failed.";
      setErr(msg);
      const i = steps.findIndex((s) => s.state === "run");
      if (i >= 0) mark(i, "fail", msg);
    } finally {
      setTesting(false);
    }
  }

  // run one test at the start of each school day unless the visitor turned it off
  useEffect(() => {
    if (!auto || testing || !term || !t || term.state.ended) return;
    const d = currentDay(term, now);
    if (d < 0 || d >= t.numDays || autoRan.current.has(d)) return;
    const day = term.days[d];
    if (!day || day.closed || day.readings > 0) return;
    if (now - (t.start + d * t.dayLength) < 3) return;
    autoRan.current.add(d);
    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, auto, testing, term]);

  async function closeToday(day: number) {
    if (!term) return;
    setErr(null);
    try {
      const acct = privateKeyToAccount(probeKey());
      const reason = "School closed: power cut";
      const sig = await acct.signTypedData({
        domain: DOMAIN,
        types: CLOSURE_TYPES,
        primaryType: "Closure",
        message: { termId: BigInt(term.id), day, reason },
      });
      const r = await fetch("/api/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ termId: term.id, day, reason, sig }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setLastTx({ kind: `Day ${day + 1} marked closed`, tx: j.tx });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The day could not be closed.");
    }
  }

  function startOver() {
    try {
      localStorage.removeItem(TERM_STORE);
    } catch {}
    setTermId(null);
    setData(null);
    setOpening(null);
    setResult(null);
    setTestSteps(null);
    setLastTx(null);
  }

  // ------------------------------------------------------------------ views

  if (!termId) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
          <h2 className="text-[24px] font-semibold">Open a term for your school</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Demo keys play the funder, the provider, the attester and the arbiter: four separate keys, as the contract requires. The funder locks {usd(TRIAL.rate * BigInt(TRIAL.numDays), 0)} test dollars for{" "}
            {TRIAL.numDays} school days of {TRIAL.dayLength / 60} minutes each, and the provider posts a {usd(TRIAL.bond, 0)} tUSD bond.
            A day is paid when one test passes: at least {TRIAL.sla.minDownKbps / 1000} Mbps down, {TRIAL.sla.minUpKbps / 1000} Mbps up,
            and under {TRIAL.sla.maxRttMs} ms round trip, over the contracted network.
          </p>
          <fieldset className="mt-6 space-y-3">
            <legend className="text-[14px] font-semibold">Which line is this school paying for?</legend>
            <label className={`flex cursor-pointer gap-3 rounded-md border p-4 ${contract === "mine" ? "border-ink bg-ink-wash/50" : "border-rule"}`}>
              <input type="radio" name="contract" className="mt-1 accent-[#0f1b24]" checked={contract === "mine"} onChange={() => setContract("mine")} aria-label="The network you are on" />
              <span>
                <span className="block text-[15px] font-semibold">
                  {network?.holder ? `${network.holder} (AS${network.asn}), the network you are on` : "The network you are on"}
                </span>
                <span className="block text-[13px] text-muted">Your tests should pass and the provider gets paid.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer gap-3 rounded-md border p-4 ${contract === "other" ? "border-ink bg-ink-wash/50" : "border-rule"}`}>
              <input type="radio" name="contract" className="mt-1 accent-[#0f1b24]" checked={contract === "other"} onChange={() => setContract("other")} aria-label="Another provider" />
              <span>
                <span className="block text-[15px] font-semibold">Another provider (AS64999)</span>
                <span className="block text-[13px] text-muted">
                  Like a teacher testing over a phone hotspot: the speed may be fine, but it is not the line that was paid for.
                </span>
              </span>
            </label>
          </fieldset>
          {network?.error && <p className="mt-3 text-[13px] text-amber">{network.error}</p>}
          <label className="mt-6 flex cursor-pointer gap-3 text-[13.5px] leading-snug">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0f1b24]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I understand that M-Lab publishes every speed test it runs, including the IP address it ran from, in its{" "}
              <a className="underline" href="https://www.measurementlab.net/privacy/">open archive</a>. Roll Call writes only a salted
              hash of the address on chain.
            </span>
          </label>
          <button
            onClick={openTerm}
            disabled={!!opening || !consent}
            className="mt-6 w-full rounded-full bg-ink px-5 py-3.5 text-[15px] font-semibold text-sheet hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70"
          >
            {opening ? "Opening the term…" : consent ? "Open the term" : "Tick the box above to open the term"}
          </button>
          {opening && (
            <div className="mt-5">
              <Steps steps={opening} />
            </div>
          )}
          {err && <p className="mt-4 rounded-md bg-red-wash px-4 py-3 text-[14px] text-red">{err}</p>}
        </div>
        <div className="space-y-5 text-[15px] leading-relaxed">
          <h2 className="text-[24px] font-semibold">What happens</h2>
          <ol className="space-y-4">
            {[
              ["Your browser becomes the school’s probe.", "It makes a key and keeps it in this browser. Only that key can sign this school’s readings."],
              ["Each two-minute day, run a speed test.", "A real M-Lab ndt7 test, about 20 seconds. The speeds are the ones M-Lab’s server counted, and M-Lab keeps its own copy in its public archive."],
              ["The network is checked.", "The attester looks up the network of the address M-Lab saw and makes sure you sent the reading from the same one."],
              ["Each day settles on its own.", `${TRIAL.lateWindow + TRIAL.challengeWindow} seconds after a day ends, the contract pays the provider or returns the day to the funder.`],
            ].map(([h, p], i) => (
              <li key={i} className="flex gap-4">
                <span className="font-serif text-[22px] font-semibold leading-none text-margin tnum">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{h}</span>
                  <span className="block text-muted">{p}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-md border border-rule bg-sheet p-4 text-[13px] text-muted">
            M-Lab publishes every test it runs, including the address it ran from, in its open archive, which is what lets
            a funder audit a reading. Roll Call writes only a salted hash of your address on chain.
          </p>
        </div>
      </div>
    );
  }

  if (!term || !t) {
    return (
      <div className="rounded-md border border-rule bg-sheet p-8 text-[15px] text-muted">
        Reading term {termId} from the chain…
        <button onClick={startOver} className="ml-4 text-ink underline">Start a new term instead</button>
      </div>
    );
  }

  const day = currentDay(term, now);
  const inTerm = day >= 0 && day < t.numDays && !term.state.ended;
  const dayEnd = t.start + (day + 1) * t.dayLength;
  const todayState = inTerm ? cellState(term, day, now) : null;
  const closed = todayState && "closed" in todayState && todayState.closed;
  const settleAt = (d: number) => t.start + (d + 1) * t.dayLength + t.lateWindow + t.challengeWindow;
  const evs = data?.events ?? [];

  return (
    <div className="space-y-8">
      <div className="duct rounded-2xl p-5 sm:p-8">
        <Strands terms={[term]} now={now} tone="duct" linkRows={false} />
        <div className="mt-5">
          <StrandLegend />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-sheet p-6">
            {now < t.start ? (
              <>
                <h2 className="text-[22px] font-semibold">The first school day starts in {ago(t.start - now)}</h2>
                <p className="mt-2 text-[15px] text-muted">Get ready to run the first test.</p>
              </>
            ) : inTerm ? (
              <>
                <p className="text-[13px] text-muted">
                  Term {term.id}, contracted to AS{t.asn}
                </p>
                <h2 className="mt-1 text-[24px] font-semibold">
                  Day {day + 1} of {t.numDays}: {ago(dayEnd - now)} left
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  {closed
                    ? "You marked today closed. It will be refunded without a strike against the provider."
                    : "A passing test marks the school present today. Skip it to see an unreported day, or mark the day closed before any test runs."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={runTest}
                    disabled={testing || !!closed}
                    className="rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-sheet hover:bg-ink-soft disabled:opacity-60"
                  >
                    {testing ? "Testing…" : "Run today’s test"}
                  </button>
                  <button
                    onClick={() => closeToday(day)}
                    disabled={testing || !!closed || (todayState && "readings" in todayState ? todayState.readings > 0 : false)}
                    className="rounded-full border border-rule-strong px-6 py-3 text-[15px] font-semibold hover:border-ink hover:text-ink disabled:opacity-50"
                  >
                    Mark today closed
                  </button>
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted">
                  <input type="checkbox" className="h-4 w-4 accent-[#0f1b24]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                  Run a test automatically at the start of each school day (turn off to see a day go unreported)
                </label>
              </>
            ) : (
              <>
                <h2 className="text-[24px] font-semibold">{term.state.ended ? "The term is over" : "School days are over; settling the last day"}</h2>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-[12px] text-muted">Paid to the provider</dt>
                    <dd className="font-serif text-[28px] font-semibold text-ink tnum">{usd(term.state.paid, 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-muted">Returned to the funder</dt>
                    <dd className="font-serif text-[28px] font-semibold text-red tnum">{usd(term.state.refunded, 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-muted">Bond back to provider</dt>
                    <dd className="font-serif text-[28px] font-semibold tnum">{term.state.ended ? usd(BigInt(t.bond) - BigInt(term.state.slashed), 0) : "…"}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/term/${term.id}`} className="rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-sheet hover:bg-ink-soft">
                    See the term’s full record
                  </Link>
                  <button onClick={startOver} className="rounded-full border border-rule-strong px-6 py-3 text-[15px] font-semibold hover:border-ink hover:text-ink">
                    Open another term
                  </button>
                </div>
              </>
            )}
            {err && <p className="mt-4 rounded-md bg-red-wash px-4 py-3 text-[14px] text-red">{err}</p>}
          </div>
          {(testing || result) && <Gauge p={progress} result={result} />}
          {testSteps && (
            <div className="rounded-md border border-rule bg-sheet p-5">
              <Steps steps={testSteps} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-[19px] font-semibold">The term’s days</h3>
          <ul className="space-y-2.5">
            {term.days.map((d, i) => {
              const s = cellState(term, i, now);
              const settled = evs.find((e) => e.kind === "settled" && e.day === i);
              const status =
                settled
                  ? `${settled.mark}: ${usd(settled.paid ?? 0, 0)} paid, ${usd(settled.refunded ?? 0, 0)} returned`
                  : s.kind === "today"
                    ? `In progress, ${s.readings} test${s.readings === 1 ? "" : "s"} so far`
                    : s.kind === "pending"
                      ? now < settleAt(i)
                        ? `Settles in ${ago(settleAt(i) - now)}`
                        : "Settling…"
                      : s.kind === "future"
                        ? `Starts in ${ago(t.start + i * t.dayLength - now)}`
                        : s.kind === "ended"
                          ? "Returned when the term ended"
                          : s.kind;
              return (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-sheet px-4 py-3 text-[14px]">
                  <span className="font-semibold">Day {i + 1}</span>
                  <span className="text-right text-muted">
                    {status}
                    {settled && (
                      <a href={txUrl(settled.tx)} className="ml-2 text-ink underline">
                        tx
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {lastTx && (
            <p className="text-[13px] text-muted">
              Latest: {lastTx.kind}.{" "}
              <a href={txUrl(lastTx.tx)} className="text-ink underline">
                View on Blockscout
              </a>
            </p>
          )}
          {(data?.readings?.length ?? 0) > 0 && (
            <div className="rounded-md border border-rule bg-sheet p-4">
              <h4 className="text-[14px] font-semibold">Readings on chain</h4>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {data!.readings!.map((r) => (
                  <li key={r.testId} className="flex flex-wrap justify-between gap-2">
                    <span>
                      Day {r.day + 1}: {mbps(r.downKbps)}/{mbps(r.upKbps)} Mbps, {r.rttMs} ms over AS{r.asn}
                    </span>
                    <span className={r.pass ? "text-ink" : "text-red"}>{r.pass ? "passed" : "failed"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[13px] text-muted">
            <Link href={`/term/${term.id}`} className="text-ink underline">Full record of term {term.id}</Link>
            <button onClick={startOver} className="ml-4 underline">Start a new term</button>
          </p>
        </div>
      </div>
    </div>
  );
}
