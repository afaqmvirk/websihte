"use client";

import Image from "next/image";
import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
} from "react";
import MagnifierCursor from "./magnifier-cursor";
import RelicHalftoneImage, { relicObjectFitClass } from "./relic-halftone-image";
import { markAppReady } from "./app-ready";
import { DESIGN_WIDTH } from "./section-layout";
import { BREAKPOINT } from "./breakpoints";

/** Hero design-canvas dimensions (shares DESIGN_WIDTH with the dark sections). */
const DESIGN_HEIGHT = 982;
/** Mobile hero design canvas. */
const MOBILE_DESIGN_WIDTH = 644;
const MOBILE_DESIGN_HEIGHT = 1214;
const MOBILE_BREAKPOINT = BREAKPOINT.heroMobileMax;
/** Up to this width: desktop layout but hide crowded right-column relics (e.g. iPad Air). */
const TABLET_MAX_WIDTH = BREAKPOINT.heroTabletMax;
/** Relic ids visible on the mobile hero. */
const MOBILE_RELIC_IDS = new Set([1, 2, 3, 4, 7, 8]);
/** Rightmost relics hidden on tablet widths (desktop canvas). */
const TABLET_HIDDEN_RELIC_IDS = new Set([10, 11, 12, 13]);

type ViewportTier = "mobile" | "tablet" | "desktop";

/** Relic photos scaled from center relative to the design layout (1 = full design size). */
const RELIC_SCALE = 1.1;

/** Pull content inward from viewport edges (design px); extra top/bottom breathing room. */
const SCENE_INSET = {
  desktop: { top: 72, bottom: 72, left: 44, right: 44 },
  tablet: { top: 72, bottom: 72, left: 44, right: 44 },
  mobile: { top: 96, bottom: 96, left: 36, right: 36 },
} as const;
/** Extra overlap in px at the bubble anchor (scaled to viewport height). */
const BUBBLE_OVERLAP = 6;
/** Relics above this design Y get bubbles anchored to the image bottom. */
const TOP_RELIC_Y = 130;
const BUBBLE_ANCHOR_Y = 0.7;
/** Extra distance (design px, scaled to scene) before the lens shrinks after leaving a relic. */
const FOCUS_SHRINK_PADDING = 40;

const FONT_ARIAL_NARROW = "var(--font-arial-narrow)";

type Relic = {
  id: number;
  src: string;
  width: number;
  height: number;
  designX: number;
  designY: number;
  designW: number;
  designH: number;
  objectFit?: "cover" | "contain" | "bottom";
  zIndex?: number;
  caption?: string;
  /** Override automatic left/center/right bubble anchoring. */
  bubbleAlign?: "left" | "center" | "right";
};

type LayoutConfig = {
  width: number;
  height: number;
  textLeft: number;
  textWidth: number;
  textBottom: number;
  ctaLabel: "hover" | "drag";
  headline: { design: number; min: number; max: number };
  body: { design: number; min: number; max: number };
  blockGap: number;
  inset: (typeof SCENE_INSET)[keyof typeof SCENE_INSET];
};

const DESKTOP_LAYOUT: LayoutConfig = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  textLeft: 140,
  textWidth:999,
  textBottom: 35,
  ctaLabel: "hover",
  headline: { design: 72, min: 28, max: 72 },
  body: { design: 24, min: 14, max: 24 },
  blockGap: 4,
  inset: SCENE_INSET.desktop,
};

const TABLET_LAYOUT: LayoutConfig = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  textLeft: 62,
  /** Nearly full canvas width so copy spans the scene on iPad-sized viewports. */
  textWidth: DESIGN_WIDTH - 62 * 2,
  textBottom: 35,
  ctaLabel: "hover",
  headline: { design: 96, min: 40, max: 64 },
  body: { design: 30, min: 18, max: 28 },
  blockGap: 4,
  inset: SCENE_INSET.tablet,
};

