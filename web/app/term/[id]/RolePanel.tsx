"use client";

import { useState } from "react";
import { maxUint256, type Address } from "viem";
import { rollCallAbi, testDollarAbi } from "@/lib/abi";
import { ROLLCALL, TEST_DOLLAR, publicClient, txUrl } from "@/lib/chain";
import { connect, waitTx, walletError } from "@/lib/wallet";
import type { TermView } from "@/lib/server/reads";
import { usd } from "@/lib/days";

/** Lets whoever holds a role in this term act on it with their own wallet. */
export function RolePanel({ term, now, onDone }: { term: TermView; now: number; onDone: () => void }) {
  const [me, setMe] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);
  const [day, setDay] = useState<number>(0);
  const [evidence, setEvidence] = useState("Test ids not found in M-Lab’s public archive.");
  const t = term.terms;
  const lc = (a: string) => a.toLowerCase();
  const roles = me
    ? (["funder", "provider", "arbiter", "attester", "probe"] as const).filter((r) => lc(t[r]) === lc(me))
    : [];
  const dayEnd = (d: number) => t.start + (d + 1) * t.dayLength;
  const challengeable = term.days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => d.mark === "Open" && !d.challenged && !d.voided && now >= dayEnd(i) && now < dayEnd(i) + t.lateWindow + t.challengeWindow);
  const pending = term.days.map((d, i) => ({ d, i })).filter(({ d }) => d.challenged);

  async function act(label: string, fn: (w: Awaited<ReturnType<typeof connect>>) => Promise<`0x${string}`>) {
    setBusy(label);
    setMsg(null);
    try {
      const c = await connect();
      const h = await fn(c);
      await waitTx(h);
      setMsg({ ok: true, text: `${label}: done.`, tx: h });
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: walletError(e) });
    } finally {
      setBusy(null);
    }
  }

  const call = (fn: string, args: readonly unknown[]) => async ({ wallet, address }: Awaited<ReturnType<typeof connect>>) => {
    const sim = await publicClient.simulateContract({ account: address, address: ROLLCALL, abi: rollCallAbi, functionName: fn as any, args: args as any });
    return wallet.writeContract({ ...(sim.request as any), chain: undefined, account: address });
  };

  async function ensureAllowance(c: Awaited<ReturnType<typeof connect>>, need: bigint) {
    const a = await publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "allowance", args: [c.address, ROLLCALL] });
    if (a >= need) return;
    const h = await c.wallet.writeContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "approve", args: [ROLLCALL, maxUint256], chain: undefined, account: c.address });
    await waitTx(h);
  }

  const btn = "rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-sheet hover:bg-duct-2 disabled:opacity-50";
  return (
    <section className="rounded-2xl border border-line bg-sheet p-6 sm:p-8">
      <h2 className="text-[22px] font-bold">Act on this term</h2>
      {!me ? (
        <>
          <p className="mt-2 max-w-2xl text-[14.5px] text-muted">
            The funder, provider and arbiter of a term can act on it from their own wallets. Anyone can settle finished days.
          </p>
          <button
            className={`${btn} mt-4`}
            onClick={async () => {
              try {
                setMe((await connect()).address);
              } catch (e) {
                setMsg({ ok: false, text: walletError(e) });
              }
            }}
          >
            Connect a wallet
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-5 text-[14.5px]">
          <p>
            Connected as <span className="font-mono text-[13px]">{me}</span>
            {roles.length ? `: the ${roles.join(" and ")} of this term.` : ". This wallet has no role in this term, but it can settle finished days."}
          </p>

          {roles.includes("provider") && !term.state.accepted && !term.state.ended && (
            <div>
              <p>
                Accept the terms and post the {usd(t.bond, 0)} tUSD bond{now >= t.start ? " (too late: the first day has started)" : ""}.
              </p>
              <button
                className={`${btn} mt-2`}
                disabled={!!busy || now >= t.start}
                onClick={() =>
                  act("Accept", async (c) => {
                    await ensureAllowance(c, BigInt(t.bond));
                    return call("accept", [BigInt(term.id)])(c);
                  })
                }
              >
                {busy === "Accept" ? "Accepting…" : "Accept the term"}
              </button>
            </div>
          )}

          {roles.includes("funder") && !term.state.accepted && !term.state.ended && (
            <button className={btn} disabled={!!busy} onClick={() => act("Withdraw", call("withdrawUnaccepted", [BigInt(term.id)]))}>
              Take the money back (not accepted)
            </button>
          )}

          {roles.includes("funder") && !term.state.ended && challengeable.length > 0 && (
            <div className="space-y-2">
              <p>
                Challenge a finished day before it settles. You stake {usd(t.challengeDeposit, 0)} tUSD, returned if the arbiter upholds it.
              </p>
              <div className="flex flex-wrap gap-2">
                <select className="rounded-lg border border-line-strong bg-white px-3 py-2" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                  {challengeable.map(({ i }) => (
                    <option key={i} value={i}>
                      Day {i + 1}
                    </option>
                  ))}
                </select>
                <input className="min-w-[260px] flex-1 rounded-lg border border-line-strong bg-white px-3 py-2" value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={200} />
                <button
                  className={btn}
                  disabled={!!busy}
                  onClick={() =>
                    act("Challenge", async (c) => {
                      await ensureAllowance(c, BigInt(t.challengeDeposit));
                      return call("challenge", [BigInt(term.id), challengeable.find((x) => x.i === day)?.i ?? challengeable[0].i, evidence])(c);
                    })
                  }
                >
                  Challenge
                </button>
              </div>
            </div>
          )}

          {roles.includes("funder") && !term.state.ended && t.strikeLimit > 0 && term.state.strikes >= t.strikeLimit && (
            <button className={btn} disabled={!!busy} onClick={() => act("End the term", call("terminate", [BigInt(term.id)]))}>
              End the term ({term.state.strikes} absent days in a row)
            </button>
          )}

          {roles.includes("arbiter") &&
            pending.map(({ i }) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span>Day {i + 1} is challenged.</span>
                <button className={btn} disabled={!!busy} onClick={() => act("Uphold", call("resolve", [BigInt(term.id), i, true]))}>
                  Uphold
                </button>
                <button className={btn} disabled={!!busy} onClick={() => act("Reject", call("resolve", [BigInt(term.id), i, false]))}>
                  Reject
                </button>
              </div>
            ))}

          {term.state.accepted && !term.state.ended && (
            <button
              className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] font-semibold hover:border-ink disabled:opacity-50"
              disabled={!!busy}
              onClick={() => act("Settle", call("settle", [BigInt(term.id), t.numDays - 1]))}
            >
              Settle finished days
            </button>
          )}
        </div>
      )}
      {msg && (
        <p className={`mt-4 text-[14px] ${msg.ok ? "text-paid" : "text-fault"}`}>
          {msg.text}{" "}
          {msg.tx && (
            <a className="underline" href={txUrl(msg.tx)}>
              transaction
            </a>
          )}
        </p>
      )}
    </section>
  );
}
