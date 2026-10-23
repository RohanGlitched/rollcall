"use client";

import { createWalletClient, custom, type Address, type WalletClient, BaseError, ContractFunctionRevertedError } from "viem";
import { CHAIN, publicClient } from "./chain";

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (...a: any[]) => void) => void };

export function injected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum as Eip1193) ?? null;
}

/** Connects the browser wallet and makes sure it is on Base Sepolia. */
export async function connect(): Promise<{ wallet: WalletClient; address: Address }> {
  const eth = injected();
  if (!eth) throw new Error("No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet, then reload this page.");
  const [address] = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  const chainId = Number(await eth.request({ method: "eth_chainId" }));
  if (chainId !== CHAIN.id) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${CHAIN.id.toString(16)}` }] });
    } catch {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${CHAIN.id.toString(16)}`,
            chainName: "Base Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://base-sepolia.blockscout.com"],
          },
        ],
      });
    }
  }
  const wallet = createWalletClient({ account: address, chain: CHAIN, transport: custom(eth) });
  return { wallet, address };
}

export async function waitTx(hash: `0x${string}`) {
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (r.status !== "success") throw new Error("The transaction reverted on chain.");
  return r;
}

/** One sentence for a wallet or contract error. */
export function walletError(e: unknown): string {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (rev?.data?.errorName) {
      const n = rev.data.errorName;
      const args = rev.data.args?.length ? `: ${String(rev.data.args[0])}` : "";
      return `The contract refused it (${n}${args}).`;
    }
    if (/User rejected|denied/i.test(e.message)) return "You cancelled it in your wallet.";
    if (/insufficient funds/i.test(e.message)) return "Your wallet needs a little Base Sepolia ETH for gas.";
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}
