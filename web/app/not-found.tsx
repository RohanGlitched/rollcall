import Link from "next/link";
import { SiteFooter, PageHero } from "@/components/Site";

export default function NotFound() {
  return (
    <>
      <PageHero
        title="This strand is cut."
        lede="The page you asked for does not exist. If you followed a link to a term, it may not have been opened yet."
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-glass px-6 py-3 text-[15px] font-semibold text-duct hover:bg-white">
            Back to the register
          </Link>
          <Link href="/terms" className="rounded-full border border-glass/25 px-6 py-3 text-[15px] font-semibold text-glass hover:border-glass/60">
            Every term on chain
          </Link>
        </div>
      </PageHero>
      <SiteFooter />
    </>
  );
}
