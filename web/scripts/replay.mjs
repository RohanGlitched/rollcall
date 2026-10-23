// A whole simulated term in 24 minutes: six "Replay:" terms with one-minute school days, driven on chain.
// Same scripts as the live simulated schools (lib/schools.ts), same contract, faster clock.
// node scripts/replay.mjs
import { createPublicClient, createWalletClient, http, keccak256, toBytes, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "node:fs";

const W = JSON.parse(readFileSync(new URL("../../keys/wallets.json", import.meta.url)));
const abiSrc = readFileSync(new URL("../lib/abi.ts", import.meta.url), "utf8");
const rollCallAbi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.indexOf("] as const") + 1));
const RC = "0xD4EDf73a6604840986C32339A96c8E59cB915984";
const DOMAIN = { name: "Roll Call", version: "3", chainId: 84532, verifyingContract: RC };
const READING_TYPES = {
  Reading: [
    { name: "termId", type: "uint256" }, { name: "takenAt", type: "uint64" }, { name: "downKbps", type: "uint32" },
    { name: "upKbps", type: "uint32" }, { name: "rttMs", type: "uint32" }, { name: "testId", type: "bytes32" }, { name: "clientHash", type: "bytes32" },
  ],
};
const CLOSURE_TYPES = { Closure: [{ name: "termId", type: "uint256" }, { name: "fromDay", type: "uint16" }, { name: "toDay", type: "uint16" }, { name: "reason", type: "string" }] };

// the six schools' scripts, as in lib/schools.ts
const SCHOOLS = [
  { key: "plains", name: "Town primary school, Kheda", asn: 64512, script: (d) => (d === 9 ? "slow" : "ok") },
  { key: "hill", name: "Hill primary school, Chamoli", asn: 64513, script: (d) => (d >= 7 ? "down" : "ok") },
  { key: "island", name: "River-island school, Majuli", asn: 64514, script: (d) => (d === 5 || d === 6 || d === 15 ? "closed" : d === 11 || d === 12 ? "dark" : d % 7 === 3 ? "slow" : "ok"), close: { 5: [5, 6, "School closed: flooding on the ferry route"], 15: [15, 15, "School closed: flood warning"] } },
  { key: "forest", name: "Ashram school, Gumla", asn: 64515, script: (d) => (d % 5 === 0 ? "ok" : d % 3 === 0 ? "down" : "slow") },
  { key: "coast", name: "Coastal school, Kendrapara", asn: 64516, script: (d) => (d === 4 || d === 13 || d === 14 ? "hotspot" : d === 20 ? "closed" : "ok"), close: { 20: [20, 20, "School closed: cyclone warning"] } },
  { key: "desert", name: "Government school, Barmer", asn: 64517, script: (d) => (d === 9 ? "fake" : d === 17 ? "down" : "ok") },
];
const DAY = 60, LATE = 10, CHALLENGE = 20, DAYS = 24, PARTS = 3, OFFSETS = [5, 25, 45];

