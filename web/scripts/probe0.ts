// Probe 0: a real school probe on a server. Runs one M-Lab ndt7 test, signs it with the probe key,
// and sends it to the attester. Cron runs it four times each school day.
// Env: PROBE_KEY (hex), TERM_ID, API (default https://rollcall-schools.vercel.app)
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";
import { runNdt7 } from "../lib/ndt7";
import { DOMAIN, READING_TYPES } from "../lib/chain";

async function main() {
  const key = process.env.PROBE_KEY as Hex;
  const termId = Number(process.env.TERM_ID);
  const api = process.env.API || "https://rollcall-schools.vercel.app";
  if (!key || !termId) throw new Error("PROBE_KEY and TERM_ID are required");
  const acct = privateKeyToAccount(key);
  const res = await runNdt7(() => {});
  const message = {
    termId: BigInt(termId),
    takenAt: BigInt(res.finishedAt),
    downKbps: res.downKbps,
    upKbps: res.upKbps,
    rttMs: res.rttMs,
    testId: keccak256(toBytes(res.uuid)),
    clientHash: keccak256(toBytes(res.clientIp)),
  };
  const sig = await acct.signTypedData({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message });
  const r = await fetch(`${api}/api/reading`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      termId,
      takenAt: res.finishedAt,
      downKbps: res.downKbps,
      upKbps: res.upKbps,
      rttMs: res.rttMs,
      uuid: res.uuid,
      client: res.client,
      machine: res.machine,
      sig,
    }),
  });
  const j = await r.json();
  console.log(new Date().toISOString(), res.machine, `${res.downKbps}/${res.upKbps} kbps ${res.rttMs} ms`, res.uuid, r.status, JSON.stringify(j));
}

main().catch((e) => {
  console.error(new Date().toISOString(), "probe failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
