import "server-only";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rollCallAbi } from "../abi";
import { DOMAIN, READING_TYPES, CLOSURE_TYPES, ROLLCALL, publicClient } from "../chain";
import {
  SIM_SCHOOLS,
  SIM_DAYS,
  SIM_DAY_SECONDS,
  SIM_REQUIRED,
  SIM_RATE,
  SIM_BOND,
  SIM_SLASH,
  SIM_DEPOSIT,
  SIM_STRIKES,
  SIM_LATE,
  SIM_CHALLENGE,
  SIM_SLA,
  type SimSchool,
} from "../schools";
import { simProbeKey, plainError } from "./house";
import { openTerm, recordReadings, relayClose, settle, challenge, resolve, terminate, settleableUpTo, testIdOf, type ReadingInput } from "./actions";
import { termNames, readTerms, termCount, bust, type TermView } from "./reads";

// One test in each third of a simulated school day (20-minute slots): at 10, 25 and 40 minutes in.
const OFFSETS = [600, 1500, 2400];
const HOTSPOT_ASN = 64999; // a phone hotspot on another network (simulated)

type Pending = { r: ReadingInput; sig: Hex; asn: number; id: string };
type Log = string[];

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

/** How many of the three slots pass on a "slow" day. */
const slowPasses = (day: number) => (day % 2 === 0 ? 1 : 2);

/** The readings a simulated school's probe would have produced for one slot of one day, or null for none. */
function plannedReading(school: SimSchool, t: TermView, day: number, k: number) {
  const script = school.script(day);
  if (script === "closed" || script === "dark") return null; // closed: no testing; dark: the device is off
  const at = t.terms.start + day * t.terms.dayLength + OFFSETS[k] + Math.floor(rand(`${school.key}:${t.id}:${day}:${k}:t`) * 240);
  const sim = `sim:${school.key}:${t.id}:${day}:${k}`;
  if (script === "down") {
    // the probe is on but cannot reach M-Lab: it signs an offline report
    return { at, id: `offline:${sim}`, down: 0, up: 0, rtt: 0, asn: 0 };
  }
  const pass = script === "ok" || script === "hotspot" || script === "fake" || (script === "slow" && k < slowPasses(day));
  const m = simReading(school, t.id, day, k, pass);
  const id = script === "fake" ? `sim:unverifiable:${t.id}:${day}:${k}` : sim;
  return { at, id, down: m.down, up: m.up, rtt: m.rtt, asn: script === "hotspot" ? HOTSPOT_ASN : school.asn };
}

async function runSchool(school: SimSchool, idx: number, latest: TermView | undefined, now: number, log: Log, mayOpen: boolean) {
  const probe = privateKeyToAccount(simProbeKey(idx));
  // open the next term when there is none or the last one ended
  if (!latest || latest.state.ended) {
    if (!mayOpen) return;
    let start = Math.ceil(now / SIM_DAY_SECONDS) * SIM_DAY_SECONDS;
    if (start - now < 120) start += SIM_DAY_SECONDS;
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
      challengeDeposit: SIM_DEPOSIT,
    });
    log.push(`${school.key}: opened term ${r.termId} starting ${new Date(start * 1000).toISOString()}`);
    return;
  }
  const t = latest.terms;
  const tid = latest.id;
  if (now < t.start || latest.state.ended) return;
  const today = Math.min(Math.floor((now - t.start) / t.dayLength), t.numDays);

  // a "fake" day is challenged by the funder once it ends, and the arbiter upholds it
  for (let d = Math.max(0, today - 1); d <= Math.min(today, t.numDays - 1); d++) {
    if (school.script(d) !== "fake") continue;
    const dd = latest.days[d];
    const dayEnd = t.start + (d + 1) * t.dayLength;
    if (!dd || dd.mark !== "Open" || dd.voided || dd.readings === 0 || now < dayEnd) continue;
    let challenged = dd.challenged;
    if (!challenged && now < dayEnd + t.lateWindow + t.challengeWindow) {
      await challenge(tid, d, "Spot check: these 3 test ids are not in M-Lab's public archive (ndt7 tables).");
      log.push(`${school.key}: funder challenged day ${d + 1}`);
      challenged = true;
    }
    if (challenged) {
      await resolve(tid, d, true);
      log.push(`${school.key}: arbiter upheld the challenge on day ${d + 1}`);
    }
  }

  // close today before any testing, if the school is shut
  if (today < t.numDays && school.script(today) === "closed" && !latest.days[today].closed && latest.days[today].readings === 0) {
    const reason = school.closeReason?.(today) ?? "School closed";
    const sig = await probe.signTypedData({
      domain: DOMAIN,
      types: CLOSURE_TYPES,
      primaryType: "Closure",
      message: { termId: BigInt(tid), day: today, reason },
    });
    await relayClose(tid, today, reason, sig);
    log.push(`${school.key}: day ${today + 1} closed (${reason})`);
  }

  // readings due today, and any the previous day missed while its late window is open
  const due: Pending[] = [];
  for (let d = Math.max(0, today - 1); d <= Math.min(today, t.numDays - 1); d++) {
    if (now >= t.start + (d + 1) * t.dayLength + t.lateWindow - 5) continue;
    for (let k = 0; k < OFFSETS.length; k++) {
      const p = plannedReading(school, latest, d, k);
      if (!p || p.at > now) continue;
      const r: ReadingInput = {
        termId: BigInt(tid),
        takenAt: BigInt(p.at),
        downKbps: p.down,
        upKbps: p.up,
        rttMs: p.rtt,
        testId: testIdOf(p.id),
        clientHash: testIdOf(`sim-client:${school.key}`),
      };
      due.push({ r, sig: "0x", asn: p.asn, id: p.id });
    }
  }
  if (!due.length) return;
  const used = await publicClient.multicall({
    contracts: due.map((p) => ({ address: ROLLCALL, abi: rollCallAbi, functionName: "testUsed", args: [p.r.testId] }) as const),
    allowFailure: false,
  });
  const fresh = due.filter((_, i) => !used[i]);
  if (!fresh.length) return;
  for (const p of fresh) {
    p.sig = await probe.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message: p.r });
  }
  await recordReadings(
    fresh.map((p) => p.r),
    fresh.map((p) => p.sig),
    fresh.map((p) => p.asn),
    fresh.map((p) => p.id),
  );
  log.push(`${school.key}: recorded ${fresh.length} reading${fresh.length > 1 ? "s" : ""}`);
}

