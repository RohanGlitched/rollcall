import { NextResponse } from "next/server";
import { keeperTick } from "@/lib/server/keeper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const secret = (process.env.KEEPER_SECRET || "").trim();
  const given = req.headers.get("x-keeper-key") || new URL(req.url).searchParams.get("key") || "";
  if (!secret || given !== secret) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    return NextResponse.json(await keeperTick());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "keeper failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
