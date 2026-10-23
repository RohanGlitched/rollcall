import { NextResponse } from "next/server";
import { termNames, readTerms, bust } from "@/lib/server/reads";
import { kindOf } from "@/lib/schools";

export const dynamic = "force-dynamic";

/** The newest replay cohort: six terms with one-minute school days. */
export async function GET() {
  try {
    bust("term:");
    const names = await termNames();
    const ids = [...names.entries()].filter(([, n]) => kindOf(n.school) === "replay").map(([id]) => id).sort((a, b) => b - a).slice(0, 6).sort((a, b) => a - b);
    const terms = await readTerms(ids);
    return NextResponse.json({ terms, at: Math.floor(Date.now() / 1000) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The replay could not be read just now." }, { status: 503 });
  }
}
