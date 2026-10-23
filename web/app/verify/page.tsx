import type { Metadata } from "next";
import { SiteFooter, REPO, PageHero } from "@/components/Site";
import { ROLLCALL, ROLLCALL_V1, ROLLCALL_V2, TEST_DOLLAR, HOUSE, PROVIDER, FUNDER, ARBITER, addrUrl, EXPLORER } from "@/lib/chain";
import { GAS_ROWS, YEAR_GAS } from "@/lib/gas";
import { mainnetPrices } from "@/lib/server/prices";

export const metadata: Metadata = {
  title: "Check it yourself",
  description: "Contract addresses, commands that read any term straight from the chain, and the query that checks a reading against M-Lab's public archive.",
};

const pre = "thin-scroll overflow-x-auto rounded-md border border-rule bg-graphite px-5 py-4 font-mono text-[13px] leading-relaxed text-sheet";

export default async function Verify({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const q = await searchParams;
  const px = await mainnetPrices();
  const cost = (gas: number) => (px ? `$${((gas * px.gasPriceGwei * 1e-9) * px.ethUsd).toFixed(gas > 1e6 ? 2 : 5)}` : "—");
  const tests = (q.test || "").split("|").map((x) => x.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 80)).filter(Boolean).slice(0, 2);
  const test = tests[0] || "";
  const day = (() => {
    const m = test.match(/_(\d{10})_/);
    return m ? new Date(Number(m[1]) * 1000).toISOString().slice(0, 10) : "YYYY-MM-DD";
  })();
  return (
    <>
      <PageHero
        title="Check it yourself"
        lede="Nothing here has to be taken on trust. The register is read from the contract, the contract’s source is verified, and every real reading names an M-Lab test you can look up in M-Lab’s own archive."
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">

        {test && (
          <section className="mt-10 rounded-md border border-ink bg-ink-wash/40 p-6">
            <h2 className="text-[22px] font-semibold">Checking test {test}</h2>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed">
              Run this in BigQuery after joining M-Lab’s free data group (see below). The archive row should show the same
              network number and a download speed close to the signed one. If the row is missing or the network differs,
              the funder can challenge the day before it settles.
            </p>
            <pre className={`${pre} mt-4`}>{`SELECT id, date,
  a.MeanThroughputMbps AS download_mbps,
  a.MinRTT AS min_rtt_ms,
  client.Network.ASNumber AS asn,
  server.Site AS mlab_site
FROM \`measurement-lab.ndt.ndt7\`
WHERE date = "${day}"
  AND id IN (${tests.map((x) => `"${x}"`).join(", ")})`}</pre>
          </section>
        )}

        <section className="mt-14">
          <h2 className="text-[28px] font-semibold">Contracts on Base Sepolia</h2>
          <div className="mt-5 overflow-hidden rounded-md border border-rule">
            <table className="w-full text-left text-[15px]">
              <tbody className="bg-sheet">
                {[
                  ["Roll Call v3", ROLLCALL, "Terms, readings, day marks, payouts. Source verified on Sourcify (exact match)."],
                  ["Test dollar (tUSD)", TEST_DOLLAR, "6 decimals, minted by the attester key for the demo. No value."],
                  ["Attester", HOUSE, "Checks networks, records readings, settles days, relays closures; pays every visitor’s gas."],
                  ["Funder", FUNDER, "Opens demo terms, challenges suspicious days, ends terms after repeated absences."],
                  ["Arbiter", ARBITER, "Decides challenges."],
                  ["Provider", PROVIDER, "Receives payouts and posts bonds for demo terms."],
                  ["Roll Call v2 (retired)", ROLLCALL_V2, "Replaced the same afternoon after a second review: parts of the day now divide school hours, offline reports reach the contract until the day settles, weak partial days are strikes, and closures cover a run of days."],
                  ["Roll Call v1 (retired)", ROLLCALL_V1, "The first deployment, replaced the same morning after an audit found that a funder could end a term before earned days settled, closures could erase passes, retrying could earn a full day, and one key could hold two roles."],
                ].map(([n, a, d]) => (
                  <tr key={n} className="border-t border-rule align-top first:border-t-0">
                    <th className="px-5 py-4 font-serif font-semibold">{n}</th>
                    <td className="px-5 py-4">
                      <a className="break-all font-mono text-[13px] text-ink underline" href={addrUrl(a)}>
                        {a}
                      </a>
                      <span className="mt-1 block text-[13px] text-muted">{d}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[28px] font-semibold">Read a term from the chain</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              With Foundry’s <code>cast</code>, no account needed. The register returns one entry per school day: readings,
              parts of the day passed, which parts (a bit mask), mark (0 open, 1 present, 2 partial, 3 absent, 4 silent, 5 closed,
              6 voided), closed, challenged, voided.
            </p>
            <pre className={`${pre} mt-4`}>{`RPC=https://sepolia.base.org
RC=${ROLLCALL}

cast call $RC "termCount()(uint256)" --rpc-url $RPC
cast call $RC "register(uint256)((uint8,uint8,uint32,uint8,bool,bool,bool)[])" 1 --rpc-url $RPC
cast call $RC "state(uint256)((uint128,uint128,uint128,uint128,uint128,uint16,uint16,uint8,bool,bool))" 1 --rpc-url $RPC`}</pre>
          </div>
          <div>
            <h2 className="text-[28px] font-semibold">Run the contract’s tests</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              45 tests, including a fuzz test over 500 random terms that checks no money is created or lost.
            </p>
            <pre className={`${pre} mt-4`}>{`git clone ${REPO}
cd rollcall/contracts
forge test -vv`}</pre>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-[28px] font-semibold">Check a reading against M-Lab’s archive</h2>
          <div className="mt-4 grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 text-[15px] leading-relaxed">
              <p>
                M-Lab publishes every test it serves in BigQuery, including the client’s network number and the throughput its
                own server measured. Roll Call writes each real reading’s full test id on chain, so a funder (or anyone) can
                join the two.
              </p>
              <p>
                Access is free: join M-Lab’s <a className="text-ink underline" href="https://groups.google.com/a/measurementlab.net/g/discuss">discuss group</a> with a Google
                account, then query from any Google Cloud project. Tests appear in the archive within about a day, which is
                why a real term’s challenge window should be longer than that.
              </p>
              <p>
                Open any real reading on a term page and its test id links here with the query filled in.
              </p>
            </div>
            <pre className={pre}>{`-- every Roll Call reading's id, from the chain,
-- joined to M-Lab's own record of the same test
SELECT id, date,
  a.MeanThroughputMbps AS download_mbps,
  a.MinRTT AS min_rtt_ms,
  client.Network.ASNumber AS asn
FROM \`measurement-lab.ndt.ndt7\`
WHERE date BETWEEN "2026-10-23" AND CURRENT_DATE()
  AND id IN UNNEST(@rollcall_test_ids)`}</pre>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-[28px] font-semibold">What it costs to run</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
            Gas measured from this deployment’s own transactions on Base Sepolia, priced at Base mainnet’s gas price and the ETH
            price right now{px ? ` (${px.gasPriceGwei.toFixed(4)} gwei, ETH $${Math.round(px.ethUsd).toLocaleString("en-US")})` : ""}.
            This is execution gas; Base also charges a small fee for posting the data to Ethereum, which grows with the size of
            the transaction.
          </p>
          <div className="thin-scroll mt-5 overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[600px] text-left text-[15px]">
              <thead className="bg-ink-wash/50 text-[13px] text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 text-right font-semibold">Gas</th>
                  <th className="px-5 py-3 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="bg-sheet">
                {GAS_ROWS.map((r) => (
                  <tr key={r.label} className="border-t border-rule">
                    <td className="px-5 py-3">
                      {r.label}
                      {r.tx && (
                        <a className="ml-2 text-[13px] text-ink underline" href={`${EXPLORER}/tx/${r.tx}`}>
                          example
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tnum">{r.gas.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tnum">{cost(r.gas)}</td>
                  </tr>
                ))}
                <tr className="border-t border-rule-strong bg-ink-wash/40 font-semibold">
                  <td className="px-5 py-3">One school for a year (200 school days, 4 readings a day, batched daily)</td>
                  <td className="px-5 py-3 text-right tnum">{YEAR_GAS.toLocaleString("en-US")}</td>
                  <td className="px-5 py-3 text-right tnum">{cost(YEAR_GAS)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
