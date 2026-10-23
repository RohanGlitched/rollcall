import { NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { relayClose } from "@/lib/server/actions";
import { plainError } from "@/lib/server/house";
import { allow } from "@/lib/server/limit";
import { callerIp } from "@/lib/server/asn";
import { readTerm, bust } from "@/lib/server/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Relays a school's signed "closed today" notice. The contract checks the probe signature. */
export async function POST(req: Request) {
  if (!allow(`close:${callerIp(req) || "local"}`, 10, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  }
  let b: { termId: number; day: number; reason: string; sig: Hex };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  const reason = String(b.reason || "").trim().slice(0, 80);
  if (!Number.isInteger(b.termId) || !Number.isInteger(b.day) || !reason || !isHex(b.sig)) {
    return NextResponse.json({ error: "The notice needs a term, a day, a reason and the probe's signature." }, { status: 400 });
  }
  const term = await readTerm(b.termId).catch(() => null);
  if (!term || term.kind === "sim") return NextResponse.json({ error: "That term cannot be closed from here." }, { status: 400 });
  const day = term.days[b.day];
  const dayEnd = term.terms.start + (b.day + 1) * term.terms.dayLength;
  if (!day || term.state.ended || Date.now() / 1000 >= dayEnd) return NextResponse.json({ error: "That school day is over." }, { status: 400 });
  if (day.closed) return NextResponse.json({ error: "This day is already marked closed." }, { status: 400 });
  if (day.readings > 0) return NextResponse.json({ error: "This day already has a reading, so it can no longer be marked closed." }, { status: 400 });
  try {
    const tx = await relayClose(b.termId, b.day, b.day, reason, b.sig);
    bust();
    return NextResponse.json({ tx });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
