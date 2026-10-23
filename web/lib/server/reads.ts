import "server-only";
import { createPublicClient, decodeEventLog, encodeEventTopics, http, numberToHex, pad, type Hex, type Log } from "viem";
import { rollCallAbi } from "../abi";
import { CHAIN, DEPLOY_BLOCK, EXPLORER, MARKS, ROLLCALL, publicClient, type MarkName } from "../chain";

// sepolia.base.org caps eth_getLogs at 200 blocks; publicnode allows a few thousand.
const logsClient = createPublicClient({ chain: CHAIN, transport: http(process.env.LOGS_RPC || "https://base-sepolia-rpc.publicnode.com", { timeout: 15_000, retryCount: 2 }) });
import { kindOf, type TermKind } from "../schools";

export type TermView = {
  id: number;
  school: string;
  kind: TermKind;
  openedTx?: string;
  terms: {
    funder: string;
    provider: string;
    probe: string;
    attester: string;
    arbiter: string;
    asn: number;
    minDownKbps: number;
    minUpKbps: number;
    maxRttMs: number;
    start: number;
    dayLength: number;
    schoolHours: number;
    lateWindow: number;
    challengeWindow: number;
    numDays: number;
    required: number;
    strikeLimit: number;
    ratePerDay: string;
    bond: string;
    slash: string;
    challengeDeposit: string;
  };
  state: {
    escrow: string;
    bondHeld: string;
    paid: string;
    refunded: string;
    slashed: string;
    settledDays: number;
    nextToSettle: number;
    strikes: number;
    accepted: boolean;
    ended: boolean;
  };
  days: { readings: number; passes: number; slotMask: number; mark: MarkName; closed: boolean; challenged: boolean; voided: boolean }[];
  /** Set when the register shows this finished term while the newer one (this id) is in its first hours. */
  showingPrevious?: number;
};

export type ReadingView = {
  termId: number;
  day: number;
  takenAt: number;
  downKbps: number;
  upKbps: number;
  rttMs: number;
  asn: number;
  pass: boolean;
  testId: string;
  tx: string;
  block: number;
};

export type DayEventView = {
  termId: number;
  day: number;
  kind: "settled" | "closed" | "challenged" | "resolved";
  mark?: MarkName;
  paid?: string;
  refunded?: string;
  reason?: string;
  upheld?: boolean;
  tx: string;
  block: number;
};

// ------------------------------------------------------------------ logs

const topic0 = (name: "TermOpened" | "ReadingRecorded" | "DaySettled" | "DayClosed" | "DayChallenged" | "ChallengeResolved") =>
  encodeEventTopics({ abi: rollCallAbi, eventName: name })[0] as Hex;

type RawLog = { topics: Hex[]; data: Hex; blockNumber: bigint; transactionHash: Hex };

// One in-memory index of every log the contract has emitted, synced incrementally from the RPC.
// publicnode answers eth_getLogs over 50,000 blocks (~28 h on Base), so a cold start reads the whole
// history in a few dozen parallel calls and every later read costs one call for the new blocks.
const RANGE = 49_999n;
const index: { last: bigint; logs: RawLog[]; at: number; running: Promise<void> | null } = {
  last: DEPLOY_BLOCK - 1n,
  logs: [],
  at: 0,
  running: null,
};

