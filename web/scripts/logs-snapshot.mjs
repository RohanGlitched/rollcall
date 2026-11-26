// Snapshot every Roll Call log into lib/server/logs-snapshot.json (public RPCs prune old history).
import fs from "node:fs";
const R = "https://base-sepolia.gateway.tenderly.co", A = "0xD4EDf73a6604840986C32339A96c8E59cB915984", D = 49112129n, STEP = 49999n;
const rpc = async (method, params) => { for (let i = 0; ; i++) { try { const r = await fetch(R, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json()); if (r.error) throw new Error(JSON.stringify(r.error)); return r.result; } catch (e) { if (i > 5) throw e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); } } };
const latest = BigInt(await rpc("eth_blockNumber", [])) - 20n;
const ranges = []; for (let a = D; a <= latest; a += STEP + 1n) ranges.push([a, a + STEP > latest ? latest : a + STEP]);
const out = []; let done = 0;
for (let i = 0; i < ranges.length; i += 8) {
  const got = await Promise.all(ranges.slice(i, i + 8).map(([a, b]) => rpc("eth_getLogs", [{ address: A, fromBlock: "0x" + a.toString(16), toBlock: "0x" + b.toString(16) }])));
  for (const g of got) for (const l of g) out.push({ topics: l.topics, data: l.data, blockNumber: String(BigInt(l.blockNumber)), transactionHash: l.transactionHash });
  done += got.length; if (i % 64 === 0) console.log(done, "/", ranges.length, out.length);
}
fs.writeFileSync("lib/server/logs-snapshot.json", JSON.stringify({ last: String(latest), logs: out }));
console.log("total", out.length, "last", String(latest));
