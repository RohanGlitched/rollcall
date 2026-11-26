// Deploy Afterbell on Base Sepolia and settle a demo evening of voucher sales (test dollars, "sim:" vouchers).
// Keys come from ../keys/wallets.json and are never printed. Output: ../../final/afterbell-chain.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, keccak256, toHex, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const keys = JSON.parse(fs.readFileSync(path.join(root, "keys/wallets.json"), "utf8"));
const art = JSON.parse(fs.readFileSync(path.join(root, "contracts/out/Afterbell.sol/Afterbell.json"), "utf8"));
const TUSD = "0xA6F6e6Bb1Bc46a54635a417Fc8d601B39BaB3762";
const RPC = "https://base-sepolia-rpc.publicnode.com";
const acct = (k) => privateKeyToAccount(k.startsWith("0x") ? k : `0x${k}`);
const relayer = acct(keys.relayer), funder = acct(keys.funder), arbiter = acct(keys.arbiter);
const school = acct(keys.homeProbe).address, operator = acct(keys.uiTester).address, provider = acct(keys.provider).address;
const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const w = (a) => createWalletClient({ account: a, chain: baseSepolia, transport: http(RPC) });
const erc20 = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
];
const abi = art.abi;
const txs = [];
async function send(account, to, data, label) {
  const hash = await w(account).sendTransaction({ to, data });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} failed ${hash}`);
  txs.push({ label, hash });
  console.log("ok", label, hash);
  return r;
}

const fund = await pub.getBalance({ address: relayer.address });
console.log("relayer ETH", formatUnits(fund, 18));

// 1. deploy
const terms = { school, operator, provider, schoolBps: 5000, operatorBps: 3000, providerBps: 2000, openHour: 16, closeHour: 22 };
const dh = await w(relayer).deployContract({ abi, bytecode: art.bytecode.object, args: [TUSD, relayer.address, 19800, [relayer.address, funder.address, arbiter.address], 2, terms] });
const dr = await pub.waitForTransactionReceipt({ hash: dh });
const AB = dr.contractAddress;
txs.push({ label: "deploy Afterbell", hash: dh });
console.log("Afterbell", AB);

// 2. partner (relayer) mints test dollars and approves
await send(relayer, TUSD, encodeFunctionData({ abi: erc20, functionName: "mint", args: [relayer.address, parseUnits("20", 6)] }), "partner mints 20 tUSD");
await send(relayer, TUSD, encodeFunctionData({ abi: erc20, functionName: "approve", args: [AB, parseUnits("20", 6)] }), "partner approves Afterbell");

// 3. last evening's vouchers (Nov 25 IST). Rupees converted at the demo rate 1 tUSD = Rs 84.
const IST = 19800;
const eve = (h, m) => BigInt(Math.floor(Date.UTC(2026, 10, 25, h, m) / 1000) - IST);
const rs = (r) => parseUnits((r / 84).toFixed(6), 6);
const sales = [
  ["sim:nov25-001", eve(16, 20), 60, 10], ["sim:nov25-002", eve(16, 45), 120, 20], ["sim:nov25-003", eve(17, 10), 60, 10],
  ["sim:nov25-004", eve(18, 5), 60, 10], ["sim:nov25-005", eve(18, 30), 180, 30], ["sim:nov25-006", eve(19, 15), 60, 10],
  ["sim:nov25-007", eve(20, 0), 120, 20], ["sim:nov25-008", eve(20, 40), 60, 10],
];
for (const [id, t, mins, rupees] of sales.slice(0, 6)) {
  await send(relayer, AB, encodeFunctionData({ abi, functionName: "recordSale", args: [keccak256(toHex(id)), t, mins, rs(rupees)] }), `sale ${id} Rs ${rupees}`);
}

// 4. committee changes the split: 2 of 3 signatures (school share up to 60%)
const t2 = { ...terms, schoolBps: 6000, operatorBps: 2500, providerBps: 1500 };
await send(relayer, AB, encodeFunctionData({ abi, functionName: "propose", args: [t2] }), "committee member 1 proposes 60/25/15");
await send(funder, AB, encodeFunctionData({ abi, functionName: "approve", args: [0n] }), "committee member 2 approves: split changes");
for (const [id, t, mins, rupees] of sales.slice(6)) {
  await send(relayer, AB, encodeFunctionData({ abi, functionName: "recordSale", args: [keccak256(toHex(id)), t, mins, rs(rupees)] }), `sale ${id} Rs ${rupees}`);
}

// 5. a sale that started during school hours is refused (simulated, not sent)
let refusal = "";
try {
  await pub.simulateContract({ account: relayer, address: AB, abi, functionName: "recordSale", args: [keccak256(toHex("sim:nov26-school")), BigInt(Math.floor(Date.UTC(2026, 10, 26, 10, 30) / 1000) - IST), 60, rs(10)] });
  refusal = "NOT REFUSED";
} catch (e) { refusal = e.shortMessage || String(e).slice(0, 160); }
console.log("school-hours sale:", refusal);

const read = (fn) => pub.readContract({ address: AB, abi, functionName: fn });
const out = {
  network: "Base Sepolia", contract: AB, token: TUSD, rate: "1 tUSD = Rs 84 (demo rate)", committee: [relayer.address, funder.address, arbiter.address], threshold: 2,
  parties: { school, operator, provider },
  totals: { sales: Number(await read("salesCount")), minutes: Number(await read("minutesSold")), totalIn: formatUnits(await read("totalIn"), 6), toSchool: formatUnits(await read("toSchool"), 6), toOperator: formatUnits(await read("toOperator"), 6), toProvider: formatUnits(await read("toProvider"), 6) },
  schoolHoursRefusal: refusal, txs, at: new Date().toISOString(),
};
fs.writeFileSync(path.resolve(root, "../final/afterbell-chain.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.totals));
