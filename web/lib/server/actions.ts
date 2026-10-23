import "server-only";
import { keccak256, toBytes, maxUint256, type Hex, type Address, type Account } from "viem";
import { rollCallAbi, testDollarAbi } from "../abi";
import { ROLLCALL, TEST_DOLLAR, publicClient } from "../chain";
import { houseAccount, providerAccount, funderAccount, arbiterAccount, send, walletFor } from "./house";

export type OpenParams = {
  school: string;
  probe: Address;
  asn: number;
  minDownKbps: number;
  minUpKbps: number;
  maxRttMs: number;
  start: number;
  dayLength: number;
  lateWindow: number;
  challengeWindow: number;
  numDays: number;
  required: number;
  strikeLimit: number;
  ratePerDay: bigint;
  bond: bigint;
  slash: bigint;
  challengeDeposit: bigint;
};

export type ReadingInput = {
  termId: bigint;
  takenAt: bigint;
  downKbps: number;
  upKbps: number;
  rttMs: number;
  testId: Hex;
  clientHash: Hex;
};

async function wait(hash: Hex) {
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000, pollingInterval: 1_000 });
  if (r.status !== "success") throw new Error("The transaction reverted on chain.");
  return r;
}

/** Keeps a wallet stocked with test dollars and approved for Roll Call (only the house can mint). */
async function ensureDollars(holder: Account, need: bigint) {
  const [bal, allowance] = await Promise.all([
    publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "balanceOf", args: [holder.address] }),
    publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "allowance", args: [holder.address, ROLLCALL] }),
  ]);
  if (bal < need) {
    const house = houseAccount();
    await send(house, async (nonce) =>
      wait(
        await walletFor(house).writeContract({
          address: TEST_DOLLAR,
          abi: testDollarAbi,
          functionName: "mint",
          args: [holder.address, need * 50n],
          nonce,
        }),
      ),
    );
  }
  if (allowance < need) {
    await send(holder, async (nonce) =>
      wait(
        await walletFor(holder).writeContract({
          address: TEST_DOLLAR,
          abi: testDollarAbi,
          functionName: "approve",
          args: [ROLLCALL, maxUint256],
          nonce,
        }),
      ),
    );
  }
}

/** The funder opens a term; the provider accepts it and posts the bond. Four separate keys, as the contract requires. */
export async function openTerm(p: OpenParams): Promise<{ termId: number; openTx: Hex; acceptTx: Hex }> {
  const funder = funderAccount();
  const provider = providerAccount();
  await ensureDollars(funder, p.ratePerDay * BigInt(p.numDays) + p.challengeDeposit * 4n);
  if (p.bond > 0n) await ensureDollars(provider, p.bond);
  const terms = {
    funder: funder.address,
    provider: provider.address,
    probe: p.probe,
    attester: houseAccount().address,
    arbiter: arbiterAccount().address,
    asn: p.asn,
    minDownKbps: p.minDownKbps,
    minUpKbps: p.minUpKbps,
    maxRttMs: p.maxRttMs,
    start: BigInt(p.start),
    dayLength: p.dayLength,
    lateWindow: p.lateWindow,
    challengeWindow: p.challengeWindow,
    numDays: p.numDays,
    required: p.required,
    strikeLimit: p.strikeLimit,
    ratePerDay: p.ratePerDay,
    bond: p.bond,
    slash: p.slash,
    challengeDeposit: p.challengeDeposit,
  } as const;
  const { openTx, termId } = await send(funder, async (nonce) => {
    const sim = await publicClient.simulateContract({
      account: funder,
      address: ROLLCALL,
      abi: rollCallAbi,
      functionName: "open",
      args: [terms, p.school],
    });
    const h = await walletFor(funder).writeContract({ ...sim.request, nonce });
    await wait(h);
    return { openTx: h, termId: Number(sim.result) };
  });
  try {
    if (Date.now() / 1000 > p.start - 4) throw new Error("The first school day began before the provider could accept.");
    const acceptTx = await send(provider, async (nonce) => {
      const h = await walletFor(provider).writeContract({
        address: ROLLCALL,
        abi: rollCallAbi,
        functionName: "accept",
        args: [BigInt(termId)],
        nonce,
      });
      await wait(h);
      return h;
    });
    return { termId, openTx, acceptTx };
  } catch (e) {
    // never leave a funded term nobody accepted: the funder takes the money back
    await funderCall("withdrawUnaccepted", [BigInt(termId)]).catch(() => {});
    throw e;
  }
}

export async function recordReadings(rs: ReadingInput[], sigs: Hex[], asns: number[], ids: string[]) {
  const house = houseAccount();
  return send(house, async (nonce) => {
    const sim = await publicClient.simulateContract({
      account: house,
      address: ROLLCALL,
      abi: rollCallAbi,
      functionName: "record",
      args: [rs, sigs, asns, ids],
    });
    const h = await walletFor(house).writeContract({ ...sim.request, nonce });
    await wait(h);
    return h;
  });
}

async function call(account: Account, functionName: string, args: readonly unknown[]) {
  return send(account, async (nonce) => {
    const sim = await publicClient.simulateContract({
      account,
      address: ROLLCALL,
      abi: rollCallAbi,
      functionName: functionName as any,
      args: args as any,
    });
    const h = await walletFor(account).writeContract({ ...(sim.request as any), nonce });
    await wait(h);
    return h as Hex;
  });
}
const houseCall = (fn: string, args: readonly unknown[]) => call(houseAccount(), fn, args);
const funderCall = (fn: string, args: readonly unknown[]) => call(funderAccount(), fn, args);

export const settle = (termId: number, upTo: number) => houseCall("settle", [BigInt(termId), upTo]);
export const relayClose = (termId: number, day: number, reason: string, sig: Hex) => houseCall("closeDay", [BigInt(termId), day, reason, sig]);
export const challenge = (termId: number, day: number, evidence: string) => funderCall("challenge", [BigInt(termId), day, evidence]);
export const resolve = (termId: number, day: number, upheld: boolean) => call(arbiterAccount(), "resolve", [BigInt(termId), day, upheld]);
export const terminate = (termId: number) => funderCall("terminate", [BigInt(termId)]);

export async function testUsed(testId: Hex): Promise<boolean> {
  return publicClient.readContract({ address: ROLLCALL, abi: rollCallAbi, functionName: "testUsed", args: [testId] });
}

export const testIdOf = (ids: string) => keccak256(toBytes(ids));
/** The client address is hashed with a salt only the probe holds, so the hash cannot be reversed by trying every address. */
export const clientHashOf = (salt: string, ip: string) => keccak256(toBytes(`${salt}:${ip}`));

/** Which days are ready to settle right now. */
export function settleableUpTo(t: { start: number; dayLength: number; lateWindow: number; challengeWindow: number; numDays: number }, now: number) {
  const last = Math.floor((now - t.start - t.lateWindow - t.challengeWindow) / t.dayLength) - 1;
  return Math.min(last, t.numDays - 1);
}
