import "server-only";
import { keccak256, toBytes, type Hex, type Address } from "viem";
import { rollCallAbi, testDollarAbi } from "../abi";
import { ROLLCALL, TEST_DOLLAR, publicClient } from "../chain";
import { houseAccount, providerAccount, send, walletFor } from "./house";

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

/** Keeps the house and provider stocked with test dollars (only the house can mint). */
async function ensureDollars(holder: Address, need: bigint) {
  const bal = await publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "balanceOf", args: [holder] });
  if (bal >= need) return;
  const house = houseAccount();
  const amount = need * 20n;
  await send(house, async (nonce) => {
    const h = await walletFor(house).writeContract({
      address: TEST_DOLLAR,
      abi: testDollarAbi,
      functionName: "mint",
      args: [holder, amount],
      nonce,
    });
    return wait(h);
  });
}

/** House opens a term as funder; the house provider wallet accepts it and posts the bond. */
export async function openTerm(p: OpenParams): Promise<{ termId: number; openTx: Hex; acceptTx: Hex }> {
  const house = houseAccount();
  const provider = providerAccount();
  await ensureDollars(house.address, p.ratePerDay * BigInt(p.numDays));
  if (p.bond > 0n) await ensureDollars(provider.address, p.bond);
  const terms = {
    funder: house.address,
    provider: provider.address,
    probe: p.probe,
    arbiter: house.address,
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
  } as const;
  const { openTx, termId } = await send(house, async (nonce) => {
    const sim = await publicClient.simulateContract({
      account: house,
      address: ROLLCALL,
      abi: rollCallAbi,
      functionName: "open",
      args: [terms, p.school],
    });
    const h = await walletFor(house).writeContract({ ...sim.request, nonce });
    await wait(h);
    return { openTx: h, termId: Number(sim.result) };
  });
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

async function houseCall(functionName: "settle" | "closeDay" | "challenge" | "resolve" | "terminate", args: readonly unknown[]) {
  const house = houseAccount();
  return send(house, async (nonce) => {
    const sim = await publicClient.simulateContract({
      account: house,
      address: ROLLCALL,
      abi: rollCallAbi,
      functionName,
      args: args as any,
    });
    const h = await walletFor(house).writeContract({ ...(sim.request as any), nonce });
    await wait(h);
    return h as Hex;
  });
}

export const settle = (termId: number, upTo: number) => houseCall("settle", [BigInt(termId), upTo]);
export const relayClose = (termId: number, day: number, reason: string, sig: Hex) =>
  houseCall("closeDay", [BigInt(termId), day, reason, sig]);
export const challenge = (termId: number, day: number, evidence: string) => houseCall("challenge", [BigInt(termId), day, evidence]);
export const resolve = (termId: number, day: number, upheld: boolean) => houseCall("resolve", [BigInt(termId), day, upheld]);
export const terminate = (termId: number) => houseCall("terminate", [BigInt(termId)]);

export const testIdOf = (uuid: string) => keccak256(toBytes(uuid));
export const clientHashOf = (ip: string) => keccak256(toBytes(ip));

/** Which days are ready to settle right now. */
export function settleableUpTo(t: { start: number; dayLength: number; lateWindow: number; challengeWindow: number; numDays: number }, now: number) {
  const last = Math.floor((now - t.start - t.lateWindow - t.challengeWindow) / t.dayLength) - 1;
  return Math.min(last, t.numDays - 1);
}
