import "server-only";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DOMAIN, READING_TYPES, CLOSURE_TYPES } from "../chain";
import {
  SIM_SCHOOLS,
  SIM_DAYS,
  SIM_DAY_SECONDS,
  SIM_REQUIRED,
  SIM_RATE,
  SIM_BOND,
  SIM_SLASH,
  SIM_STRIKES,
  SIM_LATE,
  SIM_CHALLENGE,
  SIM_SLA,
  type SimSchool,
} from "../schools";
import { simProbeKey, plainError } from "./house";
import {
  openTerm,
  recordReadings,
  relayClose,
  settle,
  challenge,
  resolve,
  terminate,
  settleableUpTo,
  testIdOf,
  type ReadingInput,
} from "./actions";
import { termNames, readTerms, termCount, bust, type TermView } from "./reads";

const OFFSETS = [600, 1500, 2400]; // readings at 10, 25 and 40 minutes into each simulated school day
const HOTSPOT_ASN = 64999; // a phone hotspot on another network (simulated)

// deterministic noise so a replay of the same day gives the same numbers
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

function simReading(school: SimSchool, termId: number, day: number, k: number, pass: boolean) {
  const r = (x: string) => rand(`${school.key}:${termId}:${day}:${k}:${x}`);
  return pass
    ? { down: Math.round(14_000 + r("d") * 36_000), up: Math.round(3_000 + r("u") * 9_000), rtt: Math.round(22 + r("r") * 60) }
    : { down: Math.round(1_500 + r("d") * 5_500), up: Math.round(400 + r("u") * 1_400), rtt: Math.round(60 + r("r") * 140) };
}

function passesFor(script: string, day: number) {
  if (script === "ok" || script === "hotspot" || script === "fake") return 3;
  if (script === "slow") return day % 2 === 0 ? 1 : 2;
  return 0;
}

type Log = string[];

async function runSchool(school: SimSchool, idx: number, latest: TermView | undefined, now: number, log: Log, mayOpen: boolean) {
  const key = simProbeKey(idx);
  const probe = privateKeyToAccount(key);
  // open the next term when there is none or the last one ended
  if (!latest || latest.state.ended) {
    if (!mayOpen) return { readings: [] as { r: ReadingInput; sig: Hex; asn: number; id: string }[] };
    let start = Math.ceil(now / SIM_DAY_SECONDS) * SIM_DAY_SECONDS;
    if (start - now < 90) start += SIM_DAY_SECONDS;
    const r = await openTerm({
      school: school.name,
      probe: probe.address,
      asn: school.asn,
      ...SIM_SLA,
      start,
      dayLength: SIM_DAY_SECONDS,
      lateWindow: SIM_LATE,
      challengeWindow: SIM_CHALLENGE,
      numDays: SIM_DAYS,
      required: SIM_REQUIRED,
      strikeLimit: SIM_STRIKES,
      ratePerDay: SIM_RATE,
      bond: SIM_BOND,
      slash: SIM_SLASH,
    });
    log.push(`${school.key}: opened term ${r.termId} starting ${new Date(start * 1000).toISOString()}`);
    return { readings: [] as { r: ReadingInput; sig: Hex; asn: number; id: string }[] };
  }
  const t = latest.terms;
  const out: { r: ReadingInput; sig: Hex; asn: number; id: string }[] = [];
  if (now < t.start) return { readings: out };
  const day = Math.floor((now - t.start) / t.dayLength);
  const tid = latest.id;

  // the day before: a "fake" day is challenged and upheld once its late window has passed
  for (let d = Math.max(0, day - 1); d <= Math.min(day, t.numDays - 1); d++) {
    if (school.script(d) !== "fake") continue;
    const dd = latest.days[d];
    const dayEnd = t.start + (d + 1) * t.dayLength;
    if (!dd || dd.mark !== "Open" || dd.voided || dd.readings === 0 || now < dayEnd) continue;
    let challenged = dd.challenged;
    if (!challenged && now < dayEnd + t.lateWindow + t.challengeWindow) {
      await challenge(tid, d, "Spot check: these 3 test ids are not in M-Lab's public archive (ndt7 tables).");
      log.push(`${school.key}: challenged day ${d}`);
      challenged = true;
    }
    if (challenged) {
      await resolve(tid, d, true);
      log.push(`${school.key}: challenge on day ${d} upheld`);
    }
  }

  if (day >= t.numDays || latest.state.ended) return { readings: out };
  const script = school.script(day);
  const dayStart = t.start + day * t.dayLength;
  const dd = latest.days[day];

  if (script === "closed") {
    if (!dd.closed) {
      const reason = school.closeReason?.(day) ?? "School closed";
      const sig = await probe.signTypedData({
        domain: DOMAIN,
        types: CLOSURE_TYPES,
        primaryType: "Closure",
        message: { termId: BigInt(tid), day, reason },
      });
      await relayClose(tid, day, reason, sig);
      log.push(`${school.key}: closed day ${day}`);
    }
    return { readings: out };
  }
  if (script === "down") return { readings: out };

  const passes = passesFor(script, day);
  for (let k = dd.readings; k < OFFSETS.length; k++) {
    const at = dayStart + OFFSETS[k] + Math.floor(rand(`${school.key}:${tid}:${day}:${k}:t`) * 240);
    if (at > now) break;
    const m = simReading(school, tid, day, k, k < passes);
    const uuid = script === "fake" ? `sim:unverifiable:${tid}:${day}:${k}` : `sim:${school.key}:${tid}:${day}:${k}`;
    const r: ReadingInput = {
      termId: BigInt(tid),
      takenAt: BigInt(at),
      downKbps: m.down,
      upKbps: m.up,
      rttMs: m.rtt,
      testId: testIdOf(uuid),
      clientHash: testIdOf(`sim-client:${school.key}`),
    };
    const sig = await probe.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message: r });
    out.push({ r, sig, asn: script === "hotspot" ? HOTSPOT_ASN : school.asn, id: uuid });
  }
  return { readings: out };
}

