import { NextResponse } from "next/server";
import { gasState } from "@/lib/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const g = await gasState();
    const status = g.house.status === "out" ? "out" : g.house.status === "low" || g.provider.status !== "ok" ? "low" : "ok";
    return NextResponse.json({ status, ...g }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  } catch {
    return NextResponse.json({ status: "unknown", error: "Balances could not be read." }, { status: 503 });
  }
}