const MOBILE_LAYOUT: LayoutConfig = {
  width: MOBILE_DESIGN_WIDTH,
  height: MOBILE_DESIGN_HEIGHT,
  textLeft: 55,
  textWidth: 533,
  textBottom: 60,
  ctaLabel: "drag",
  headline: { design: 72, min: 22, max: 46 },
  body: { design: 24, min: 13, max: 17 },
  blockGap: 4,
  inset: SCENE_INSET.mobile,
};

/** Shared line-height tokens (tighter than the design defaults). */
const HEADLINE_LINE_HEIGHT = 1.02;
const BODY_LINE_HEIGHT = 1.1;

type RelicOverride = {
  designX?: number;
  designY?: number;
  designW?: number;
  designH?: number;
  objectFit?: Relic["objectFit"];
  rotation?: number;
  borderRadius?: string;
};

const MOBILE_RELIC_OVERRIDES: Partial<Record<number, RelicOverride>> = {
  1: { designX: 115, designY: 22 },
  2: { designX: 353.16, designY: 179, designW: 261.09, designH: 206.17 },
  3: {
    designX: 5,
    designY: 207,
    designW: 286.2,
    designH: 310.87,
    rotation: -13.73,
  },
  4: { designX: 351, designY: 362 },
  7: { designX: 23, designY: 518, designW: 330, designH: 240 },
  8: { designX: 451, designY: 603, designW: 223.36, designH: 274.7 },
};

function getLayout(tier: ViewportTier): LayoutConfig {
  if (tier === "mobile") return MOBILE_LAYOUT;
  if (tier === "tablet") return TABLET_LAYOUT;
  return DESKTOP_LAYOUT;
}

function getLayoutMappers(layout: LayoutConfig) {
  const { width: w, height: h, inset } = layout;
  const contentW = w - inset.left - inset.right;
  const contentH = h - inset.top - inset.bottom;

  return {
    mapX: (px: number) => inset.left + (px / w) * contentW,
    mapY: (px: number) => inset.top + (px / h) * contentH,
    mapW: (px: number) => (px / w) * contentW,
    mapH: (px: number) => (px / h) * contentH,
    mapBottom: (px: number) => inset.bottom + (px / h) * contentH,
  };
}

function createPctHelpers(layout: LayoutConfig) {
  const w = layout.width;
  const h = layout.height;
  const { mapX, mapY, mapW, mapH, mapBottom } = getLayoutMappers(layout);

  return {
    pctX: (px: number) => `${(mapX(px) / w) * 100}%`,
    pctY: (px: number) => `${(mapY(px) / h) * 100}%`,
    pctBottom: (px: number) => `${(mapBottom(px) / h) * 100}%`,
    pctW: (px: number) => `${(mapW(px) / w) * 100}%`,
    pctH: (px: number) => `${(mapH(px) / h) * 100}%`,
    designFont: (px: number, minPx: number, maxPx: number = px) =>
      `clamp(${minPx}px, ${(px / w) * 100}vw, ${maxPx}px)`,
    designSpaceY: (px: number) =>
      `calc(${(mapH(px) / h) * 100} * var(--app-height) / 100)`,
    designPx: (px: number) => `${(mapW(px) / w) * 100}vw`,
  };
}

function resolveRelic(
  relic: Relic,
  tier: ViewportTier,
): (Relic & RelicOverride) | null {
  if (tier === "mobile" && !MOBILE_RELIC_IDS.has(relic.id)) return null;
  if (tier === "tablet" && TABLET_HIDDEN_RELIC_IDS.has(relic.id)) return null;
  if (tier === "mobile") {
    return { ...relic, ...MOBILE_RELIC_OVERRIDES[relic.id] };
  }
  if (tier === "tablet") {
    return spreadRelicForTablet(relic);
  }
  return relic;
}

function relicImageSizes(relic: Relic): string {
  const mobileVw = Math.ceil(
    ((relic.designW * RELIC_SCALE) / MOBILE_DESIGN_WIDTH) * 100,
  );
  const desktopVw = Math.ceil(
    ((relic.designW * RELIC_SCALE) / DESIGN_WIDTH) * 100,
  );
  return `(max-width: ${MOBILE_BREAKPOINT}px) ${mobileVw}vw, ${desktopVw}vw`;
}

