import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/Site";
import { readTerm, readingsFor, dayEventsFor } from "@/lib/server/reads";
import { TermClient } from "./TermClient";
import { kindOf } from "@/lib/schools";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = Number((await params).id);
  const t = await readTerm(id).catch(() => null);
  return { title: t ? `${t.school}, term ${id}` : `Term ${id}` };
}

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const term = await readTerm(id).catch(() => null);
  if (!term) notFound();
  const [readings, events] = await Promise.all([readingsFor(id).catch(() => null), dayEventsFor(id).catch(() => null)]);
  const kind = kindOf(term.school);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 pt-12 sm:px-6 sm:pt-16">
        <p className="text-[14px] text-muted">
          Term {id}.{" "}
          {kind === "sim"
            ? "A simulated school on the fast clock: one school day lasts one hour."
            : kind === "trial"
              ? "A visitor term: real M-Lab tests, two-minute school days."
              : kind === "real"
                ? "Probe 0: real M-Lab tests on the real calendar."
                : ""}
        </p>
        <h1 className="mt-2 max-w-4xl text-[36px] font-semibold leading-[1.1] sm:text-[48px]">{term.school}</h1>
        <div className="mt-10">
          <TermClient id={id} initial={{ term, readings, events, at: Math.floor(Date.now() / 1000) }} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
