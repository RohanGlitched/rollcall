import { NextResponse } from "next/server";
import { resolveCallerIp, callerIp, networkOf, shortHolder } from "@/lib/server/asn";

export const dynamic = "force-dynamic";

/** Which network this visitor is on, so a visitor term can be contracted to it. The address is not returned. */
export async function GET(req: Request) {
  const ip = await resolveCallerIp(req);
  try {
    const n = await networkOf(ip);
    return NextResponse.json({ asn: n.asn, holder: shortHolder(n.holder), fullHolder: n.holder });
  } catch (e) {
    return NextResponse.json(
      { error: "Your network could not be identified. Run the test anyway: the network is checked again from the test itself." },
      { status: 200 },
    );
  }
}
