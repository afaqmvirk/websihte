/**
 * Desktop design-canvas width — the single source for vw-based scaling.
 * The hero and the dark sections share this canvas width.
 */
export const DESIGN_WIDTH = 1512;

/** Dark sections background — resolves to the `--section-bg` token in globals.css. */
export const SECTION_BG = "var(--section-bg)";

/** Full-bleed shell — horizontal padding via `.section-shell` in globals.css. */
export const SECTION_SHELL_CLASS = "section-shell";

/** Max width for left-aligned body copy — matches hero desktop text block (`DESKTOP_LAYOUT.textWidth` in hero.tsx). */
export const SECTION_BODY_MAX_PX = 999;

export const sectionFont = (px: number, minPx: number, maxPx: number = px) =>
  `clamp(${minPx}px, ${(px / DESIGN_WIDTH) * 100}vw, ${maxPx}px)`;
export const sectionPx = (px: number) =>
  `${(px / DESIGN_WIDTH) * 100}vw`;

export type StampPhoto = {
  src: string;
  /** Optional crop for object-fit positioning inside the stamp window. */
  objectPosition?: string;
  objectScale?: number;
};

/** Stamp gallery photos. */
export const STAMP_PHOTOS: StampPhoto[] = [
  { src: "/sections/stamps/1.jpg" },
  { src: "/sections/stamps/2.jpg" },
  {
    src: "/sections/stamps/3.jpg",
    objectPosition: "30% 20%",
    objectScale: 1.75,
  },
  {
    src: "/sections/stamps/4.jpg",
    objectPosition: "55% 35%",
    objectScale: 2.2,
  },
  { src: "/sections/stamps/5.jpg" },
  {
    src: "/sections/stamps/6.jpg",
    objectPosition: "35% 45%",
    objectScale: 1.15,
  },
  { src: "/sections/stamps/7.jpg" },
  { src: "/sections/stamps/8.jpg" },
  {
    src: "/sections/stamps/9.jpg",
    objectPosition: "70% 40%",
    objectScale: 1.9,
  },
  { src: "/sections/stamps/10.jpg" },
  { src: "/sections/stamps/11.jpg" },
  { src: "/sections/stamps/12.jpg" },
];
