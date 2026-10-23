"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, isAddress, maxUint256, parseUnits, type Address } from "viem";
import { rollCallAbi, testDollarAbi } from "@/lib/abi";
import { ARBITER, HOUSE, ROLLCALL, TEST_DOLLAR, publicClient, txUrl } from "@/lib/chain";
import { connect, waitTx, walletError } from "@/lib/wallet";

type Step = { label: string; state: "wait" | "run" | "done" | "fail"; note?: string; tx?: string };

const nextMidnightIst = () => {
  const now = Date.now() / 1000;
  const ist = 5.5 * 3600;
  return Math.ceil((now + ist) / 86400) * 86400 - ist;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13.5px] font-semibold">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-[12.5px] text-muted">{hint}</span>}
    </label>
  );
}
const input = "w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-[14.5px] outline-none focus:border-ink";

export function FunderConsole() {
  const [me, setMe] = useState<Address | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [f, setF] = useState({
    school: "",
    probe: "",
    provider: "",
    arbiter: ARBITER as string,
    attester: HOUSE as string,
    asn: "",
    down: "10",
    up: "2",
    rtt: "150",
    days: "20",
    parts: "2",
    rate: "12",
    bond: "60",
    slash: "20",
    deposit: "3",
    strikes: "5",
    start: "",
  });
  const [asnName, setAsnName] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    // datetime-local wants the visitor's local wall time
    const d = new Date(nextMidnightIst() * 1000);
    setF((x) => ({ ...x, start: new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }));
  }, []);

  // name the network as the funder types its number
  useEffect(() => {
    const n = Number(f.asn);
    if (!n) return setAsnName(null);
    const c = new AbortController();
    fetch(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${n}&sourceapp=rollcall`, { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setAsnName(j?.data?.holder || null))
      .catch(() => {});
    return () => c.abort();
  }, [f.asn]);

  const total = useMemo(() => {
    try {
      return parseUnits(f.rate || "0", 6) * BigInt(Number(f.days) || 0);
    } catch {
      return 0n;
    }
  }, [f.rate, f.days]);

  async function refreshBalance(a: Address) {
    setBal(await publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "balanceOf", args: [a] }));
  }

  async function onConnect() {
    setErr(null);
    try {
      const { address } = await connect();
      setMe(address);
      await refreshBalance(address);
    } catch (e) {
      setErr(walletError(e));
    }
  }

  async function faucet() {
    if (!me) return;
    setErr(null);
    const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: me }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error);
    else await refreshBalance(me);
  }

  const problems = useMemo(() => {
    const p: string[] = [];
    const addrs = { probe: f.probe, provider: f.provider, arbiter: f.arbiter, attester: f.attester };
    for (const [k, v] of Object.entries(addrs)) if (!isAddress(v)) p.push(`The ${k} address is not valid.`);
    const all = [me, f.probe, f.provider, f.arbiter, f.attester].filter(Boolean).map((x) => String(x).toLowerCase());
    if (new Set(all).size !== all.length) p.push("Each role needs its own key: you (the funder), probe, provider, arbiter and attester must all differ.");
    if (!Number(f.asn)) p.push("Enter the provider’s network number (ASN).");
    if (!(Number(f.days) >= 1 && Number(f.days) <= 400)) p.push("A term is 1 to 400 school days.");
    if (!(Number(f.parts) >= 1 && Number(f.parts) <= 24)) p.push("A day has 1 to 24 parts.");
    if (Number(f.slash) > Number(f.bond)) p.push("The bond cut cannot be larger than the bond.");
    if (!f.school.trim()) p.push("Name the school.");
    if (new Date(f.start).getTime() / 1000 < Date.now() / 1000 + 120) p.push("Start at least two minutes from now, so the provider has time to accept.");
    return p;
  }, [f, me]);

  async function openTerm() {
    if (!me || problems.length) return;
    setErr(null);
    setOpened(null);
    const s: Step[] = [
      { label: "Allow Roll Call to take this term’s test dollars", state: "run" },
      { label: "Open the term: lock the money on chain", state: "wait" },
    ];
    setSteps([...s]);
    const mark = (i: number, st: Step["state"], extra: Partial<Step> = {}) => {
      s[i] = { ...s[i], state: st, ...extra };
      setSteps([...s]);
    };
    try {
      const { wallet } = await connect();
      const allowance = await publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "allowance", args: [me, ROLLCALL] });
      if (allowance < total) {
        const h = await wallet.writeContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "approve", args: [ROLLCALL, maxUint256], chain: undefined, account: me });
        await waitTx(h);
        mark(0, "done", { tx: h });
      } else mark(0, "done", { note: "Already allowed." });
      mark(1, "run");
      const terms = {
        funder: me,
        provider: f.provider as Address,
        probe: f.probe as Address,
        attester: f.attester as Address,
        arbiter: f.arbiter as Address,
        asn: Number(f.asn),
        minDownKbps: Math.round(Number(f.down) * 1000),
        minUpKbps: Math.round(Number(f.up) * 1000),
        maxRttMs: Number(f.rtt),
        start: BigInt(Math.floor(new Date(f.start).getTime() / 1000)),
        dayLength: 86400,
        lateWindow: 3600,
        challengeWindow: 2 * 86400,
        numDays: Number(f.days),
        required: Number(f.parts),
        strikeLimit: Number(f.strikes),
        ratePerDay: parseUnits(f.rate, 6),
        bond: parseUnits(f.bond, 6),
        slash: parseUnits(f.slash, 6),
        challengeDeposit: parseUnits(f.deposit, 6),
      } as const;
      const sim = await publicClient.simulateContract({ account: me, address: ROLLCALL, abi: rollCallAbi, functionName: "open", args: [terms, f.school.trim()] });
      const h = await wallet.writeContract({ ...sim.request, chain: undefined, account: me });
      const rc = await waitTx(h);
      let id: number | null = null;
      for (const l of rc.logs) {
        try {
          const d = decodeEventLog({ abi: rollCallAbi, data: l.data, topics: l.topics as any });
          if (d.eventName === "TermOpened") id = Number((d.args as any).termId);
        } catch {}
      }
      mark(1, "done", { tx: h });
      setOpened(id);
      await refreshBalance(me);
    } catch (e) {
      const i = s.findIndex((x) => x.state === "run");
      if (i >= 0) mark(i, "fail", { note: walletError(e) });
      setErr(walletError(e));
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-8">
        <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
          <h2 className="text-[22px] font-bold">1. Your wallet is the funder</h2>
          {me ? (
            <p className="mt-3 text-[14.5px]">
              Connected as <span className="font-mono text-[13px]">{me}</span>. Test dollars: <b className="tnum">{bal === null ? "…" : (Number(bal) / 1e6).toLocaleString("en-US")}</b>{" "}
              {bal !== null && bal < total && (
                <button onClick={faucet} className="ml-2 rounded-full border border-line-strong px-3 py-1 text-[13px] font-semibold hover:border-ink">
                  Get 2,000 test dollars
                </button>
              )}
            </p>
          ) : (
            <>
              <p className="mt-2 text-[14.5px] text-muted">Any browser wallet on Base Sepolia. Gas is a fraction of a cent of test ETH.</p>
              <button onClick={onConnect} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-[14.5px] font-semibold text-sheet hover:bg-duct-2">
                Connect a wallet
              </button>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
          <h2 className="text-[22px] font-bold">2. The school and the people in the term</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="School">
                <input className={input} value={f.school} onChange={set("school")} placeholder="Government Primary School, Dhanora" maxLength={80} />
              </Field>
            </div>
            <Field label="School probe address" hint="The key on the school’s device. The probe kit makes one.">
              <input className={`${input} font-mono text-[13px]`} value={f.probe} onChange={set("probe")} placeholder="0x…" />
            </Field>
            <Field label="Provider address" hint="Where the daily payments and the bond go.">
              <input className={`${input} font-mono text-[13px]`} value={f.provider} onChange={set("provider")} placeholder="0x…" />
            </Field>
            <Field label="Arbiter" hint="Decides challenges. Defaults to Roll Call’s demo arbiter.">
              <input className={`${input} font-mono text-[13px]`} value={f.arbiter} onChange={set("arbiter")} />
            </Field>
            <Field label="Attester" hint="Roll Call’s attester records readings sent to this site.">
              <input className={`${input} font-mono text-[13px]`} value={f.attester} onChange={set("attester")} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
          <h2 className="text-[22px] font-bold">3. What a working day means</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Field label="Provider’s network (ASN)" hint={asnName ? `RIPEstat: ${asnName}` : "Look it up on the provider’s website or at bgp.he.net."}>
                <input className={input} value={f.asn} onChange={set("asn")} placeholder="9829" inputMode="numeric" />
              </Field>
            </div>
            <Field label="Download at least (Mbps)">
              <input className={input} value={f.down} onChange={set("down")} inputMode="decimal" />
            </Field>
            <Field label="Upload at least (Mbps)">
              <input className={input} value={f.up} onChange={set("up")} inputMode="decimal" />
            </Field>
            <Field label="Round trip at most (ms)">
              <input className={input} value={f.rtt} onChange={set("rtt")} inputMode="numeric" />
            </Field>
            <Field label="Parts of the day" hint="A pass is needed in each.">
              <input className={input} value={f.parts} onChange={set("parts")} inputMode="numeric" />
            </Field>
            <Field label="School days">
              <input className={input} value={f.days} onChange={set("days")} inputMode="numeric" />
            </Field>
            <Field label="First day starts">
              <input className={input} type="datetime-local" value={f.start} onChange={set("start")} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
          <h2 className="text-[22px] font-bold">4. Money</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Field label="Pay per school day (tUSD)">
              <input className={input} value={f.rate} onChange={set("rate")} inputMode="decimal" />
            </Field>
            <Field label="Provider bond (tUSD)">
              <input className={input} value={f.bond} onChange={set("bond")} inputMode="decimal" />
            </Field>
            <Field label="Bond cut per upheld challenge">
              <input className={input} value={f.slash} onChange={set("slash")} inputMode="decimal" />
            </Field>
            <Field label="Your deposit per challenge">
              <input className={input} value={f.deposit} onChange={set("deposit")} inputMode="decimal" />
            </Field>
            <Field label="End after this many absent days in a row">
              <input className={input} value={f.strikes} onChange={set("strikes")} inputMode="numeric" />
            </Field>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="duct rounded-2xl p-6 sm:p-8">
          <p className="text-[13px] text-glass-muted">You lock</p>
          <p className="font-display text-[48px] leading-none font-bold tracking-[-0.04em] text-glass tnum">
            {(Number(total) / 1e6).toLocaleString("en-US")} <span className="font-sans text-[15px] font-medium tracking-normal text-glass-muted">tUSD</span>
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-glass/80">
            {f.days || "?"} school days at {f.rate || "?"} each. Every failed day comes back to you; the provider posts a {f.bond || "?"} tUSD
            bond when it accepts. Readings are checked by the attester and challenges decided by the arbiter you named.
          </p>
          {problems.length > 0 && me && (
            <ul className="mt-5 space-y-1.5 text-[13px] text-[#ffb3ab]">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <button
            onClick={openTerm}
            disabled={!me || problems.length > 0 || (bal !== null && bal < total)}
            className="mt-6 w-full rounded-full bg-glass px-5 py-3.5 text-[15px] font-semibold text-duct hover:bg-white disabled:opacity-50"
          >
            {!me ? "Connect a wallet first" : bal !== null && bal < total ? "Get test dollars first" : "Open the term"}
          </button>
          {steps && (
            <ol className="mt-6 space-y-2.5 text-[14px] text-glass">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className={s.state === "done" ? "text-[#8fe0b0]" : s.state === "fail" ? "text-[#ff8a80]" : s.state === "run" ? "text-glass" : "text-glass-muted"}>
                    {s.state === "done" ? "✓ " : s.state === "fail" ? "! " : s.state === "run" ? "… " : "· "}
                    {s.label}
                  </span>
                  {s.note && <span className="block pl-4 text-[12.5px] text-glass-muted">{s.note}</span>}
                  {s.tx && (
                    <a className="block pl-4 text-[12.5px] text-glass-muted underline" href={txUrl(s.tx)}>
                      transaction
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
          {opened && (
            <p className="mt-5 text-[14.5px] text-glass">
              Term {opened} is open.{" "}
              <Link href={`/term/${opened}`} className="font-semibold underline">
                Send the provider this link to accept it
              </Link>
              .
            </p>
          )}
          {err && <p className="mt-4 text-[13.5px] text-[#ff8a80]">{err}</p>}
        </div>
      </aside>
    </div>
  );
}