function useHeroViewport(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => {
    if (typeof window === "undefined") return "desktop";
    const width = window.innerWidth;
    if (width <= MOBILE_BREAKPOINT) return "mobile";
    if (width <= TABLET_MAX_WIDTH) return "tablet";
    return "desktop";
  });

  useLayoutEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width <= MOBILE_BREAKPOINT) {
        setTier("mobile");
      } else if (width <= TABLET_MAX_WIDTH) {
        setTier("tablet");
      } else {
        setTier("desktop");
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return tier;
}

const relics: Relic[] = [
  {
    id: 1,
    src: "/1.png",
    width: 375,
    height: 166,
    designX: 149,
    designY: 81,
    designW: 374.82,
    designH: 165.49,
    objectFit: "bottom",
    zIndex: 3,
    caption:
      "a group of 4 ambitious individuals discussing the future of sih",
  },
  {
    id: 2,
    src: "/2.png",
    width: 278,
    height: 177,
    designX: 104.41,
    designY: 268.01,
    designW: 261.09,
    designH: 206.17,
    objectFit: "bottom",
    zIndex: 2,
    caption: "the soon to be lickatron3000 (09.27.2025)",
  },
  {
    id: 3,
    src: "/3.png",
    width: 292,
    height: 313,
    designX: 412,
    designY: 283,
    designW: 286.2,
    designH: 310.87,
    objectFit: "bottom",
    zIndex: 4,
    caption: "catch a mirror selfie back to 2016",
  },
  {
    id: 4,
    src: "/4.png",
    width: 238,
    height: 249,
    designX: 629,
    designY: 428,
    designW: 237.14,
    designH: 249,
    objectFit: "bottom",
    zIndex: 5,
    caption: "sihck stihcker (03.30.2026)",
  },
  {
    id: 5,
    src: "/5.png",
    width: 368,
    height: 246,
    designX: 180,
    designY: 430,

    designW: 367.93,
    designH: 245.32,
    objectFit: "bottom",
    zIndex: 3,
    caption: "we love singapore stupid hacks",
  },
  {
    id: 6,
    src: "/6.png",
    width: 296,
    height: 257,
    designX: 468,
    designY: 10,
    designW: 295.87,
    designH: 277.38,
    objectFit: "bottom",
    zIndex: 2,
    caption: "catch us at socratica symposium 2026",
  },
  {
    id: 7,
    src: "/7.png",
    width: 330,
    height: 240,
    designX: 671,
    designY: 188,
    designW: 330,
    designH: 240,
    objectFit: "bottom",
    zIndex: 6,
    caption: "stupid fits",
  },
  {
    id: 8,
    src: "/8.png",
    width: 224,
    height: 275,       
    designX: 1142,
    designY: 400.06, 
    designW: 223.36,
    designH: 274.7,
    objectFit: "bottom",
    zIndex: 5,
    caption: "spongebob... or is it cheese",
  },
  {
    id: 9,
    src: "/9.png",
    width: 311,
    height: 195,
    designX: 844,
    designY: 539,
    designW: 294.6,
    designH: 185,
    objectFit: "bottom",
    zIndex: 4,
    caption: "pitched sih to hundreds",
  },
  {
    id: 10,
    src: "/10.png",
    width: 304,
    height: 265,
    designX: 945,
    designY: 242,

    designW: 303.54,
    designH: 264.63,
    objectFit: "bottom",
    zIndex: 5,
    caption: "hard at work or hardly working?",
  },
  {
    id: 11,
    src: "/11.png",
    width: 285,
    height: 214,
    designX: 938,
    designY: 81,
    designW: 284.68,
    designH: 173.23,
    objectFit: "bottom",
    zIndex: 4,
    caption: "yer a sihzard!",
  },
  {
    id: 12,
    src: "/12.png",
    width: 255,
    height: 288,
    designX: 1188,
    designY: 110,
    designW: 253.99,
    designH: 284.65,
    objectFit: "bottom",
    zIndex: 5,
    bubbleAlign: "center",
    caption: "jb pls sponsor us!",
  },
  {
    id: 13,
    src: "/13.png",
    width: 271,
    height: 314,     
    designX: 1064,
    designY: 635,
    designW: 241.39,
    designH: 313.4,
    objectFit: "bottom",
    zIndex: 3,
    caption: "diy lightning in a bottle",
  },
];

