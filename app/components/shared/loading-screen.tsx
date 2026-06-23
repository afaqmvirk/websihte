"use client";

import { useEffect, useState } from "react";
import { pressStart2P } from "@/fonts";
import { whenAppReady } from "@/components/shared/app-ready";

const MIN_MS = 500;
const EXIT_MS = 420;
const SLOT_COUNT = 8;
/** Stagger between slot fill animations. */
const SLOT_STAGGER_MS = 90;
/** Absolute backstop — never block the page indefinitely if app-ready stalls. */
const BACKSTOP_MS = 6000;

export default function LoadingScreen() {
  const [phase, setPhase] = useState<"loading" | "exit" | "done">("loading");

  useEffect(() => {
    document.documentElement.classList.add("loading-screen-active");
    return () => {
      document.documentElement.classList.remove("loading-screen-active");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    const dismiss = () => {
      if (cancelled) return;
      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_MS - elapsed);
      window.setTimeout(() => {
        if (!cancelled) setPhase("exit");
      }, wait);
    };

    whenAppReady().then(dismiss, dismiss);

    const backstop = window.setTimeout(dismiss, BACKSTOP_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(backstop);
    };
  }, []);

  useEffect(() => {
    if (phase !== "exit") return;

    const timer = window.setTimeout(() => {
      setPhase("done");
      document.documentElement.classList.remove("loading-screen-active");
    }, EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`loading-screen ${phase === "exit" ? "loading-screen--exit" : ""}`}
      aria-live="polite"
      aria-busy={phase === "loading"}
      role="status"
    >
      <div className="loading-screen__inner">
        <p className={`${pressStart2P.className} loading-screen__title`}>
          stupidifying...
        </p>

        <div className="loading-screen__slots" aria-hidden>
          {Array.from({ length: SLOT_COUNT }, (_, index) => (
            <span
              key={index}
              className="loading-screen__slot"
              style={{ animationDelay: `${index * SLOT_STAGGER_MS}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
