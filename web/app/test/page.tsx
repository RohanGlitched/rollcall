import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/Site";
import { TrialClient } from "./TrialClient";

export const metadata: Metadata = {
  title: "Be the school",
  description: "Open a three-day term contracted to your own network, run real M-Lab speed tests, and watch the contract pay or refund each day.",
};

export default function TestPage() {
  return (
    <>
      <div className="duct">
        <SiteHeader tone="duct" />
        <section className="mx-auto max-w-[1280px] px-4 pt-14 pb-14 sm:px-8 sm:pt-20">
          <h1 className="max-w-4xl text-[46px] leading-[0.98] font-bold tracking-[-0.045em] text-glass sm:text-[76px]">
            Be the school for three minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-glass/80">
            Your browser stands in for the probe in a school’s computer room. You run real speed tests; the contract decides
            what the provider is owed and lights or cuts each day. Nothing to install, no wallet, no sign-up.
          </p>
        </section>
      </div>
      <main className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-8">
        <TrialClient />
      </main>
      <SiteFooter />
    </>
  );
}
