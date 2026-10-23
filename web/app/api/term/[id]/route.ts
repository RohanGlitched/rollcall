import { NextResponse } from "next/server";
import { readTerm, readingsFor, dayEventsFor } from "@/lib/server/reads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "No such term." }, { status: 404 });
  try {
    const term = await readTerm(id);
    if (!term) return NextResponse.json({ error: `Term ${id} does not exist yet.` }, { status: 404 });
    const [readings, events] = await Promise.all([
      readingsFor(id).catch(() => null),
      dayEventsFor(id).catch(() => null),
    ]);
    return NextResponse.json(
      { term, readings, events, at: Math.floor(Date.now() / 1000) },
      { headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=10" } },
    );
  } catch {
    return NextResponse.json({ error: "The chain could not be read just now. Try again in a few seconds." }, { status: 503 });
  }
}
