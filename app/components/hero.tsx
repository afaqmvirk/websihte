"use client";

import Image from "next/image";
import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
  type CSSProperties,
} from "react";
import MagnifierCursor from "./magnifier-cursor";
import RelicHalftoneImage from "./relic-halftone-image";

/** Hero artboard dimensions from Figma "Final Design" → hero frame (24:88). */
const FIGMA_WIDTH = 1512;
const FIGMA_HEIGHT = 982;
/** Mobile hero frame (113:64 "hero - mobile"). */
const MOBILE_FIGMA_WIDTH = 644;
const MOBILE_FIGMA_HEIGHT = 1214;
const MOBILE_BREAKPOINT = 768;
/** Up to this width: desktop layout but hide crowded right-column relics (e.g. iPad Air). */
const TABLET_MAX_WIDTH = 1024;
/** Relic ids visible on mobile (Figma hero - mobile). */
const MOBILE_RELIC_IDS = new Set([1, 2, 3, 4, 7, 8]);
/** Rightmost relics hidden on tablet widths (desktop artboard). */
const TABLET_HIDDEN_RELIC_IDS = new Set([10, 11, 12, 13]);

type ViewportTier = "mobile" | "tablet" | "desktop";

/** Slightly shrink relic photos relative to Figma layout. */
const RELIC_SCALE = 0.9;
/** Extra overlap in px at the bubble anchor (scaled to viewport height). */
const BUBBLE_OVERLAP = 6;
/** Relics above this Figma Y get bubbles anchored to the image bottom. */
const TOP_RELIC_Y = 100;
const BUBBLE_ANCHOR_Y = 0.7;
/** Extra distance (Figma px, scaled to scene) before the lens shrinks after leaving a relic. */
const FOCUS_SHRINK_PADDING = 40;

const FONT_ARIAL_NARROW = "var(--font-arial-narrow)";

type Relic = {
  id: number;
  src: string;
  width: number;
  height: number;
  figmaX: number;
  figmaY: number;
  figmaW: number;
  figmaH: number;
  objectFit?: "cover" | "contain" | "bottom";
  zIndex?: number;
  caption?: string;
};

type LayoutConfig = {
  width: number;
  height: number;
  textLeft: number;
  textWidth: number;
  textBottom: number;
  ctaLabel: "hover" | "drag";
  headline: { figma: number; min: number; max: number };
  body: { figma: number; min: number; max: number };
  blockGap: number;
};

const DESKTOP_LAYOUT: LayoutConfig = {
  width: FIGMA_WIDTH,
  height: FIGMA_HEIGHT,
  textLeft: 62,
  textWidth: 914,
  textBottom: 35,
  ctaLabel: "hover",
  headline: { figma: 72, min: 28, max: 72 },
  body: { figma: 24, min: 14, max: 24 },
  blockGap: 4,
};

const TABLET_LAYOUT: LayoutConfig = {
  width: FIGMA_WIDTH,
  height: FIGMA_HEIGHT,
  textLeft: 62,
  /** Nearly full artboard width so copy spans the scene on iPad-sized viewports. */
  textWidth: FIGMA_WIDTH - 62 * 2,
  textBottom: 35,
  ctaLabel: "hover",
  headline: { figma: 96, min: 40, max: 64 },
  body: { figma: 30, min: 18, max: 28 },
  blockGap: 4,
};

const MOBILE_LAYOUT: LayoutConfig = {
  width: MOBILE_FIGMA_WIDTH,
  height: MOBILE_FIGMA_HEIGHT,
  textLeft: 55,
  textWidth: 533,
  textBottom: 60,
  ctaLabel: "drag",
  headline: { figma: 72, min: 22, max: 46 },
  body: { figma: 24, min: 13, max: 17 },
  blockGap: 4,
};

/** Shared line-height tokens (tighter than Figma defaults). */
const HEADLINE_LINE_HEIGHT = 1.02;
const BODY_LINE_HEIGHT = 1.1;

type RelicOverride = {
  figmaX?: number;
  figmaY?: number;
  figmaW?: number;
  figmaH?: number;
  objectFit?: Relic["objectFit"];
  rotation?: number;
  borderRadius?: string;
};

const MOBILE_RELIC_OVERRIDES: Partial<Record<number, RelicOverride>> = {
  1: { figmaX: 35, figmaY: 52 },
  2: { figmaX: 353.16, figmaY: 209, figmaW: 261.09, figmaH: 206.17 },
  3: {
    figmaX: 5,
    figmaY: 237,
    figmaW: 286.2,
    figmaH: 310.87,
    rotation: -13.73,
  },
  4: { figmaX: 351, figmaY: 392 },
  7: { figmaX: 23, figmaY: 548, figmaW: 330, figmaH: 240 },
  8: { figmaX: 421, figmaY: 633, figmaW: 223.36, figmaH: 274.7 },
};

