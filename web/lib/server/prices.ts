import "server-only";

let memo: { at: number; v: { gasPriceGwei: number; ethUsd: number } | null } | undefined;

/** Base mainnet gas price and the ETH/USD spot price, cached for ten minutes. Null when either source is down. */
export async function mainnetPrices() {
  if (memo && Date.now() - memo.at < 600_000) return memo.v;
  try {
    const [g, p] = await Promise.all([
      fetch("https://mainnet.base.org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
        signal: AbortSignal.timeout(6000),
      }).then((r) => r.json()),
      fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { signal: AbortSignal.timeout(6000) }).then((r) => r.json()),
    ]);
    const v = { gasPriceGwei: Number(BigInt(g.result)) / 1e9, ethUsd: Number(p.data.amount) };
    memo = { at: Date.now(), v: Number.isFinite(v.gasPriceGwei) && v.ethUsd > 0 ? v : null };
  } catch {
    memo = { at: Date.now(), v: null };
  }
  return memo.v;
}
