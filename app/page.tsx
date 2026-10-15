import Link from "next/link";
import Hero from "@/components/hero/hero";
import BottomSections from "@/components/sections/bottom-sections";
import OttawaSignupPopup from "@/components/sections/ottawa-signup-popup";

export default function Home() {
  return (
    <main className="relative min-h-0">
      <Link
        href="/ottawa"
        className="fixed inset-x-0 top-0 z-[10000] flex min-h-12 items-center justify-center gap-3 bg-section-bg px-5 py-3 text-center font-arial-narrow text-base leading-tight text-white no-underline transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white sm:text-lg"
      >
        <span>sign up for sih ottawa edition!!!</span>
        <span aria-hidden="true">→</span>
      </Link>
      <Hero />
      <BottomSections />
      <OttawaSignupPopup />
    </main>
  );
}