async function fetchRange(a: bigint, b: bigint): Promise<RawLog[]> {
  for (let i = 0; ; i++) {
    try {
      const logs = (await logsClient.request({
        method: "eth_getLogs",
        params: [{ address: ROLLCALL, fromBlock: numberToHex(a), toBlock: numberToHex(b) }],
      })) as unknown as (Log & { topics: Hex[] })[];
      return logs.map((l) => ({ topics: l.topics, data: l.data, blockNumber: BigInt(l.blockNumber!), transactionHash: l.transactionHash! }));
    } catch (e) {
      if (i >= 2) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

async function sync(): Promise<void> {
  if (index.running) return index.running;
  if (Date.now() - index.at < 2_500) return;
  index.running = (async () => {
    const latest = await logsClient.getBlockNumber();
    const ranges: [bigint, bigint][] = [];
    for (let a = index.last + 1n; a <= latest; a += RANGE + 1n) ranges.push([a, a + RANGE > latest ? latest : a + RANGE]);
    const out: RawLog[][] = [];
    for (let i = 0; i < ranges.length; i += 6) {
      out.push(...(await Promise.all(ranges.slice(i, i + 6).map(([a, b]) => fetchRange(a, b)))));
    }
    for (const chunk of out) index.logs.push(...chunk);
    index.last = latest;
    index.at = Date.now();
  })().finally(() => {
    index.running = null;
  });
  return index.running;
}

/** Logs matching topic0 (and topic1 when given), from the in-memory index. */
async function getLogs(t0: Hex, t1?: Hex): Promise<RawLog[]> {
  await sync();
  const a = t0.toLowerCase();
  const b = t1?.toLowerCase();
  return index.logs.filter((l) => l.topics[0]?.toLowerCase() === a && (!b || l.topics[1]?.toLowerCase() === b));
}

const termTopic = (id: number) => pad(numberToHex(id), { size: 32 });

// ----------------------------------------------------------------- cache

const memo = new Map<string, { at: number; v: Promise<unknown> }>();
function cached<T>(k: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(k);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as Promise<T>;
  const v = fn();
  memo.set(k, { at: Date.now(), v });
  v.catch(() => memo.delete(k));
  return v;
}
export const bust = (prefix = "") => {
  for (const k of memo.keys()) if (k.startsWith(prefix)) memo.delete(k);
};

// --------------------------------------------------------------- reads

export function termNames(): Promise<Map<number, { school: string; tx: string; block: number }>> {
  return cached("names", 15_000, async () => {
    const logs = await getLogs(topic0("TermOpened"));
    const m = new Map<number, { school: string; tx: string; block: number }>();
    for (const l of logs) {
      const d = decodeEventLog({ abi: rollCallAbi, eventName: "TermOpened", topics: l.topics as any, data: l.data });
      m.set(Number(d.args.termId), { school: d.args.school, tx: l.transactionHash, block: Number(l.blockNumber) });
    }
    return m;
  });
}

function shapeTerm(id: number, school: string, tx: string | undefined, t: any, s: any, days: any[]): TermView {
  return {
    id,
    school,
    kind: kindOf(school),
    openedTx: tx,
    terms: {
      funder: t.funder,
      provider: t.provider,
      probe: t.probe,
      attester: t.attester,
      arbiter: t.arbiter,
      asn: Number(t.asn),
      minDownKbps: Number(t.minDownKbps),
      minUpKbps: Number(t.minUpKbps),
      maxRttMs: Number(t.maxRttMs),
      start: Number(t.start),
      dayLength: Number(t.dayLength),
      schoolHours: Number(t.schoolHours),
      lateWindow: Number(t.lateWindow),
      challengeWindow: Number(t.challengeWindow),
      numDays: Number(t.numDays),
      required: Number(t.required),
      strikeLimit: Number(t.strikeLimit),
      ratePerDay: String(t.ratePerDay),
      bond: String(t.bond),
      slash: String(t.slash),
      challengeDeposit: String(t.challengeDeposit),
    },
    state: {
      escrow: String(s.escrow),
      bondHeld: String(s.bondHeld),
      paid: String(s.paid),
      refunded: String(s.refunded),
      slashed: String(s.slashed),
      settledDays: Number(s.settledDays),
      nextToSettle: Number(s.nextToSettle),
      strikes: Number(s.strikes),
      accepted: s.accepted,
      ended: s.ended,
    },
    days: days.map((d: any) => ({
      readings: Number(d.readings),
      passes: Number(d.passes),
      slotMask: Number(d.slotMask),
      mark: MARKS[Number(d.mark)] ?? "Open",
      closed: d.closed,
      challenged: d.challenged,
      voided: d.voided,
    })),
  };
}

export async function readTerms(ids: number[]): Promise<TermView[]> {
  if (!ids.length) return [];
  const names = await termNames();
  const calls = ids.flatMap((id) => [
    { address: ROLLCALL, abi: rollCallAbi, functionName: "terms", args: [BigInt(id)] } as const,
    { address: ROLLCALL, abi: rollCallAbi, functionName: "state", args: [BigInt(id)] } as const,
    { address: ROLLCALL, abi: rollCallAbi, functionName: "register", args: [BigInt(id)] } as const,
  ]);
  const res = await publicClient.multicall({ contracts: calls, allowFailure: true });
  const out: TermView[] = [];
  ids.forEach((id, i) => {
    const [t, s, r] = [res[i * 3], res[i * 3 + 1], res[i * 3 + 2]];
    if (t.status !== "success" || s.status !== "success" || r.status !== "success") return;
    if (/^0x0{40}$/i.test((t.result as any).funder)) return; // no such term: the contract returns zeros
    const n = names.get(id);
    out.push(shapeTerm(id, n?.school ?? `Term ${id}`, n?.tx, t.result, s.result, r.result as any[]));
  });
  return out;
}

export function readTerm(id: number): Promise<TermView | null> {
  return cached(`term:${id}`, 3_000, async () => (await readTerms([id]))[0] ?? null);
}

export function termCount(): Promise<number> {
  return cached("count", 5_000, async () =>
    Number(await publicClient.readContract({ address: ROLLCALL, abi: rollCallAbi, functionName: "termCount" })),
  );
}

export function readingsFor(id: number): Promise<ReadingView[]> {
  return cached(`readings:${id}`, 4_000, async () => {
    const logs = await getLogs(topic0("ReadingRecorded"), termTopic(id));
    return logs
      .map((l) => {
        const d = decodeEventLog({ abi: rollCallAbi, eventName: "ReadingRecorded", topics: l.topics as any, data: l.data });
        return {
          termId: Number(d.args.termId),
          day: Number(d.args.day),
          takenAt: Number(d.args.takenAt),
          downKbps: Number(d.args.downKbps),
          upKbps: Number(d.args.upKbps),
          rttMs: Number(d.args.rttMs),
          asn: Number(d.args.asn),
          pass: d.args.pass,
          testId: d.args.mlabTestId,
          tx: l.transactionHash,
          block: Number(l.blockNumber),
        };
      })
      .sort((a, b) => b.takenAt - a.takenAt);
  });
}

export function dayEventsFor(id: number): Promise<DayEventView[]> {
  return cached(`dayev:${id}`, 4_000, async () => {
    const t1 = termTopic(id);
    const [settled, closed, challenged, resolved] = await Promise.all([
      getLogs(topic0("DaySettled"), t1),
      getLogs(topic0("DayClosed"), t1),
      getLogs(topic0("DayChallenged"), t1),
      getLogs(topic0("ChallengeResolved"), t1),
    ]);
    const out: DayEventView[] = [];
    for (const l of settled) {
      const d = decodeEventLog({ abi: rollCallAbi, eventName: "DaySettled", topics: l.topics as any, data: l.data });
      out.push({
        termId: id,
        day: Number(d.args.day),
        kind: "settled",
        mark: MARKS[Number(d.args.mark)],
        paid: String(d.args.paid),
        refunded: String(d.args.refunded),
        tx: l.transactionHash,
        block: Number(l.blockNumber),
      });
    }
    for (const l of closed) {
      const d = decodeEventLog({ abi: rollCallAbi, eventName: "DayClosed", topics: l.topics as any, data: l.data });
      out.push({ termId: id, day: Number(d.args.day), kind: "closed", reason: d.args.reason, tx: l.transactionHash, block: Number(l.blockNumber) });
    }
    for (const l of challenged) {
      const d = decodeEventLog({ abi: rollCallAbi, eventName: "DayChallenged", topics: l.topics as any, data: l.data });
      out.push({ termId: id, day: Number(d.args.day), kind: "challenged", reason: d.args.evidence, tx: l.transactionHash, block: Number(l.blockNumber) });
    }
    for (const l of resolved) {
      const d = decodeEventLog({ abi: rollCallAbi, eventName: "ChallengeResolved", topics: l.topics as any, data: l.data });
      out.push({ termId: id, day: Number(d.args.day), kind: "resolved", upheld: d.args.upheld, tx: l.transactionHash, block: Number(l.blockNumber) });
    }
    return out.sort((a, b) => a.block - b.block);
  });
}

/** Everything the home page needs: each simulated school's term, the real probe, recent visitor terms.
 * For the first six hours of a new simulated term the register shows the one that just finished, so a
 * visitor never lands on a row of empty strands. */
export function overview() {
  return cached("overview", 6_000, async () => {
    const names = await termNames();
    const bySchool = new Map<string, number[]>();
    const trials: number[] = [];
    for (const [id, n] of names) {
      const k = kindOf(n.school);
      if (k === "trial") trials.push(id);
      else if (k === "sim" || k === "real") bySchool.set(n.school, [...(bySchool.get(n.school) ?? []), id]);
    }
    const pairs = [...bySchool.values()].map((ids) => ids.sort((a, b) => b - a).slice(0, 2));
    const recentTrials = trials.sort((a, b) => b - a).slice(0, 6);
    const read = await readTerms([...pairs.flat(), ...recentTrials]);
    const byId = new Map(read.map((t) => [t.id, t]));
    const now = Math.floor(Date.now() / 1000);
    const chosen: TermView[] = [];
    for (const [latest, prev] of pairs) {
      const L = byId.get(latest);
      const P = prev ? byId.get(prev) : undefined;
      if (!L) continue;
      const young = L.kind === "sim" && now - L.terms.start < 6 * 3600;
      chosen.push(young && P ? { ...P, showingPrevious: L.id } : L);
    }
    for (const id of recentTrials) {
      const t = byId.get(id);
      if (t) chosen.push(t);
    }
    const totals = { terms: names.size, trials: trials.length };
    const latestReal = await latestRealReading().catch(() => null);
    return { terms: chosen, totals, latestReal, at: now };
  });
}

/** The newest reading that came from a real M-Lab test (not a simulated school). */
export async function latestRealReading(): Promise<(ReadingView & { school: string }) | null> {
  const logs = await getLogs(topic0("ReadingRecorded"));
  const names = await termNames();
  for (let i = logs.length - 1; i >= 0 && i >= logs.length - 400; i--) {
    const l = logs[i];
    const d = decodeEventLog({ abi: rollCallAbi, eventName: "ReadingRecorded", topics: l.topics as any, data: l.data });
    if (d.args.mlabTestId.startsWith("sim:") || d.args.mlabTestId.startsWith("offline:")) continue;
    const termId = Number(d.args.termId);
    return {
      termId,
      day: Number(d.args.day),
      takenAt: Number(d.args.takenAt),
      downKbps: Number(d.args.downKbps),
      upKbps: Number(d.args.upKbps),
      rttMs: Number(d.args.rttMs),
      asn: Number(d.args.asn),
      pass: d.args.pass,
      testId: d.args.mlabTestId,
      tx: l.transactionHash,
      block: Number(l.blockNumber),
      school: names.get(termId)?.school ?? `Term ${termId}`,
    };
  }
  return null;
}