async function settleAndEnd(term: TermView, now: number, log: Log) {
  if (!term.state.accepted || term.state.ended) return;
  const upTo = settleableUpTo(term.terms, now);
  // simulated schools settle two days per transaction to halve the house's gas; the last day always settles
  const batch = term.kind === "sim" && upTo < term.terms.numDays - 1 ? 1 : 0;
  if (upTo >= term.state.nextToSettle + batch) {
    const next = term.days[term.state.nextToSettle];
    if (next?.challenged) return; // waits for the arbiter
    await settle(term.id, upTo);
    log.push(`term ${term.id}: settled through day ${upTo}`);
  }
}

/** One keeper tick. Safe to run every few minutes and from several places at once. */
export async function keeperTick(opts: { sims?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const log: Log = [];
  const errors: string[] = [];
  bust();
  const [names, count] = await Promise.all([termNames(), termCount()]);
  // if the log index has not caught up with the chain, never open a term: it might already exist
  const mayOpen = names.size >= count;
  const latestByName = new Map<string, number>();
  const openIds: number[] = [];
  for (const [id, n] of names) {
    if ((latestByName.get(n.school) ?? 0) < id) latestByName.set(n.school, id);
    openIds.push(id);
  }
  const terms = await readTerms(openIds.filter((id) => id > Math.max(0, names.size - 400)));
  const byId = new Map(terms.map((t) => [t.id, t]));

  if (opts.sims !== false) {
    const batch: { r: ReadingInput; sig: Hex; asn: number; id: string }[] = [];
    for (let i = 0; i < SIM_SCHOOLS.length; i++) {
      const s = SIM_SCHOOLS[i];
      const id = latestByName.get(s.name);
      try {
        const { readings } = await runSchool(s, i, id ? byId.get(id) : undefined, now, log, mayOpen);
        batch.push(...readings);
      } catch (e) {
        errors.push(`${s.key}: ${plainError(e)}`);
      }
    }
    if (batch.length) {
      try {
        await recordReadings(
          batch.map((b) => b.r),
          batch.map((b) => b.sig),
          batch.map((b) => b.asn),
          batch.map((b) => b.id),
        );
        log.push(`recorded ${batch.length} simulated readings`);
      } catch (e) {
        errors.push(`readings: ${plainError(e)}`);
      }
    }
  }

  bust();
  const fresh = await readTerms(terms.filter((t) => !t.state.ended && t.state.accepted).map((t) => t.id));
  for (const t of fresh) {
    try {
      await settleAndEnd(t, now, log);
      if (t.kind === "sim") {
        const after = (await readTerms([t.id]))[0];
        if (after && !after.state.ended && after.terms.strikeLimit > 0 && after.state.strikes >= after.terms.strikeLimit) {
          await terminate(t.id);
          log.push(`term ${t.id}: funder ended the term after ${after.state.strikes} missed days`);
        }
      }
    } catch (e) {
      errors.push(`term ${t.id}: ${plainError(e)}`);
    }
  }
  bust();
  return { now, log, errors };
}
