"use client";

import { useEffect, useRef } from "react";

const OVERLAY_BLUE = "#1d4ed8";
/** Section top must rise to this viewport fraction before rotation begins (0–1). */
const ROTATION_START_VIEWPORT_RATIO = 0.68;

function rotationForSection(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const rotationStartTop = viewportHeight * ROTATION_START_VIEWPORT_RATIO;

  // 0° until the section top passes the start line, then −90° at the viewport top.
  const progress = Math.min(
    1,
    Math.max(0, (rotationStartTop - rect.top) / rotationStartTop),
  );
  return progress * -90;
}

function layoutOverlay(overlay: HTMLElement, section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const darkSections = document.getElementById("dark-sections");
  const extentBottom =
    darkSections?.getBoundingClientRect().bottom ?? rect.bottom;

  const top = rect.top;
  const width = rect.right;
  const height = Math.max(window.innerHeight - top, extentBottom - top);

  overlay.style.top = `${top}px`;
  overlay.style.right = "0px";
  overlay.style.width = `${width}px`;
  overlay.style.height = `${Math.max(height, 0)}px`;
}

export default function WhoWeAreScrollOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const section = overlay?.closest("section");
    if (!overlay || !section) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      layoutOverlay(overlay, section);
      const deg = rotationForSection(section);
      overlay.style.transform = `rotate3d(0, 0, 1, ${deg}deg)`;
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed z-[25]"
      style={{
        backgroundColor: OVERLAY_BLUE,
        transformOrigin: "top right",
        willChange: "transform",
      }}
      aria-hidden
    />
  );
}
