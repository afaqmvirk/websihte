"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pressStart2P } from "../fonts";
import { whenAppReady } from "./app-ready";

const MIN_MS = 500;
const EXIT_MS = 480;
const SLOT_COUNT = 8;

export default function LoadingScreen() {
  const [phase, setPhase] = useState<"loading" | "exit" | "done">("loading");
  const [slotFrame, setSlotFrame] = useState(0);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("loading-screen-active");
    return () => {
      document.documentElement.classList.remove("loading-screen-active");
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSlotFrame((frame) => (frame + 1) % SLOT_COUNT);
    }, 90);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    whenAppReady().then(() => {
      if (cancelled) return;

      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_MS - elapsed);
      window.setTimeout(() => {
        if (!cancelled) setPhase("exit");
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const finishExit = useCallback(() => {
    document.documentElement.classList.remove("loading-screen-active");
    setPhase("done");
  }, []);

  useEffect(() => {
    if (phase !== "exit") return;

    const el = screenRef.current;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!el || reducedMotion) {
      finishExit();
      return;
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "opacity") return;
      finishExit();
    };

    el.addEventListener("transitionend", onTransitionEnd);
    const fallback = window.setTimeout(finishExit, EXIT_MS + 80);

    return () => {
      el.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [phase, finishExit]);

  if (phase === "done") return null;

  return (
    <div
      ref={screenRef}
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
              className={`loading-screen__slot ${
                index === slotFrame ? "loading-screen__slot--on" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
