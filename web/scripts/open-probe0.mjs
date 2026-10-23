// Opens Probe 0's term: 60 real school days from midnight IST, four tests a day, three must pass.
// Usage: node scripts/open-probe0.mjs <probeAddress> <startUnix>
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
const RC = "0x6b5fa7F9bD52D8162bF61D329ca167C5CF069dd5";
const abi = parseAbi([
  "function open((address funder,address provider,address probe,address arbiter,uint32 asn,uint32 minDownKbps,uint32 minUpKbps,uint32 maxRttMs,uint64 start,uint32 dayLength,uint32 lateWindow,uint32 challengeWindow,uint16 numDays,uint8 required,uint8 strikeLimit,uint128 ratePerDay,uint128 bond,uint128 slash) t,string school) returns (uint256)",
  "function accept(uint256)",
]);
const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
import { readFileSync } from "node:fs";
const W = JSON.parse(readFileSync(new URL("../../keys/wallets.json", import.meta.url)));
const house = privateKeyToAccount(W.relayer);
const provider = privateKeyToAccount(W.provider);
const [probe, start] = process.argv.slice(2);
const t = {
  funder: house.address, provider: provider.address, probe, arbiter: house.address, asn: 31898,
  minDownKbps: 25000, minUpKbps: 5000, maxRttMs: 100, start: BigInt(start), dayLength: 86400,
  lateWindow: 3600, challengeWindow: 2 * 86400, numDays: 60, required: 3, strikeLimit: 5,
  ratePerDay: 12_000_000n, bond: 100_000_000n, slash: 25_000_000n,
};
const sim = await pub.simulateContract({ account: house, address: RC, abi, functionName: "open", args: [t, "Probe 0: a cloud server in India"] });
const h1 = await createWalletClient({ account: house, chain: baseSepolia, transport: http("https://sepolia.base.org") }).writeContract(sim.request);
await pub.waitForTransactionReceipt({ hash: h1 });
const id = sim.result;
const h2 = await createWalletClient({ account: provider, chain: baseSepolia, transport: http("https://sepolia.base.org") }).writeContract({ address: RC, abi, functionName: "accept", args: [id] });
await pub.waitForTransactionReceipt({ hash: h2 });
console.log("Probe 0 term", id.toString(), h1, h2);
