import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, PageHero } from "@/components/Site";
import { FunderConsole } from "./FunderConsole";

export const metadata: Metadata = {
  title: "Open a term for a real school",
  description: "Fund a school's internet by the working day: name the school's probe, the provider and the arbiter, set what a working day means, and lock the term on chain.",
};

export default function OpenPage() {
  return (
    <>
      <PageHero
        title="Open a term for a real school"
        lede={
          <>
            Everything the demo does, with your own wallet. Name the school’s probe, the provider and the arbiter, set what a working
            day means, and lock the term. The provider accepts from its own wallet; the probe sends readings to this site’s attester.
            Need a probe? Use the{" "}
            <Link className="underline decoration-glass/40 underline-offset-4 hover:decoration-glass" href="/probe">
              probe kit
            </Link>
            .
          </>
        }
      />
      <main className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-8">
        <FunderConsole />
      </main>
      <SiteFooter />
    </>
  );
}