const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
const acct = (k) => privateKeyToAccount(k);
const house = acct(W.relayer), funder = acct(W.funder), provider = acct(W.provider), arbiter = acct(W.arbiter);
const wallet = (a) => createWalletClient({ account: a, chain: baseSepolia, transport: http("https://sepolia.base.org") });
const probeKey = (i) => keccak256(encodePacked(["bytes32", "string", "uint256"], [W.relayer, "rollcall-replay-probe", BigInt(i)]));
const probes = SCHOOLS.map((_, i) => acct(probeKey(i)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (seed) => { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };

const nonces = new Map();
async function send(a, fn, args) {
  for (let i = 0; i < 4; i++) {
    try {
      const n = await pub.getTransactionCount({ address: a.address, blockTag: "pending" });
      const sim = await pub.simulateContract({ account: a, address: RC, abi: rollCallAbi, functionName: fn, args });
      const h = await wallet(a).writeContract({ ...sim.request, nonce: n });
      await pub.waitForTransactionReceipt({ hash: h, timeout: 60000 });
      return { h, result: sim.result };
    } catch (e) {
      const m = e?.shortMessage || e?.message || "";
      if (/nonce|replacement|already known/i.test(m) && i < 3) { await sleep(800); continue; }
      throw e;
    }
  }
}

const start = Math.floor(Date.now() / 1000) + 120;
console.log("replay starts", new Date(start * 1000).toISOString());
const ids = [];
for (let i = 0; i < SCHOOLS.length; i++) {
  const s = SCHOOLS[i];
  const t = { funder: funder.address, provider: provider.address, probe: probes[i].address, attester: house.address, arbiter: arbiter.address, asn: s.asn,
    minDownKbps: 10000, minUpKbps: 2000, maxRttMs: 150, start: BigInt(start), dayLength: DAY, schoolHours: 0, lateWindow: LATE, challengeWindow: CHALLENGE,
    numDays: DAYS, required: PARTS, strikeLimit: 5, ratePerDay: 12_000_000n, bond: 60_000_000n, slash: 20_000_000n, challengeDeposit: 3_000_000n };
  const { result } = await send(funder, "open", [t, "Replay: " + s.name]);
  const id = Number(result);
  await send(provider, "accept", [BigInt(id)]);
  ids.push(id);
  // closures are signed in advance, before the days start
  for (const [from, to, reason] of Object.values(s.close ?? {})) {
    const sig = await probes[i].signTypedData({ domain: DOMAIN, types: CLOSURE_TYPES, primaryType: "Closure", message: { termId: BigInt(id), fromDay: from, toDay: to, reason } });
    await send(house, "closeDays", [BigInt(id), from, to, reason, sig]);
  }
  console.log(s.key, "term", id);
}

const posted = new Set();
const challenged = new Set();
// a term the funder ended takes no more readings, and one stale reading would revert the whole batch
const ended = new Set();
const end = start + DAYS * DAY + LATE + CHALLENGE * 2 + 30;
while (Math.floor(Date.now() / 1000) < end) {
  const now = Math.floor(Date.now() / 1000);
  const batch = [];
  for (let i = 0; i < SCHOOLS.length; i++) {
    const s = SCHOOLS[i], id = ids[i];
    if (ended.has(id)) continue;
    const day = Math.floor((now - start) / DAY);
    for (let d = Math.max(0, day - 1); d <= Math.min(day, DAYS - 1); d++) {
      if (now >= start + (d + 1) * DAY + LATE - 2) continue;
      const sc = s.script(d);
      if (sc === "closed" || sc === "dark") continue;
      for (let k = 0; k < PARTS; k++) {
        const key = `${id}:${d}:${k}`;
        const at = start + d * DAY + OFFSETS[k] + Math.floor(rand(key) * 8);
        if (at > now || posted.has(key)) continue;
        posted.add(key);
        const pass = sc === "ok" || sc === "hotspot" || sc === "fake" || (sc === "slow" && k < (d % 2 === 0 ? 1 : 2));
        const sim = `sim:replay:${s.key}:${id}:${d}:${k}`;
        const down = sc === "down" ? 0 : pass ? Math.round(14000 + rand(key + "d") * 36000) : Math.round(1500 + rand(key + "d") * 5500);
        const up = sc === "down" ? 0 : pass ? Math.round(3000 + rand(key + "u") * 9000) : Math.round(400 + rand(key + "u") * 1400);
        const rtt = sc === "down" ? 0 : pass ? Math.round(22 + rand(key + "r") * 60) : Math.round(60 + rand(key + "r") * 140);
        const idStr = sc === "down" ? `offline:${sim}` : sc === "fake" ? `sim:unverifiable:${id}:${d}:${k}` : sim;
        const r = { termId: BigInt(id), takenAt: BigInt(at), downKbps: down, upKbps: up, rttMs: rtt, testId: keccak256(toBytes(idStr)), clientHash: keccak256(toBytes("replay-client:" + s.key)) };
        const sig = await probes[i].signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message: r });
        batch.push({ r, sig, asn: sc === "down" ? 0 : sc === "hotspot" ? 64999 : s.asn, id: idStr });
      }
    }
  }
  const recordAll = (list) => send(house, "record", [list.map((b) => b.r), list.map((b) => b.sig), list.map((b) => b.asn), list.map((b) => b.id)]);
  if (batch.length) {
    try {
      await recordAll(batch);
      console.log(new Date().toISOString().slice(11, 19), "recorded", batch.length);
    } catch (e) {
      // one bad reading must not cost the other schools theirs: fall back to one at a time
      console.log("batch failed, one at a time:", e.shortMessage || e.message);
      for (const b of batch) {
        try { await recordAll([b]); console.log("recorded", b.id); } catch (e2) { console.log("record failed", b.id, e2.shortMessage || e2.message); }
      }
    }
  }
  // state of every replay term
  const res = await pub.multicall({ contracts: ids.flatMap((id) => [{ address: RC, abi: rollCallAbi, functionName: "state", args: [BigInt(id)] }, { address: RC, abi: rollCallAbi, functionName: "register", args: [BigInt(id)] }]), allowFailure: false });
  for (let i = 0; i < SCHOOLS.length; i++) {
    const id = ids[i], st = res[i * 2], reg = res[i * 2 + 1];
    if (st.ended) { ended.add(id); continue; }
    // the fake day: the funder challenges once it ends, the arbiter upholds
    for (let d = 0; d < DAYS; d++) {
      if (SCHOOLS[i].script(d) !== "fake" || challenged.has(`${id}:${d}`)) continue;
      const dayEnd = start + (d + 1) * DAY;
      if (now >= dayEnd + 1 && now < dayEnd + LATE + CHALLENGE - 3 && reg[d].readings > 0) {
        challenged.add(`${id}:${d}`);
        try {
          await send(funder, "challenge", [BigInt(id), d, "Spot check: these test ids are not in M-Lab's public archive."]);
          await send(arbiter, "resolve", [BigInt(id), d, true]);
          console.log(SCHOOLS[i].key, "day", d + 1, "challenged and upheld");
        } catch (e) { console.log("challenge failed", e.shortMessage || e.message); }
      }
    }
    const upTo = Math.min(Math.floor((now - start - LATE - CHALLENGE) / DAY) - 1, DAYS - 1);
    if (upTo >= Number(st.nextToSettle)) {
      try {
        await send(house, "settle", [BigInt(id), upTo]);
      } catch (e) { console.log("settle", id, e.shortMessage || e.message); }
      const after = await pub.readContract({ address: RC, abi: rollCallAbi, functionName: "state", args: [BigInt(id)] });
      if (!after.ended && Number(after.strikes) >= 5) {
        try { await send(funder, "terminate", [BigInt(id)]); ended.add(id); console.log(SCHOOLS[i].key, "term ended by the funder"); } catch {}
      }
    }
  }
  await sleep(3000);
}
console.log("replay done", ids.join(","));
