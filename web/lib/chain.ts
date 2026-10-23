import { createPublicClient, fallback, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;
export const ROLLCALL = "0x6b5fa7F9bD52D8162bF61D329ca167C5CF069dd5" as const;
export const TEST_DOLLAR = "0xA6F6e6Bb1Bc46a54635a417Fc8d601B39BaB3762" as const;
export const HOUSE = "0x629239c5b7B7e6E78944DFd8f4D519161BbA79d9" as const;
export const PROVIDER = "0x0E82E9f33e83a3be2895b9Fe68b75A735790fD4b" as const;
export const DEPLOY_BLOCK = 49049859n;
export const EXPLORER = "https://base-sepolia.blockscout.com";

export const RPC_URLS = [
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
];

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: fallback(RPC_URLS.map((u) => http(u, { timeout: 12_000, retryCount: 1 }))),
});

export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;

/** EIP-712 domain and types the probe signs. Must match RollCall.sol. */
export const DOMAIN = {
  name: "Roll Call",
  version: "1",
  chainId: CHAIN.id,
  verifyingContract: ROLLCALL,
} as const;

export const READING_TYPES = {
  Reading: [
    { name: "termId", type: "uint256" },
    { name: "takenAt", type: "uint64" },
    { name: "downKbps", type: "uint32" },
    { name: "upKbps", type: "uint32" },
    { name: "rttMs", type: "uint32" },
    { name: "testId", type: "bytes32" },
    { name: "clientHash", type: "bytes32" },
  ],
} as const;

export const CLOSURE_TYPES = {
  Closure: [
    { name: "termId", type: "uint256" },
    { name: "day", type: "uint16" },
    { name: "reason", type: "string" },
  ],
} as const;

/** Day marks, same order as the Mark enum in RollCall.sol. */
export const MARKS = ["Open", "Present", "Partial", "Absent", "Silent", "Closed", "Voided"] as const;
export type MarkName = (typeof MARKS)[number];

export const USD_DECIMALS = 6;
export const fmtUsd = (units: bigint | number, digits = 2) =>
  (Number(units) / 10 ** USD_DECIMALS).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