function getLayout(tier: ViewportTier): LayoutConfig {
  if (tier === "mobile") return MOBILE_LAYOUT;
  if (tier === "tablet") return TABLET_LAYOUT;
  return DESKTOP_LAYOUT;
}

function createPctHelpers(layout: LayoutConfig) {
  const w = layout.width;
  const h = layout.height;
  return {
    pctX: (px: number) => `${(px / w) * 100}%`,
    pctY: (px: number) => `${(px / h) * 100}%`,
    pctW: (px: number) => `${(px / w) * 100}%`,
    pctH: (px: number) => `${(px / h) * 100}%`,
    figmaFont: (px: number, minPx: number, maxPx: number = px) =>
      `clamp(${minPx}px, ${(px / w) * 100}vw, ${maxPx}px)`,
    figmaSpaceY: (px: number) =>
      `calc(${(px / h) * 100} * var(--app-height) / 100)`,
    figmaPx: (px: number) => `${(px / w) * 100}vw`,
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

function relicImageSizes(relic: Relic, layout: LayoutConfig): string {
  const mobileVw = Math.ceil(
    ((relic.figmaW * RELIC_SCALE) / MOBILE_FIGMA_WIDTH) * 100,
  );
  const desktopVw = Math.ceil(
    ((relic.figmaW * RELIC_SCALE) / FIGMA_WIDTH) * 100,
  );
  return `(max-width: ${MOBILE_BREAKPOINT}px) ${mobileVw}vw, ${desktopVw}vw`;
}

function useHeroViewport(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>("desktop");

  useEffect(() => {
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
    figmaX: 45,
    figmaY: 81,
    figmaW: 374.82,
    figmaH: 165.49,
    objectFit: "bottom",
    zIndex: 3,
    caption:
      "a group of 4 ambitious individuals discussing the future of sih",
  },
  {
    id: 2,
    src: "/2.png",
    width: 278,
    height: 207,
    figmaX: 65.41,
    figmaY: 238.01,
    figmaW: 261.09,
    figmaH: 206.17,
    objectFit: "bottom",
    zIndex: 2,
    caption: "an electronic breadboard with a mess of colorful jumper wires",
  },
  {
    id: 3,
    src: "/3.png",
    width: 292,
    height: 313,
    figmaX: 104,
    figmaY: 436,
    figmaW: 286.2,
    figmaH: 310.87,
    objectFit: "bottom",
    zIndex: 4,
    caption: "a pink-tinted polaroid from rio de janeiro",
  },
  {
    id: 4,
    src: "/4.png",
    width: 238,
    height: 249,
    figmaX: 449,
    figmaY: 468,
    figmaW: 237.14,
    figmaH: 249,
    objectFit: "bottom",
    zIndex: 5,
    caption: "a phone with an sih sticker on the back",
  },
  {
    id: 5,
    src: "/5.png",
    width: 368,
    height: 246,
    figmaX: 382,
    figmaY: 223,
    figmaW: 367.93,
    figmaH: 245.32,
    objectFit: "cover",
    zIndex: 3,
    caption: "three people posing in front of an i heart smu sign",
  },
  {
    id: 6,
    src: "/6.png",
    width: 296,
    height: 257,
    figmaX: 428,
    figmaY: -21,
    figmaW: 295.87,
    figmaH: 277.38,
    objectFit: "bottom",
    zIndex: 2,
    caption: "a party favor box spilling colorful goodies",
  },
  {
    id: 7,
    src: "/7.png",
    width: 330,
    height: 240,
    figmaX: 718,
    figmaY: 21,
    figmaW: 330,
    figmaH: 240,
    objectFit: "bottom",
    zIndex: 6,
    caption: "two friends in matching pink beanies",
  },
  {
    id: 8,
    src: "/8.png",
    width: 224,
    height: 275,
    figmaX: 771,
    figmaY: 268,
    figmaW: 223.36,
    figmaH: 274.7,
    objectFit: "bottom",
    zIndex: 5,
    caption: "someone wearing a giant yellow sponge on their head",
  },
  {
    id: 9,
    src: "/9.png",
    width: 311,
    height: 185,
    figmaX: 774,
    figmaY: 549,
    figmaW: 294.6,
    figmaH: 185,
    objectFit: "bottom",
    zIndex: 4,
    caption: "a stupid ideas hackathon flyer surrounded by star toys",
  },
  {
    id: 10,
    src: "/10.png",
    width: 304,
    height: 265,
    figmaX: 1164,
    figmaY: 685,
    figmaW: 303.54,
    figmaH: 264.63,
    objectFit: "bottom",
    zIndex: 5,
    caption: "a builder deep in laptop flow on the floor",
  },
  {
    id: 11,
    src: "/11.png",
    width: 285,
    height: 214,
    figmaX: 1192,
    figmaY: 517.06,
    figmaW: 284.68,
    figmaH: 173.23,
    objectFit: "bottom",
    zIndex: 4,
    caption: "a zoom call where everyone is a wizard",
  },
  {
    id: 12,
    src: "/12.png",
    width: 255,
    height: 288,
    figmaX: 1025,
    figmaY: 212,
    figmaW: 253.99,
    figmaH: 284.65,
    zIndex: 5,
    caption: "stupid ideas are back — justin bieber edition",
  },
  {
    id: 13,
    src: "/13.png",
    width: 271,
    height: 314,
    figmaX: 1198,
    figmaY: 20,
    figmaW: 241.39,
    figmaH: 313.4,
    objectFit: "bottom",
    zIndex: 3,
    caption: "two people building a tall spindly contraption",
  },
];

function getRelicLayoutRect(relic: Relic) {
  const scaledW = relic.figmaW * RELIC_SCALE;
  const offsetX = (relic.figmaW - scaledW) / 2;
  return {
    left: relic.figmaX + offsetX,
    width: scaledW,
  };
}

/** Stretch visible tablet relics to fill the desktop artboard width. */
function computeTabletSpread() {
  let minLeft = Infinity;
  let maxRight = 0;

  for (const relic of relics) {
    if (TABLET_HIDDEN_RELIC_IDS.has(relic.id)) continue;
    const { left, width } = getRelicLayoutRect(relic);
    minLeft = Math.min(minLeft, left);
    maxRight = Math.max(maxRight, left + width);
  }

  const targetLeft = minLeft;
  const targetRight = FIGMA_WIDTH - DESKTOP_LAYOUT.textLeft;

  return {
    minLeft,
    scale: (targetRight - targetLeft) / (maxRight - minLeft),
    targetLeft,
  };
}

const TABLET_SPREAD = computeTabletSpread();

function spreadRelicForTablet(relic: Relic): Relic {
  const { minLeft, scale, targetLeft } = TABLET_SPREAD;
  const { left } = getRelicLayoutRect(relic);
  const newLeft = targetLeft + (left - minLeft) * scale;
  const newFigmaW = relic.figmaW * scale;
  const newScaledW = newFigmaW * RELIC_SCALE;
  const newOffsetX = (newFigmaW - newScaledW) / 2;

  return {
    ...relic,
    figmaX: newLeft - newOffsetX,
    figmaW: newFigmaW,
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
  paddingFigmaPx = 0,
) {
  const scaledW = relic.figmaW * RELIC_SCALE;
  const scaledH = relic.figmaH * RELIC_SCALE;
  const offsetX = (relic.figmaW - scaledW) / 2;
  const offsetY = (relic.figmaH - scaledH) / 2;
  const padX = (paddingFigmaPx / layout.width) * sceneWidth;
  const padY = (paddingFigmaPx / layout.height) * sceneHeight;

  return {
    left: ((relic.figmaX + offsetX) / layout.width) * sceneWidth - padX,
    top: ((relic.figmaY + offsetY) / layout.height) * sceneHeight - padY,
    right:
      ((relic.figmaX + offsetX + scaledW) / layout.width) * sceneWidth + padX,
    bottom:
      ((relic.figmaY + offsetY + scaledH) / layout.height) * sceneHeight +
      padY,
  };
}

function hitTestRelics(
  localX: number,
  localY: number,
  sceneWidth: number,
  sceneHeight: number,
  tier: ViewportTier,
  paddingFigmaPx = 0,
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
      paddingFigmaPx,
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
  const nearLeft = relic.figmaX < layout.textLeft;
  const nearRight =
    relic.figmaX + relic.figmaW > layout.width - layout.textLeft;
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
  const { figmaFont, figmaSpaceY, figmaPx } = createPctHelpers(layout);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isTopRelic = relic.figmaY < TOP_RELIC_Y;
  const [align, setAlign] = useState(() => getBubbleAlign(relic, layout));
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
      if (align === "center") setAlign("right");
    }
    if (rect.top < sceneRect.top + pad) {
      dy += sceneRect.top + pad - rect.top;
    }
    if (rect.bottom > sceneRect.bottom - pad) {
      dy -= rect.bottom - (sceneRect.bottom - pad);
    }

    setNudge({ x: dx, y: dy });
  }, [relic.id, relic.caption, align, isTopRelic, lensOnly]);

  if (!relic.caption) return null;

  const overlap = figmaSpaceY(BUBBLE_OVERLAP);
  const translateX =
    align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
  const translateY = isTopRelic
    ? `calc(-100% + ${overlap})`
    : `calc(-50% + ${overlap})`;

  const style: CSSProperties = {
    position: "absolute",
    width: "max-content",
    maxWidth: `min(${figmaPx(227.504)}, calc(100vw - ${figmaPx(layout.textLeft * 2)}))`,
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
          padding: `${figmaSpaceY(10)} ${figmaPx(11)}`,
          fontFamily: FONT_ARIAL_NARROW,
          fontSize: figmaFont(16, 11, 16),
          letterSpacing: figmaPx(-0.32),
          lineHeight: 1.15,
        }}
      >
        <span className="mr-0.5">{CIRCLED_NUMBERS[relic.id - 1]}</span>
        {relic.caption}
      </div>
    </div>
  );
}

