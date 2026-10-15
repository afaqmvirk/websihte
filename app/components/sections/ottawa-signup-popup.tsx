"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { whenAppReady } from "@/components/shared/app-ready";

const POPUP_DELAY_MS = 5000;
const SCROLL_TRIGGER_PX = 240;
const SESSION_KEY = "sih-ottawa-signup-shown";

export default function OttawaSignupPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // The popup still works when browser storage is unavailable.
    }

    let cancelled = false;
    let shown = false;
    let timer: number | undefined;

    const show = () => {
      if (
        cancelled ||
        shown ||
        document.documentElement.classList.contains("loading-screen-active")
      ) {
        return;
      }

      shown = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);

      try {
        window.sessionStorage.setItem(SESSION_KEY, "true");
      } catch {
        // Keep the once-per-page behaviour if storage is blocked.
      }

      setIsOpen(true);
    };

    const onScroll = () => {
      if (window.scrollY >= SCROLL_TRIGGER_PX) show();
    };

    void whenAppReady().then(() => {
      if (cancelled) return;
      timer = window.setTimeout(show, POPUP_DELAY_MS);
      window.addEventListener("scroll", onScroll, { passive: true });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div aria-live="polite">
      {isOpen && (
        <aside
          aria-labelledby="ottawa-signup-title"
          className="fixed right-5 bottom-5 z-[10001] w-[min(25rem,calc(100vw-2.5rem))] border-2 border-black bg-[#f5f2eb] p-6 text-black shadow-[6px_6px_0_#0e0e0e] sm:right-8 sm:bottom-8 sm:p-7"
        >
          <button
            type="button"
            aria-label="dismiss Ottawa signup popup"
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-1 grid size-11 cursor-pointer place-items-center text-3xl leading-none transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-black"
          >
            <span aria-hidden="true">×</span>
          </button>
          <h2
            id="ottawa-signup-title"
            className="m-0 pr-6 font-arial-narrow text-4xl leading-none tracking-tight"
          >
            ottawa is calling.
          </h2>
          <p className="mt-3 mb-5 font-arial text-base leading-snug">
            got a stupid idea? bring it to sih ottawa edition!!!
          </p>
          <Link
            href="/ottawa"
            onClick={() => setIsOpen(false)}
            className="inline-flex min-h-11 items-center gap-4 rounded-full border border-black px-5 py-2 font-arial-narrow text-lg text-black no-underline transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            sign up for ottawa
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      )}
    </div>
  );
}
