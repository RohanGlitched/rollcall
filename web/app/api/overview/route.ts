import { NextResponse } from "next/server";
import { overview } from "@/lib/server/reads";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await overview(), { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } });
  } catch (e) {
    return NextResponse.json({ error: "The chain could not be read just now. Try again in a few seconds." }, { status: 503 });
  }
}
