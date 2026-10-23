import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { openTerm } from "@/lib/server/actions";
import { resolveCallerIp, callerIp, networkOf, shortHolder } from "@/lib/server/asn";
import { plainError } from "@/lib/server/house";
import { allow, ipKey } from "@/lib/server/limit";
import { gasState } from "@/lib/server/health";
import { TRIAL, TRIAL_PREFIX } from "@/lib/schools";
import { bust } from "@/lib/server/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OTHER_ASN = 64999;

/** Opens a visitor term: the house funds three two-minute school days for the visitor's probe key. */
export async function POST(req: Request) {
  const ip = (await resolveCallerIp(req)) || "local";
  if (!allow(`trial:${ipKey(ip)}`, 4, 3600_000) || !allow("trial:all", 120, 3600_000)) {
    return NextResponse.json({ error: "Too many visitor terms from this network in the last hour. Open an existing one from the register." }, { status: 429 });
  }
  let body: { probe?: string; contract?: "mine" | "other" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was not valid JSON." }, { status: 400 });
  }
  if (!body.probe || !isAddress(body.probe)) return NextResponse.json({ error: "A probe address is needed." }, { status: 400 });
  const gas = await gasState().catch(() => null);
  if (gas && gas.house.status === "out") {
    return NextResponse.json({ error: "The house wallet is low on test ETH, so new terms are paused. Existing terms keep settling." }, { status: 503 });
  }
  let asn = OTHER_ASN;
  let holder = "another provider";
  if (body.contract !== "other") {
    try {
      const n = await networkOf(ip);
      asn = n.asn;
      holder = shortHolder(n.holder);
    } catch {
      return NextResponse.json({ error: "Your network could not be identified, so the term cannot be contracted to it. Choose “another provider” instead." }, { status: 400 });
    }
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const r = await openTerm({
      school: `${TRIAL_PREFIX} on ${holder}`.slice(0, 80),
      probe: body.probe as Address,
      asn,
      ...TRIAL.sla,
      start: now + TRIAL.leadSeconds,
      dayLength: TRIAL.dayLength,
      lateWindow: TRIAL.lateWindow,
      challengeWindow: TRIAL.challengeWindow,
      numDays: TRIAL.numDays,
      required: TRIAL.required,
      strikeLimit: TRIAL.strikeLimit,
      ratePerDay: TRIAL.rate,
      bond: TRIAL.bond,
      slash: TRIAL.slash,
      challengeDeposit: TRIAL.challengeDeposit,
    });
    bust();
    return NextResponse.json({ ...r, asn, holder, start: now + TRIAL.leadSeconds });
  } catch (e) {
    return NextResponse.json({ error: plainError(e) }, { status: 502 });
  }
}