async function settleTerm(term: TermView, now: number, log: Log) {
  if (!term.state.accepted || term.state.ended) return;
  const upTo = settleableUpTo(term.terms, now);
  // simulated schools settle two days per transaction to halve the gas; visitor terms settle once, at the end
  // (their pages settle each day while a visitor watches); the last day always settles
  const last = term.terms.numDays - 1;
  const need = term.kind === "sim" && upTo < last ? term.state.nextToSettle + 1 : term.kind === "trial" ? last : term.state.nextToSettle;
  if (upTo < need) return;
  const next = term.days[term.state.nextToSettle];
  if (next?.challenged && now < term.terms.start + (term.state.nextToSettle + 1) * term.terms.dayLength + term.terms.lateWindow + 2 * term.terms.challengeWindow) return;
  await settle(term.id, upTo);
  log.push(`term ${term.id}: settled through day ${upTo + 1}`);
}

/** One keeper tick. Safe to run every few minutes and from more than one place. */
export async function keeperTick(opts: { sims?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const log: Log = [];
  const errors: string[] = [];
  bust();
  const [names, count] = await Promise.all([termNames(), termCount()]);
  // if the log index has not caught up with the chain, never open a term: it might already exist
  const mayOpen = names.size >= count;
  const latestByName = new Map<string, number>();
  for (const [id, n] of names) if ((latestByName.get(n.school) ?? 0) < id) latestByName.set(n.school, id);
  const recent = [...names.keys()].filter((id) => id > count - 300);
  const terms = await readTerms(recent);
  const byId = new Map(terms.map((t) => [t.id, t]));

  if (opts.sims !== false) {
    for (let i = 0; i < SIM_SCHOOLS.length; i++) {
      const s = SIM_SCHOOLS[i];
      const id = latestByName.get(s.name);
      try {
        await runSchool(s, i, id ? byId.get(id) : undefined, now, log, mayOpen);
      } catch (e) {
        errors.push(`${s.key}: ${plainError(e)}`);
      }
    }
  }

  bust();
  const open = (await readTerms(terms.filter((t) => !t.state.ended && t.state.accepted).map((t) => t.id))).sort(
    (a, b) => (a.kind === "sim" ? 0 : 1) - (b.kind === "sim" ? 0 : 1) || a.id - b.id,
  );
  const deadline = Date.now() + 40_000; // stay inside the function's time limit
  for (const t of open) {
    if (Date.now() > deadline) {
      log.push("time limit reached; the rest settle next tick");
      break;
    }
    try {
      await settleTerm(t, now, log);
      if (t.kind === "sim") {
        const after = (await readTerms([t.id]))[0];
        if (after && !after.state.ended && after.terms.strikeLimit > 0 && after.state.strikes >= after.terms.strikeLimit) {
          await terminate(t.id).then(
            () => log.push(`term ${t.id}: the funder ended the term after ${after.state.strikes} absent days in a row`),
            (e) => log.push(`term ${t.id}: not ended yet (${plainError(e)})`),
          );
        }
      }
    } catch (e) {
      errors.push(`term ${t.id}: ${plainError(e)}`);
    }
  }
  bust();
  return { now, log, errors };
}
