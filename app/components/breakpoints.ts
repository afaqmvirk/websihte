/**
 * Shared viewport breakpoints (px) — the single source for JS media queries.
 * `desktopMin` mirrors the Tailwind `min-[1024px]:` utilities used in the dark sections.
 */
export const BREAKPOINT = {
  /** Hero switches to its mobile canvas at/below this width. */
  heroMobileMax: 768,
  /** Hero stays in tablet layout up to this width; desktop is wider. */
  heroTabletMax: 1024,
  /** Desktop layout (dark-section arcs + `min-[1024px]:` styles) begins here. */
  desktopMin: 1024,
} as const;
