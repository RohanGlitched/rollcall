// Opens a real probe's term on the real calendar (days from midnight IST).
// Usage: node scripts/open-probe.mjs "<name>" <probeAddress> <asn> <startUnix> <numDays> <parts> <minDownKbps> <minUpKbps> <maxRttMs>
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
const RC = "0x27500043Bf3A8ae3405264412C2D4D43E8744150";
const USD = "0xA6F6e6Bb1Bc46a54635a417Fc8d601B39BaB3762";
const abi = parseAbi([
  "function open((address funder,address provider,address probe,address attester,address arbiter,uint32 asn,uint32 minDownKbps,uint32 minUpKbps,uint32 maxRttMs,uint64 start,uint32 dayLength,uint32 lateWindow,uint32 challengeWindow,uint16 numDays,uint8 required,uint8 strikeLimit,uint128 ratePerDay,uint128 bond,uint128 slash,uint128 challengeDeposit) t,string school) returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
  "function accept(uint256)",
]);
const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
import { readFileSync } from "node:fs";
const W = JSON.parse(readFileSync(new URL("../../keys/wallets.json", import.meta.url)));
const house = privateKeyToAccount(W.relayer);
const funder = privateKeyToAccount(W.funder);
const arbiter = privateKeyToAccount(W.arbiter);
const provider = privateKeyToAccount(W.provider);
const [name, probe, asn, start, numDays, parts, minDown, minUp, maxRtt] = process.argv.slice(2);
const t = {
  funder: funder.address, provider: provider.address, probe, attester: house.address, arbiter: arbiter.address, asn: Number(asn),
  minDownKbps: Number(minDown), minUpKbps: Number(minUp), maxRttMs: Number(maxRtt), start: BigInt(start), dayLength: 86400,
  lateWindow: 3600, challengeWindow: 2 * 86400, numDays: Number(numDays), required: Number(parts), strikeLimit: 5,
  ratePerDay: 12_000_000n, bond: 100_000_000n, slash: 25_000_000n, challengeDeposit: 5_000_000n,
};
const fw = createWalletClient({ account: funder, chain: baseSepolia, transport: http("https://sepolia.base.org") });
const hw = createWalletClient({ account: house, chain: baseSepolia, transport: http("https://sepolia.base.org") });
await pub.waitForTransactionReceipt({ hash: await hw.writeContract({ address: USD, abi, functionName: "mint", args: [funder.address, 2_000_000_000n] }) });
await pub.waitForTransactionReceipt({ hash: await fw.writeContract({ address: USD, abi, functionName: "approve", args: [RC, 2n ** 255n] }) });
await pub.waitForTransactionReceipt({ hash: await hw.writeContract({ address: USD, abi, functionName: "mint", args: [provider.address, 1_000_000_000n] }) });
const pw = createWalletClient({ account: provider, chain: baseSepolia, transport: http("https://sepolia.base.org") });
await pub.waitForTransactionReceipt({ hash: await pw.writeContract({ address: USD, abi, functionName: "approve", args: [RC, 2n ** 255n] }) });
const sim = await pub.simulateContract({ account: funder, address: RC, abi, functionName: "open", args: [t, name] });
const h1 = await fw.writeContract(sim.request);
await pub.waitForTransactionReceipt({ hash: h1 });
const id = sim.result;
const h2 = await createWalletClient({ account: provider, chain: baseSepolia, transport: http("https://sepolia.base.org") }).writeContract({ address: RC, abi, functionName: "accept", args: [id] });
await pub.waitForTransactionReceipt({ hash: h2 });
console.log(name, "term", id.toString(), h1, h2);
