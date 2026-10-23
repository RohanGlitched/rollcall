// One-time: house and provider approve Roll Call to move their test dollars; both get a stock of tUSD.
// Usage: node --env-file=.env.local scripts/setup.mjs
import { createPublicClient, createWalletClient, http, maxUint256, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const ROLLCALL = "0x6b5fa7F9bD52D8162bF61D329ca167C5CF069dd5";
const USD = "0xA6F6e6Bb1Bc46a54635a417Fc8d601B39BaB3762";
const abi = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function mint(address,uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
const house = privateKeyToAccount(process.env.HOUSE_KEY);
const provider = privateKeyToAccount(process.env.PROVIDER_KEY);
for (const acct of [house, provider]) {
  const w = createWalletClient({ account: acct, chain: baseSepolia, transport: http("https://sepolia.base.org") });
  const a = await pub.readContract({ address: USD, abi, functionName: "allowance", args: [acct.address, ROLLCALL] });
  if (a < maxUint256 / 2n) {
    const h = await w.writeContract({ address: USD, abi, functionName: "approve", args: [ROLLCALL, maxUint256] });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("approved", acct.address, h);
  }
}
const hw = createWalletClient({ account: house, chain: baseSepolia, transport: http("https://sepolia.base.org") });
for (const [to, amt] of [[house.address, 100_000_000_000n], [provider.address, 10_000_000_000n]]) {
  const b = await pub.readContract({ address: USD, abi, functionName: "balanceOf", args: [to] });
  if (b < amt / 2n) {
    const h = await hw.writeContract({ address: USD, abi, functionName: "mint", args: [to, amt] });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("minted", amt / 1_000_000n, "tUSD to", to);
  }
}
console.log("setup done");