function getRelicLayoutRect(relic: Relic) {
  const scaledW = relic.designW * RELIC_SCALE;
  const offsetX = (relic.designW - scaledW) / 2;
  return {
    left: relic.designX + offsetX,
    width: scaledW,
  };
}

/** Stretch visible tablet relics to fill the content area (tablet margins only). */
function computeTabletSpread() {
  const layout = TABLET_LAYOUT;
  let minLeft = Infinity;
  let maxRight = 0;
  let minTop = Infinity;
  let maxBottom = 0;

  for (const relic of relics) {
    if (TABLET_HIDDEN_RELIC_IDS.has(relic.id)) continue;
    const { left, width } = getRelicLayoutRect(relic);
    minLeft = Math.min(minLeft, left);
    maxRight = Math.max(maxRight, left + width);
    minTop = Math.min(minTop, relic.designY);
    maxBottom = Math.max(maxBottom, relic.designY + relic.designH);
  }

  const targetLeft = layout.textLeft;
  const targetRight = layout.width - layout.textLeft;
  /** Room for headline + body above the bottom inset. */
  const textReserve = 210;
  const targetTop = layout.inset.top;
  const targetBottom = layout.height - layout.textBottom - textReserve;

  const contentWidth = maxRight - minLeft;
  const contentHeight = maxBottom - minTop;

  return {
    minLeft,
    minTop,
    scaleX: contentWidth > 0 ? (targetRight - targetLeft) / contentWidth : 1,
    scaleY: contentHeight > 0 ? (targetBottom - targetTop) / contentHeight : 1,
    targetLeft,
    targetTop,
  };
}

const TABLET_SPREAD = computeTabletSpread();

function spreadRelicForTablet(relic: Relic): Relic {
  const { minLeft, minTop, scaleX, scaleY, targetLeft, targetTop } =
    TABLET_SPREAD;
  const { left } = getRelicLayoutRect(relic);
  const newLeft = targetLeft + (left - minLeft) * scaleX;
  const newDesignY = targetTop + (relic.designY - minTop) * scaleY;
  const newDesignW = relic.designW * scaleX;
  const newScaledW = newDesignW * RELIC_SCALE;
  const newOffsetX = (newDesignW - newScaledW) / 2;

  return {
    ...relic,
    designX: newLeft - newOffsetX,
    designY: newDesignY,
    designW: newDesignW,
  };
}

const CIRCLED_NUMBERS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬",
];

function getRelicSceneRect(
  relic: Relic,
  layout: LayoutConfig,
  sceneWidth: number,
  sceneHeight: number,
  paddingDesignPx = 0,
) {
  const { mapX, mapY, mapW, mapH } = getLayoutMappers(layout);
  const scaledW = relic.designW * RELIC_SCALE;
  const scaledH = relic.designH * RELIC_SCALE;
  const offsetX = (relic.designW - scaledW) / 2;
  const offsetY = (relic.designH - scaledH) / 2;
  const padX = (paddingDesignPx / layout.width) * sceneWidth;
  const padY = (paddingDesignPx / layout.height) * sceneHeight;
  const left = mapX(relic.designX + offsetX);
  const top = mapY(relic.designY + offsetY);
  const width = mapW(scaledW);
  const height = mapH(scaledH);

  return {
    left: (left / layout.width) * sceneWidth - padX,
    top: (top / layout.height) * sceneHeight - padY,
    right: ((left + width) / layout.width) * sceneWidth + padX,
    bottom: ((top + height) / layout.height) * sceneHeight + padY,
  };
}

