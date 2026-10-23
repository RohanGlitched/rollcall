import { SUBMISSION_TEXTS } from "@/lib/submission-texts";

export const dynamic = "force-dynamic";

/** The submission texts for the DoraHacks builds, served as plain text (readable by any origin). */
export async function GET(req: Request) {
  const which = new URL(req.url).searchParams.get("which") === "afterbell" ? "afterbell" : "rollcall";
  return new Response(SUBMISSION_TEXTS[which], { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" } });
}
