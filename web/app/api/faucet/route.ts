import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { testDollarAbi } from "@/lib/abi";
import { TEST_DOLLAR, publicClient } from "@/lib/chain";
import { houseAccount, send, walletFor, plainError } from "@/lib/server/house";
import { resolveCallerIp } from "@/lib/server/asn";
import { allow, ipKey } from "@/lib/server/limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DRIP = 2_000_000_000n; // 2,000 test dollars: enough to fund a 60-day term at 12 a day and post a bond

/** Test dollars for anyone who wants to open or accept a term with their own wallet. They have no value. */
export async function POST(req: Request) {
  const ip = await resolveCallerIp(req);
  let b: { address?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  if (!b.address || !isAddress(b.address)) return NextResponse.json({ error: "A wallet address is needed." }, { status: 400 });
  if (!allow(`faucet:${ipKey(ip)}`, 3, 24 * 3600_000) || !allow(`faucet:${b.address.toLowerCase()}`, 2, 24 * 3600_000) || !allow("faucet:all", 200, 24 * 3600_000)) {
    return NextResponse.json({ error: "This wallet or network has had its test dollars for today." }, { status: 429 });
  }
  const bal = await publicClient.readContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "balanceOf", args: [b.address as Address] });
  if (bal >= DRIP) return NextResponse.json({ error: "This wallet already has enough test dollars." }, { status: 400 });
  try {
    const house = houseAccount();
    const tx = await send(house, async (nonce) => {
      const h = await walletFor(house).writeContract({ address: TEST_DOLLAR, abi: testDollarAbi, functionName: "mint", args: [b.address as Address, DRIP], nonce });
      await publicClient.waitForTransactionReceipt({ hash: h, timeout: 60_000 });
      return h;
    });
    return NextResponse.json({ tx, amount: "2000" });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
