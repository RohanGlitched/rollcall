import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, PageHero } from "@/components/Site";
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
      <PageHero
        kicker={
          <>
            Term {id}.{" "}
            {kind === "sim"
              ? "A simulated school on the fast clock: one school day lasts one hour."
              : kind === "trial"
                ? "A visitor term: real M-Lab tests, two-minute school days."
                : kind === "real"
                  ? "Probe 0: real M-Lab tests on the real calendar."
                  : ""}
          </>
        }
        title={term.school}
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">
        <div className="mt-10">
          <TermClient id={id} initial={{ term, readings, events, at: Math.floor(Date.now() / 1000) }} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
