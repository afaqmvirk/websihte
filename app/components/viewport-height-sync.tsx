"use client";

import { useLayoutEffect } from "react";

export function readViewportHeightPx() {
  if (typeof window === "undefined") return 900;

  const bodyVal = parseFloat(
    getComputedStyle(document.body).getPropertyValue("--app-height"),
  );
  if (Number.isFinite(bodyVal) && bodyVal > 200) return bodyVal;

  const visual = window.visualViewport?.height ?? 0;
  const inner = window.innerHeight ?? 0;
  return Math.max(visual, inner, 320);
}

/**
 * Keeps --app-height in sync with the visible viewport (excludes mobile URL bar).
 * Falls back to CSS svh/dvh when visualViewport is unavailable.
 */
export default function ViewportHeightSync() {
  useLayoutEffect(() => {
    const root = document.body;

    const sync = () => {
      const height = readViewportHeightPx();
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
    };

    sync();
    requestAnimationFrame(sync);

    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return null;
}