function hitTestRelics(
  localX: number,
  localY: number,
  sceneWidth: number,
  sceneHeight: number,
  tier: ViewportTier,
  paddingDesignPx = 0,
) {
  const layout = getLayout(tier);
  for (const relic of relics) {
    const resolved = resolveRelic(relic, tier);
    if (!resolved) continue;
    const rect = getRelicSceneRect(
      resolved,
      layout,
      sceneWidth,
      sceneHeight,
      paddingDesignPx,
    );
    if (
      localX >= rect.left &&
      localX <= rect.right &&
      localY >= rect.top &&
      localY <= rect.bottom
    ) {
      return relic.id;
    }
  }
  return null;
}

function getBubbleAlign(
  relic: Relic,
  layout: LayoutConfig,
): "left" | "center" | "right" {
  const nearLeft = relic.designX < layout.textLeft;
  const nearRight =
    relic.designX + relic.designW > layout.width - layout.textLeft;
  if (nearRight && !nearLeft) return "right";
  if (nearLeft && !nearRight) return "left";
  return "center";
}

function RelicSpeechBubble({
  relic,
  layout,
  lensOnly = false,
}: {
  relic: Relic;
  layout: LayoutConfig;
  lensOnly?: boolean;
}) {
  const { designFont, designSpaceY, designPx } = createPctHelpers(layout);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isTopRelic = relic.designY < TOP_RELIC_Y;
  const fixedAlign = relic.bubbleAlign;
  const [align, setAlign] = useState(
    () => fixedAlign ?? getBubbleAlign(relic, layout),
  );
  const [nudge, setNudge] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (lensOnly) return;

    const bubble = bubbleRef.current;
    const scene = bubble?.closest("[data-hero-scene]") as HTMLElement | null;
    if (!bubble || !scene || !relic.caption) return;

    const pad = 8;
    const sceneRect = scene.getBoundingClientRect();
    const rect = bubble.getBoundingClientRect();

    let dx = 0;
    let dy = 0;

    if (rect.left < sceneRect.left + pad) {
      dx += sceneRect.left + pad - rect.left;
      if (align === "center") setAlign("left");
    }
    if (rect.right > sceneRect.right - pad) {
      dx -= rect.right - (sceneRect.right - pad);
      if (align === "center" && !fixedAlign) setAlign("right");
    }
    if (rect.top < sceneRect.top + pad) {
      dy += sceneRect.top + pad - rect.top;
    }
    if (rect.bottom > sceneRect.bottom - pad) {
      dy -= rect.bottom - (sceneRect.bottom - pad);
    }

    setNudge({ x: dx, y: dy });
  }, [relic.id, relic.caption, align, isTopRelic, lensOnly, fixedAlign]);

  if (!relic.caption) return null;

  const overlap = designSpaceY(BUBBLE_OVERLAP);
  const translateX =
    align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
  const translateY = isTopRelic
    ? `calc(-100% + ${overlap})`
    : `calc(-50% + ${overlap})`;

  const style: CSSProperties = {
    position: "absolute",
    width: "max-content",
    maxWidth: `min(${designPx(227.504)}, calc(100vw - ${designPx(layout.textLeft * 2)}))`,
    top: isTopRelic ? "100%" : `${BUBBLE_ANCHOR_Y * 100}%`,
    ...(align === "right"
      ? { right: 0, left: "auto" }
      : align === "left"
        ? { left: 0 }
        : { left: "50%" }),
    transform: [
      `translate(${translateX}, ${translateY})`,
      `translate(${nudge.x}px, ${nudge.y}px)`,
    ].join(" "),
  };

  return (
    <div
      ref={bubbleRef}
      className="pointer-events-none absolute z-30"
      style={style}
    >
      <div
        className="border border-black bg-white text-center text-black"
        style={{
          padding: `${designSpaceY(10)} ${designPx(11)}`,
          fontFamily: FONT_ARIAL_NARROW,
          fontSize: designFont(16, 11, 16),
          letterSpacing: designPx(-0.32),
          lineHeight: 1.15,
        }}
      >
        <span className="mr-0.5">{CIRCLED_NUMBERS[relic.id - 1]}</span>
        {relic.caption}
      </div>
    </div>
  );
}

