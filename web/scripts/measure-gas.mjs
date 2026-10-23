// Prints gas used by each kind of Roll Call transaction, from this deployment's own receipts.
import { createPublicClient, http, parseAbi, decodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";
const RC = "0x27500043Bf3A8ae3405264412C2D4D43E8744150";
const pub = createPublicClient({ chain: baseSepolia, transport: http("https://base-sepolia-rpc.publicnode.com") });
const latest = await pub.getBlockNumber();
const logs = [];
for (let a = 49071540n; a <= latest; a += 4001n) {
  const b = a + 4000n > latest ? latest : a + 4000n;
  logs.push(...(await pub.getLogs({ address: RC, fromBlock: a, toBlock: b })));
}
const txs = [...new Set(logs.map((l) => l.transactionHash))];
const abi = parseAbi([
  "function open((address,address,address,address,address,uint32,uint32,uint32,uint32,uint64,uint32,uint32,uint32,uint16,uint8,uint8,uint128,uint128,uint128,uint128),string)",
  "function accept(uint256)",
  "function record((uint256,uint64,uint32,uint32,uint32,bytes32,bytes32)[],bytes[],uint32[],string[])",
  "function closeDay(uint256,uint16,string,bytes)",
  "function settle(uint256,uint16)",
  "function challenge(uint256,uint16,string)",
  "function resolve(uint256,uint16,bool)",
  "function terminate(uint256)",
]);
const by = {};
for (const h of txs) {
  const [tx, rc] = await Promise.all([pub.getTransaction({ hash: h }), pub.getTransactionReceipt({ hash: h })]);
  let name = "?", n = 1;
  try {
    const d = decodeFunctionData({ abi, data: tx.input });
    name = d.functionName;
    if (name === "record") n = d.args[0].length;
  } catch {}
  const k = name === "record" ? `record x${n}` : name;
  (by[k] ??= []).push({ gas: Number(rc.gasUsed), h, l1: Number(BigInt(rc.l1Fee ?? 0n)) });
}
for (const [k, v] of Object.entries(by)) {
  const avg = Math.round(v.reduce((a, x) => a + x.gas, 0) / v.length);
  const l1 = Math.round(v.reduce((a, x) => a + x.l1, 0) / v.length);
  console.log(k.padEnd(14), "n=" + v.length, "avg", avg, "l1Fee(wei)", l1, "example", v[0].h);
}
