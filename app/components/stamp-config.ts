/**
 * Manual tuning for stamp arcs + sticky envelope.
 * Edit values here — both arcs read from this file.
 */

export type StampArcCorner = "bottom-left" | "top-right";

/**
 * Stamp-frame geometry in px within the 183×183 stamp-frame.png artwork —
 * the single source for both the orbiting arc and the flying/landed stamp.
 */
export const STAMP_FRAME = {
  size: 183,
  photoInset: 12.56,
  photoWidth: 159.1,
  photoHeight: 161.2,
} as const;

/** Photo window placement as fractions of the stamp size. */
export const STAMP_PHOTO_RATIOS = {
  inset: STAMP_FRAME.photoInset / STAMP_FRAME.size,
  width: STAMP_FRAME.photoWidth / STAMP_FRAME.size,
  height: STAMP_FRAME.photoHeight / STAMP_FRAME.size,
} as const;

/** Ellipse + motion for one stamp arc. */
export type StampArcEllipseConfig = {
  /** Vertical semi-axis as a fraction of viewport height (e.g. 0.5 = half screen). */
  bViewportRatio: number;
  /** Horizontal semi-axis = b × aRatio (larger = wider / sharper curve). */
  aRatio: number;
  /** Seconds for one full orbit along the ellipse. */
  lapDurationS: number;
  /** Negative margin pulls stamps outside the section clip (top). */
  clipMarginTop: number;
  /** Negative margin pulls stamps outside the section clip (bottom). */
  clipMarginBottom: number;
  /** Horizontal offset from section edge to arc anchor (px). */
  insetXPx: number;
  /** Vertical offset from section edge to arc anchor (px). */
  insetYPx: number;
  /** Rotation of the photo inside the stamp window (degrees). Frame stays upright. */
  photoRotateDeg: number;
};

/** Sticky envelope at the bottom of the combined who-we-are + events block. */
export type EnvelopeConfig = {
  maxWidthPx: number;
  widthVw: number;
  /** Push envelope down (% of its height). Does not affect scroll. */
  translateYPercent: number;
  /** Whole-envelope rotation (degrees). */
  rotateDeg: number;
  /** Rotation on mobile — upright. */
  rotateDegMobile: number;
  /** Hover scale multiplier. */
  hoverScale: number;
  /** Scale when engaged (hover, collect, drag, click). */
  engagedScale: number;
  pocketLeft: string;
  pocketTop: string;
  pocketWidth: string;
  pocketHeight: string;
  /** Fly target — top-center opening (SVG hinge line). */
  entryTop: string;
  entryWidth: string;
};

/**
 * Shared defaults — the single source for values common to every arc.
 * Corner blocks list ONLY the fields that differ from these.
 */
const ARC_DEFAULTS: StampArcEllipseConfig = {
  bViewportRatio: 0.7,
  aRatio: 0.85,
  lapDurationS: 52,
  clipMarginTop: -0.48,
  clipMarginBottom: -0.48,
  insetXPx: -242,
  insetYPx: 200,
  photoRotateDeg: 90,
};

export const STAMP_ARC_CONFIG: Record<
  StampArcCorner,
  StampArcEllipseConfig
> = {
  /** Who we are — arc peeks from bottom-right, bottom-left quadrant visible. */
  "bottom-left": {
    ...ARC_DEFAULTS,
  },
  /** Events / sponsor — arc peeks from top-left, top-right quadrant visible. */
  "top-right": {
    ...ARC_DEFAULTS,
    bViewportRatio: 0.75,
    aRatio: 0.95,
    insetXPx: -62,
    photoRotateDeg: 270,
  },
};

export const ENVELOPE_CONFIG: EnvelopeConfig = {
  maxWidthPx: 360,
  widthVw: 30,
  translateYPercent: 52,
  rotateDeg: -8,
  rotateDegMobile: 0,
  hoverScale: 1.03,
  engagedScale: 1.14,
  pocketLeft: "38%",
  pocketTop: "58%",
  pocketWidth: "24%",
  pocketHeight: "16%",
  entryTop: "21.5%",
  entryWidth: "28%",
};

export function getArcConfig(corner: StampArcCorner): StampArcEllipseConfig {
  return STAMP_ARC_CONFIG[corner];
}

/** Build CSS transform for photo inside stamp window. */
export function stampPhotoTransform(
  photo: { objectScale?: number },
  rotateDeg: number,
): string | undefined {
  const parts: string[] = [];
  if (rotateDeg) parts.push(`rotate(${rotateDeg}deg)`);
  if (photo.objectScale) parts.push(`scale(${photo.objectScale})`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