function HeroTextBlock({
  layout,
  fitScale,
  onFitScaleChange,
  measureFit = true,
}: {
  layout: LayoutConfig;
  fitScale: number;
  onFitScaleChange?: (scale: number) => void;
  /** Only the visible scene measures; the lens clone reuses the same scale. */
  measureFit?: boolean;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const { pctX, pctBottom, pctW, designFont, designSpaceY, designPx } =
    createPctHelpers(layout);

  useLayoutEffect(() => {
    let raf = 0;

    const finishLayout = () => {
      markAppReady("hero-layout");
    };

    if (!measureFit || !onFitScaleChange) {
      raf = requestAnimationFrame(finishLayout);
      return () => cancelAnimationFrame(raf);
    }

    const block = blockRef.current;
    const scene = block?.closest("[data-hero-scene]") as HTMLElement | null;
    if (!block || !scene) {
      raf = requestAnimationFrame(finishLayout);
      return () => cancelAnimationFrame(raf);
    }

    const measure = () => {
      block.style.transform = "";
      const sceneRect = scene.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      const safeBottom = 8;
      const overflow = blockRect.bottom - sceneRect.bottom + safeBottom;

      if (overflow > 1) {
        const next = Math.max(
          0.72,
          (blockRect.height - overflow) / blockRect.height,
        );
        onFitScaleChange(next);
      } else {
        onFitScaleChange(1);
      }
    };

    measure();
    raf = requestAnimationFrame(() => {
      measure();
      finishLayout();
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [layout.width, layout.height, measureFit, onFitScaleChange]);

  return (
    <div
      ref={blockRef}
      data-hero-text-block
      className="hero-text-block pointer-events-none absolute z-10 box-border flex flex-col items-start"
      style={{
        left: pctX(layout.textLeft),
        bottom: `calc(${pctBottom(layout.textBottom)} + env(safe-area-inset-bottom, 0px))`,
        width: pctW(layout.textWidth),
        maxWidth: `calc(100% - ${pctX(layout.textLeft * 2)})`,
        gap: designSpaceY(layout.blockGap),
        transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
        transformOrigin: "bottom left",
      }}
    >
      <h1
        className="m-0 max-w-full text-balance text-black"
        style={{
          fontFamily: FONT_ARIAL_NARROW,
          fontSize: designFont(
            layout.headline.design,
            layout.headline.min,
            layout.headline.max,
          ),
          letterSpacing: designPx(-2.88),
          lineHeight: HEADLINE_LINE_HEIGHT,
        }}
      >
        the stupid ideas hackathon community.
      </h1>
      <div
        className="max-w-full font-arial-narrow text-black"
        style={{
          fontSize: designFont(
            layout.body.design,
            layout.body.min,
            layout.body.max,
          ),
          letterSpacing: designPx(-0.48),
          lineHeight: BODY_LINE_HEIGHT,
        }}
      >
        <p className="m-0">
          a decentralized community reclaiming the joy of building, one stupid
          idea at a time.
        </p>
      </div>
      <div className="flex max-w-full flex-wrap items-center">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-black bg-white font-arial-narrow text-black"
          style={{
            padding: `${designSpaceY(4)} ${designPx(16)}`,
            fontSize: designFont(
              layout.body.design,
              layout.body.min,
              layout.body.max,
            ),
            letterSpacing: designPx(-0.48),
            lineHeight: 1,
          }}
        >
          {layout.ctaLabel}
        </span>
        <span
          className="font-arial-narrow text-black"
          style={{
            fontSize: designFont(
              layout.body.design,
              layout.body.min,
              layout.body.max,
            ),
            letterSpacing: designPx(-0.48),
            lineHeight: 1,
          }}
        >
          {" to see some of our past relics."}
        </span>
      </div>
    </div>
  );
}

function renderRelicImage(
  relic: Relic & RelicOverride,
  interactive: boolean,
  halftoneActive: boolean,
  enableHalftoneLayer: boolean,
) {
  const objectFit =
    relic.objectFit === "cover"
      ? "cover"
      : relic.objectFit === "bottom"
        ? "bottom"
        : "contain";

  if (enableHalftoneLayer) {
    return (
      <RelicHalftoneImage
        src={relic.src}
        alt={interactive ? `relic ${relic.id}` : ""}
        width={relic.width}
        height={relic.height}
        sizes={relicImageSizes(relic)}
        objectFit={objectFit}
        priority={interactive && relic.id <= 4}
        halftoneActive={halftoneActive}
        aria-hidden={!interactive}
      />
    );
  }

  return (
    <Image
      src={relic.src}
      alt={interactive ? `relic ${relic.id}` : ""}
      width={relic.width}
      height={relic.height}
      draggable={false}
      sizes={relicImageSizes(relic)}
      className={relicObjectFitClass(relic.objectFit)}
      priority={interactive && relic.id <= 4}
      aria-hidden={!interactive}
    />
  );
}

type HeroSceneProps = {
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  viewportTier: ViewportTier;
  interactive?: boolean;
  /** Lens clone always renders full color. */
  forceFullColor?: boolean;
  lensExpanded?: boolean;
  /** Touch-drag magnifier engaged — mobile halftone only while true. */
  magnifierActive?: boolean;
  /** Speech bubbles only — magnifier overlay above glass. */
  bubblesOnly?: boolean;
  textFitScale?: number;
  onTextFitScaleChange?: (scale: number) => void;
  measureTextFit?: boolean;
};

function HeroScene({
  hoveredId,
  onHover,
  viewportTier,
  interactive = true,
  forceFullColor = false,
  lensExpanded = false,
  magnifierActive = false,
  bubblesOnly = false,
  textFitScale = 1,
  onTextFitScaleChange,
  measureTextFit = false,
}: HeroSceneProps) {
  const isMobile = viewportTier === "mobile";
  const layout = getLayout(viewportTier);
  const { pctX, pctY, pctW, pctH } = createPctHelpers(layout);
  const halftoneRelics =
    !forceFullColor &&
    interactive &&
    lensExpanded &&
    (!isMobile || magnifierActive);
  const enableHalftoneLayer = !forceFullColor && interactive;

  const relicStyle = (relic: Relic & RelicOverride) => {
    const scaledW = relic.designW * RELIC_SCALE;
    const scaledH = relic.designH * RELIC_SCALE;
    const offsetX = (relic.designW - scaledW) / 2;
    const offsetY = (relic.designH - scaledH) / 2;
    return {
      top: pctY(relic.designY + offsetY),
      left: pctX(relic.designX + offsetX),
      width: pctW(scaledW),
      height: pctH(scaledH),
      ...(relic.rotation != null
        ? {
            transform: `rotate(${relic.rotation}deg)`,
            transformOrigin: "center center",
          }
        : {}),
      ...(relic.borderRadius ? { borderRadius: relic.borderRadius } : {}),
    };
  };

  if (bubblesOnly) {
    return (
      <div
        data-hero-scene
        className="pointer-events-none relative h-full w-full overflow-hidden"
      >
        {relics.map((relic) => {
          const resolved = resolveRelic(relic, viewportTier);
          if (!resolved?.caption) return null;
          const isHovered = hoveredId === relic.id;

          return (
            <div
              key={relic.id}
              className="pointer-events-none absolute"
              style={{
                ...relicStyle(resolved),
                zIndex: isHovered ? 20 : (relic.zIndex ?? 1),
              }}
            >
              <RelicSpeechBubble relic={resolved} layout={layout} lensOnly />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      data-hero-scene
      className="relative h-full w-full select-none overflow-hidden bg-white"
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/Texturelabs_Paper_312XL 1.png"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover mix-blend-multiply select-none"
          draggable={false}
          priority={interactive}
        />
      </div>

      {relics.map((relic) => {
        const resolved = resolveRelic(relic, viewportTier);
        if (!resolved) return null;

        const isHovered = hoveredId === relic.id;

        return (
          <div
            key={relic.id}
            className={`absolute overflow-hidden ${interactive && !isMobile ? "cursor-none" : "pointer-events-none"} transition-all duration-300`}
            style={{
              ...relicStyle(resolved),
              zIndex: isHovered ? 20 : (relic.zIndex ?? 1),
            }}
            onMouseEnter={
              interactive && !isMobile ? () => onHover(relic.id) : undefined
            }
            onMouseLeave={
              interactive && !isMobile ? () => onHover(null) : undefined
            }
          >
            {renderRelicImage(
              resolved,
              interactive,
              halftoneRelics,
              enableHalftoneLayer,
            )}
          </div>
        );
      })}

      {!bubblesOnly && (
        <HeroTextBlock
          layout={layout}
          fitScale={textFitScale}
          onFitScaleChange={onTextFitScaleChange}
          measureFit={measureTextFit}
        />
      )}
    </div>
  );
}

export default function Hero() {
  const viewportTier = useHeroViewport();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lensExpanded, setLensExpanded] = useState(false);
  const [magnifierActive, setMagnifierActive] = useState(false);
  const [textFitScale, setTextFitScale] = useState(1);

  const handleCursorMove = useCallback(
    (
      localX: number,
      localY: number,
      scene: { width: number; height: number },
    ) => {
      const overRelic = hitTestRelics(
        localX,
        localY,
        scene.width,
        scene.height,
        viewportTier,
      );
      if (overRelic !== null) {
        setLensExpanded(true);
        setHoveredId(overRelic);
        return;
      }

      const nearRelic = hitTestRelics(
        localX,
        localY,
        scene.width,
        scene.height,
        viewportTier,
        FOCUS_SHRINK_PADDING,
      );

      setHoveredId(null);
      if (nearRelic === null) {
        setLensExpanded(false);
      }
    },
    [viewportTier],
  );

  const handleRelicHover = useCallback((id: number | null) => {
    setHoveredId(id);
    if (id !== null) {
      setLensExpanded(true);
    }
  }, []);

  const handleMagnifierActiveChange = useCallback((active: boolean) => {
    setMagnifierActive(active);
    if (!active) {
      setLensExpanded(false);
      setHoveredId(null);
    }
  }, []);

  const shouldCaptureTouch = useCallback(
    (
      localX: number,
      localY: number,
      scene: { width: number; height: number },
    ) => {
      if (viewportTier !== "mobile") return true;
      return (
        hitTestRelics(
          localX,
          localY,
          scene.width,
          scene.height,
          viewportTier,
        ) !== null
      );
    },
    [viewportTier],
  );

  const sceneProps = {
    hoveredId,
    onHover: handleRelicHover,
    viewportTier,
    magnifierActive,
    textFitScale,
    onTextFitScaleChange: setTextFitScale,
  };

  return (
    <MagnifierCursor
      focused={lensExpanded}
      onCursorMove={handleCursorMove}
      onMagnifierActiveChange={handleMagnifierActiveChange}
      shouldCaptureTouch={shouldCaptureTouch}
      clone={
        <HeroScene
          {...sceneProps}
          interactive={false}
          forceFullColor
          lensExpanded={lensExpanded}
          measureTextFit={false}
        />
      }
      overlay={
        <HeroScene
          {...sceneProps}
          interactive={false}
          bubblesOnly
          measureTextFit={false}
        />
      }
    >
      <HeroScene
        {...sceneProps}
        interactive
        lensExpanded={lensExpanded}
        measureTextFit
      />
    </MagnifierCursor>
  );
}
