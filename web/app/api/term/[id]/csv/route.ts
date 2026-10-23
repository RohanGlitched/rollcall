import { readTerm, dayEventsFor, readingsFor } from "@/lib/server/reads";

export const dynamic = "force-dynamic";

/** The term's register as CSV: one row per school day, with the settlement transaction. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const term = Number.isInteger(id) && id > 0 ? await readTerm(id).catch(() => null) : null;
  if (!term) return new Response("No such term.\n", { status: 404 });
  const [events, readings] = await Promise.all([dayEventsFor(id).catch(() => []), readingsFor(id).catch(() => [])]);
  const t = term.terms;
  const rows = [["day", "date_utc", "mark", "parts_passed", "parts_required", "readings", "paid_tusd", "returned_tusd", "settle_tx", "test_ids"]];
  term.days.forEach((d, i) => {
    const start = new Date((t.start + i * t.dayLength) * 1000).toISOString();
    const st = events.find((e) => e.kind === "settled" && e.day === i);
    const ids = readings.filter((r) => r.day === i).map((r) => r.testId).join(" ");
    rows.push([
      String(i + 1),
      start,
      d.mark,
      String(d.passes),
      String(t.required),
      String(d.readings),
      st ? (Number(st.paid) / 1e6).toFixed(2) : "",
      st ? (Number(st.refunded) / 1e6).toFixed(2) : "",
      st?.tx ?? "",
      ids,
    ]);
  });
  const csv = rows.map((r) => r.map((c) => (/[",\s]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rollcall-term-${id}.csv"`,
    },
  });
}
