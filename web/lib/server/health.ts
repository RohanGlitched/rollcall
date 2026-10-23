import "server-only";
import { formatEther } from "viem";
import { publicClient } from "../chain";
import { houseAccount, providerAccount } from "./house";

// Reserves in test ETH. Below "low" new visitor terms still open; below "out" they pause so
// settling (which returns money) keeps working.
const RESERVE = { low: 0.0015, out: 0.0004 };
const PROVIDER_RESERVE = { low: 0.0003, out: 0.00005 }; // the provider only signs acceptances

export async function gasState() {
  const [h, p] = await Promise.all([
    publicClient.getBalance({ address: houseAccount().address }),
    publicClient.getBalance({ address: providerAccount().address }),
  ]);
  const st = (wei: bigint, r: { low: number; out: number }) => {
    const eth = Number(formatEther(wei));
    return { eth, status: eth < r.out ? "out" : eth < r.low ? "low" : "ok" } as const;
  };
  return {
    house: { address: houseAccount().address, ...st(h, RESERVE) },
    provider: { address: providerAccount().address, ...st(p, PROVIDER_RESERVE) },
  };
}