function HeroTextBlock({ layout }: { layout: LayoutConfig }) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const { pctX, pctY, pctW, figmaFont, figmaSpaceY, figmaPx } =
    createPctHelpers(layout);

  useLayoutEffect(() => {
    const block = blockRef.current;
    const scene = block?.closest("[data-hero-scene]") as HTMLElement | null;
    if (!block || !scene) return;

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
        setFitScale(next);
      } else {
        setFitScale(1);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [layout.width, layout.height]);

  return (
    <div
      ref={blockRef}
      data-hero-text-block
      className="hero-text-block pointer-events-none absolute z-10 box-border flex flex-col items-start"
      style={{
        left: pctX(layout.textLeft),
        bottom: `calc(${pctY(layout.textBottom)} + env(safe-area-inset-bottom, 0px))`,
        width: pctW(layout.textWidth),
        maxWidth: `calc(100% - ${pctX(layout.textLeft * 2)})`,
        gap: figmaSpaceY(layout.blockGap),
        transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
        transformOrigin: "bottom left",
      }}
    >
      <h1
        className="m-0 max-w-full text-balance text-black"
        style={{
          fontFamily: FONT_ARIAL_NARROW,
          fontSize: figmaFont(
            layout.headline.figma,
            layout.headline.min,
            layout.headline.max,
          ),
          letterSpacing: figmaPx(-2.88),
          lineHeight: HEADLINE_LINE_HEIGHT,
        }}
      >
        the stupid ideas hackathon community.
      </h1>
      <div
        className="max-w-full font-arial-narrow text-black"
        style={{
          fontSize: figmaFont(
            layout.body.figma,
            layout.body.min,
            layout.body.max,
          ),
          letterSpacing: figmaPx(-0.48),
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
            padding: `${figmaSpaceY(4)} ${figmaPx(16)}`,
            fontSize: figmaFont(
              layout.body.figma,
              layout.body.min,
              layout.body.max,
            ),
            letterSpacing: figmaPx(-0.48),
            lineHeight: 1,
          }}
        >
          {layout.ctaLabel}
        </span>
        <span
          className="font-arial-narrow text-black"
          style={{
            fontSize: figmaFont(
              layout.body.figma,
              layout.body.min,
              layout.body.max,
            ),
            letterSpacing: figmaPx(-0.48),
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
  layout: LayoutConfig,
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
        sizes={relicImageSizes(relic, layout)}
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
      sizes={relicImageSizes(relic, layout)}
      className={
        relic.objectFit === "cover"
          ? "h-full w-full select-none object-cover"
          : relic.objectFit === "bottom"
            ? "h-full w-full select-none object-contain object-bottom"
            : "h-full w-full select-none object-contain"
      }
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
    const scaledW = relic.figmaW * RELIC_SCALE;
    const scaledH = relic.figmaH * RELIC_SCALE;
    const offsetX = (relic.figmaW - scaledW) / 2;
    const offsetY = (relic.figmaH - scaledH) / 2;
    return {
      top: pctY(relic.figmaY + offsetY),
      left: pctX(relic.figmaX + offsetX),
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
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: pctW(1572),
          height: pctH(1204),
          zIndex: 0,
        }}
      >
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
              layout,
              interactive,
              halftoneRelics,
              enableHalftoneLayer,
            )}
          </div>
        );
      })}

      {!bubblesOnly && <HeroTextBlock layout={layout} />}
    </div>
  );
}

export default function Hero() {
  const viewportTier = useHeroViewport();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lensExpanded, setLensExpanded] = useState(false);
  const [magnifierActive, setMagnifierActive] = useState(false);

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

  const sceneProps = {
    hoveredId,
    onHover: handleRelicHover,
    viewportTier,
    magnifierActive,
  };

  return (
    <MagnifierCursor
      focused={lensExpanded}
      onCursorMove={handleCursorMove}
      onMagnifierActiveChange={handleMagnifierActiveChange}
      clone={
        <HeroScene
          {...sceneProps}
          interactive={false}
          forceFullColor
          lensExpanded={lensExpanded}
        />
      }
      overlay={
        <HeroScene {...sceneProps} interactive={false} bubblesOnly />
      }
    >
      <HeroScene {...sceneProps} interactive lensExpanded={lensExpanded} />
    </MagnifierCursor>
  );
}
