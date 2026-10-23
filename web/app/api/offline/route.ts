import { NextResponse } from "next/server";
import { isHex, recoverTypedDataAddress, type Hex } from "viem";
import { DOMAIN, READING_TYPES } from "@/lib/chain";
import { recordReadings, testIdOf, type ReadingInput } from "@/lib/server/actions";
import { resolveCallerIp } from "@/lib/server/asn";
import { plainError } from "@/lib/server/house";
import { allow, ipKey } from "@/lib/server/limit";
import { readTerm, bust } from "@/lib/server/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/**
 * Records a probe's signed "I could not get online" report. It carries no speeds and no network, so it
 * can only ever count as a failed reading: it turns a silent day (no strike) into an absent one.
 */
export async function POST(req: Request) {
  const ip = await resolveCallerIp(req);
  if (!allow(`offline:${ipKey(ip)}`, 30, 3600_000)) return NextResponse.json({ error: "Too many reports from this network in an hour." }, { status: 429 });
  let b: { termId: number; takenAt: number; id: string; sig: Hex };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  if (!Number.isInteger(b.termId) || !Number.isInteger(b.takenAt) || typeof b.id !== "string" || !isHex(b.sig)) {
    return NextResponse.json({ error: "The report is incomplete." }, { status: 400 });
  }
  const term = await readTerm(b.termId).catch(() => null);
  if (!term || term.kind === "sim") return NextResponse.json({ error: "That term does not take reports from here." }, { status: 400 });
  const expected = `offline:${term.terms.probe.toLowerCase()}:${term.id}:${b.takenAt}`;
  if (b.id !== expected) return NextResponse.json({ error: "The report id does not match this probe and time." }, { status: 400 });
  const reading: ReadingInput = { termId: BigInt(b.termId), takenAt: BigInt(b.takenAt), downKbps: 0, upKbps: 0, rttMs: 0, testId: testIdOf(b.id), clientHash: ZERO };
  const signer = await recoverTypedDataAddress({ domain: DOMAIN, types: READING_TYPES, primaryType: "Reading", message: reading, signature: b.sig }).catch(() => null);
  if (!signer || signer.toLowerCase() !== term.terms.probe.toLowerCase()) {
    return NextResponse.json({ error: "This report was not signed by this school's probe key." }, { status: 403 });
  }
  try {
    const tx = await recordReadings([reading], [b.sig], [0], [b.id]);
    bust();
    return NextResponse.json({ tx });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
