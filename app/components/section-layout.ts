/** Figma dark sections — artboard 1512×1063 (combined bottom panel). */
export const SECTION_FIGMA_WIDTH = 1512;
export const SECTION_FIGMA_HEIGHT = 1063;

export const SECTION_BG = "#0e0e0e";

/** Hero headline band — matches hero.tsx LayoutConfig textLeft / textWidth. */
export const HERO_TEXT_BAND = {
  mobile: { left: 55, width: 533, artboard: 644 },
  tablet: { left: 62, width: 1388, artboard: 1512 },
  desktop: { left: 140, width: 999, artboard: 1512 },
} as const;

/** Hero text left edge as % of viewport — matches hero pctX(textLeft). */
export const HERO_TEXT_EDGE_VW = {
  mobile: 13.176,
  tablet: 6.772,
  desktop: 11.63,
} as const;

/** Full-bleed shell — horizontal padding via `.section-shell` in globals.css. */
export const SECTION_SHELL_CLASS = "section-shell";

/** @deprecated Shell is full-bleed; padding lives in `.section-shell` CSS. */
export const SECTION_SHELL_STYLE = {} as const;

/** @deprecated Use SECTION_SHELL_CLASS — same gutters as left shell. */
export const SECTION_SHELL_RIGHT_STYLE = SECTION_SHELL_STYLE;

/** Max width for left-aligned body copy — same as hero text block. */
export const SECTION_BODY_MAX_PX = HERO_TEXT_BAND.desktop.width;

export const pctX = (px: number) =>
  `${(px / SECTION_FIGMA_WIDTH) * 100}%`;
export const pctY = (px: number) =>
  `${(px / SECTION_FIGMA_HEIGHT) * 100}%`;
export const pctW = (px: number) =>
  `${(px / SECTION_FIGMA_WIDTH) * 100}%`;
export const sectionFont = (px: number, minPx: number, maxPx: number = px) =>
  `clamp(${minPx}px, ${(px / SECTION_FIGMA_WIDTH) * 100}vw, ${maxPx}px)`;
export const sectionPx = (px: number) =>
  `${(px / SECTION_FIGMA_WIDTH) * 100}vw`;

export type StampPhoto = {
  src: string;
  /** Optional crop for object-fit positioning inside the stamp window. */
  objectPosition?: string;
  objectScale?: number;
};

/** Stamp gallery photos from Figma Frame 39 (Rectangle 1196–1207). */
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
