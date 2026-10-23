import { NextResponse } from "next/server";
import { settle, settleableUpTo } from "@/lib/server/actions";
import { plainError } from "@/lib/server/house";
import { allow } from "@/lib/server/limit";
import { callerIp } from "@/lib/server/asn";
import { readTerm, bust } from "@/lib/server/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Anyone may settle finished days; the house pays the gas so visitors never need a wallet. */
export async function POST(req: Request) {
  if (!allow(`settle:${callerIp(req) || "local"}`, 30, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  }
  let b: { termId: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  bust(`term:${b.termId}`);
  const term = await readTerm(Number(b.termId)).catch(() => null);
  if (!term) return NextResponse.json({ error: "No such term." }, { status: 404 });
  if (term.state.ended) return NextResponse.json({ settled: false, reason: "This term has ended." });
  const upTo = settleableUpTo(term.terms, Math.floor(Date.now() / 1000));
  if (upTo < term.state.nextToSettle) return NextResponse.json({ settled: false, reason: "No school day is ready to settle yet." });
  if (term.days[term.state.nextToSettle]?.challenged) return NextResponse.json({ settled: false, reason: "The next day is waiting for the arbiter." });
  try {
    const tx = await settle(term.id, upTo);
    bust();
    return NextResponse.json({ settled: true, tx, upTo });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
