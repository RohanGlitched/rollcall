import { NextResponse } from "next/server";
import { termNames } from "@/lib/server/reads";
import { kindOf } from "@/lib/schools";

export const dynamic = "force-dynamic";

/** Every term id with its school name and kind, from the contract's TermOpened events. */
export async function GET() {
  try {
    const names = await termNames();
    const terms = [...names.entries()].map(([id, n]) => ({ id, school: n.school, kind: kindOf(n.school), openedTx: n.tx }));
    return NextResponse.json({ ids: terms.filter((t) => t.kind !== "sim").map((t) => t.id), terms }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  } catch {
    return NextResponse.json({ error: "The term list could not be read just now." }, { status: 503 });
  }
}
