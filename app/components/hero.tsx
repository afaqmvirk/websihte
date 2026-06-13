"use client";

import Image from "next/image";
import { useState, useRef, useLayoutEffect, useCallback, type CSSProperties } from "react";
import MagnifierCursor from "./magnifier-cursor";

/** Hero artboard dimensions from Figma "Final Design" → hero frame (24:88). */
const FIGMA_WIDTH = 1512;
const FIGMA_HEIGHT = 982;

const pctX = (px: number) => `${(px / FIGMA_WIDTH) * 100}%`;
const pctY = (px: number) => `${(px / FIGMA_HEIGHT) * 100}%`;
const pctW = (px: number) => `${(px / FIGMA_WIDTH) * 100}%`;
const pctH = (px: number) => `${(px / FIGMA_HEIGHT) * 100}%`;
/** Scale Figma px to viewport width, clamped so text stays readable and in bounds. */
const figmaFont = (px: number, minPx: number, maxPx: number = px) =>
  `clamp(${minPx}px, ${(px / FIGMA_WIDTH) * 100}vw, ${maxPx}px)`;
const figmaSpaceY = (px: number) => `${(px / FIGMA_HEIGHT) * 100}vh`;
const figmaPx = (px: number) => `${(px / FIGMA_WIDTH) * 100}vw`;

const HERO_TEXT_LEFT = 62;
const HERO_TEXT_WIDTH = 914;
const HERO_TEXT_BOTTOM = 35;
/** Slightly shrink relic photos relative to Figma layout. */
const RELIC_SCALE = 0.9;
/** Extra overlap in px at the bubble anchor (scaled to viewport height). */
const BUBBLE_OVERLAP = 6;
/** Relics above this Figma Y get bubbles anchored to the image bottom. */
const TOP_RELIC_Y = 100;
const BUBBLE_ANCHOR_Y = 0.7;
/** Extra distance (Figma px, scaled to scene) before the lens shrinks after leaving a relic. */
const FOCUS_SHRINK_PADDING = 40;

const FONT_ARIAL_NARROW = '"Arial Narrow", Arial, sans-serif';

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

const CIRCLED_NUMBERS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬",
];

function getRelicSceneRect(
  relic: Relic,
  sceneWidth: number,
  sceneHeight: number,
  paddingFigmaPx = 0,
) {
  const scaledW = relic.figmaW * RELIC_SCALE;
  const scaledH = relic.figmaH * RELIC_SCALE;
  const offsetX = (relic.figmaW - scaledW) / 2;
  const offsetY = (relic.figmaH - scaledH) / 2;
  const padX = (paddingFigmaPx / FIGMA_WIDTH) * sceneWidth;
  const padY = (paddingFigmaPx / FIGMA_HEIGHT) * sceneHeight;

  return {
    left: ((relic.figmaX + offsetX) / FIGMA_WIDTH) * sceneWidth - padX,
    top: ((relic.figmaY + offsetY) / FIGMA_HEIGHT) * sceneHeight - padY,
    right:
      ((relic.figmaX + offsetX + scaledW) / FIGMA_WIDTH) * sceneWidth + padX,
    bottom:
      ((relic.figmaY + offsetY + scaledH) / FIGMA_HEIGHT) * sceneHeight + padY,
  };
}

function hitTestRelics(
  localX: number,
  localY: number,
  sceneWidth: number,
  sceneHeight: number,
  paddingFigmaPx = 0,
) {
  for (const relic of relics) {
    const rect = getRelicSceneRect(
      relic,
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

function getBubbleAlign(relic: Relic): "left" | "center" | "right" {
  const nearLeft = relic.figmaX < HERO_TEXT_LEFT;
  const nearRight =
    relic.figmaX + relic.figmaW > FIGMA_WIDTH - HERO_TEXT_LEFT;
  if (nearRight && !nearLeft) return "right";
  if (nearLeft && !nearRight) return "left";
  return "center";
}

function RelicSpeechBubble({
  relic,
  lensOnly = false,
}: {
  relic: Relic;
  lensOnly?: boolean;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isTopRelic = relic.figmaY < TOP_RELIC_Y;
  const [align, setAlign] = useState(() => getBubbleAlign(relic));
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
    maxWidth: `min(${figmaPx(227.504)}, calc(100vw - ${figmaPx(HERO_TEXT_LEFT * 2)}))`,
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

function HeroTextBlock() {
  return (
    <div
      className="pointer-events-none absolute z-10 box-border flex flex-col items-start"
      style={{
        left: pctX(HERO_TEXT_LEFT),
        bottom: pctY(HERO_TEXT_BOTTOM),
        width: pctW(HERO_TEXT_WIDTH),
        maxWidth: `calc(100% - ${pctX(HERO_TEXT_LEFT * 2)})`,
        gap: figmaSpaceY(8),
      }}
    >
      <h1
        className="m-0 max-w-full text-balance text-black"
        style={{
          fontFamily: FONT_ARIAL_NARROW,
          fontSize: figmaFont(72, 28, 72),
          letterSpacing: figmaPx(-2.88),
          lineHeight: 1.15,
        }}
      >
        the stupid ideas hackathon community.
      </h1>
      <div
        className="max-w-full font-sans text-black"
        style={{
          fontSize: figmaFont(24, 14, 24),
          letterSpacing: figmaPx(-0.48),
          lineHeight: 1.3,
        }}
      >
        <p className="m-0">
          a decentralized community reclaiming the joy of building,{" "}
        </p>
        <p className="m-0">one stupid idea at a time.</p>
      </div>
      <div className="flex max-w-full flex-wrap items-center">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-black bg-white font-sans text-black"
          style={{
            padding: `${figmaSpaceY(4)} ${figmaPx(16)}`,
            fontSize: figmaFont(24, 14, 24),
            letterSpacing: figmaPx(-0.48),
            lineHeight: 1,
          }}
        >
          hover
        </span>
        <span
          className="font-sans text-black"
          style={{
            fontSize: figmaFont(24, 14, 24),
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

type HeroSceneProps = {
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  interactive?: boolean;
  /** Lens clone always renders full color. */
  forceFullColor?: boolean;
  lensExpanded?: boolean;
  /** Speech bubbles only — magnifier overlay above glass. */
  bubblesOnly?: boolean;
};

function HeroScene({
  hoveredId,
  onHover,
  interactive = true,
  forceFullColor = false,
  lensExpanded = false,
  bubblesOnly = false,
}: HeroSceneProps) {
  const grayscaleRelics = !forceFullColor && interactive && lensExpanded;

  if (bubblesOnly) {
    return (
      <div
        data-hero-scene
        className="pointer-events-none relative h-full min-h-screen w-full overflow-hidden"
      >
        {relics.map((relic) => {
          if (!relic.caption) return null;
          const isHovered = hoveredId === relic.id;
          const scaledW = relic.figmaW * RELIC_SCALE;
          const scaledH = relic.figmaH * RELIC_SCALE;
          const offsetX = (relic.figmaW - scaledW) / 2;
          const offsetY = (relic.figmaH - scaledH) / 2;

          return (
            <div
              key={relic.id}
              className="pointer-events-none absolute"
              style={{
                top: pctY(relic.figmaY + offsetY),
                left: pctX(relic.figmaX + offsetX),
                width: pctW(scaledW),
                height: pctH(scaledH),
                zIndex: isHovered ? 20 : (relic.zIndex ?? 1),
              }}
            >
              <RelicSpeechBubble relic={relic} lensOnly />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      data-hero-scene
      className="relative h-full min-h-screen w-full select-none overflow-hidden bg-white"
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
        const isHovered = hoveredId === relic.id;
        const scaledW = relic.figmaW * RELIC_SCALE;
        const scaledH = relic.figmaH * RELIC_SCALE;
        const offsetX = (relic.figmaW - scaledW) / 2;
        const offsetY = (relic.figmaH - scaledH) / 2;

        return (
          <div
            key={relic.id}
            className={`absolute ${interactive ? "cursor-none" : "pointer-events-none"} transition-all duration-300`}
            style={{
              top: pctY(relic.figmaY + offsetY),
              left: pctX(relic.figmaX + offsetX),
              width: pctW(scaledW),
              height: pctH(scaledH),
              zIndex: isHovered ? 20 : (relic.zIndex ?? 1),
              filter: grayscaleRelics ? "grayscale(100%)" : "none",
            }}
            onMouseEnter={
              interactive ? () => onHover(relic.id) : undefined
            }
            onMouseLeave={interactive ? () => onHover(null) : undefined}
          >
            <Image
              src={relic.src}
              alt={interactive ? `relic ${relic.id}` : ""}
              width={relic.width}
              height={relic.height}
              draggable={false}
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
          </div>
        );
      })}

      {!bubblesOnly && <HeroTextBlock />}
    </div>
  );
}

export default function Hero() {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lensExpanded, setLensExpanded] = useState(false);

  const handleCursorMove = useCallback(
    (
      localX: number,
      localY: number,
      scene: { width: number; height: number },
    ) => {
      const overRelic = hitTestRelics(localX, localY, scene.width, scene.height);
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
        FOCUS_SHRINK_PADDING,
      );

      setHoveredId(null);
      if (nearRelic === null) {
        setLensExpanded(false);
      }
    },
    [],
  );

  const handleRelicHover = useCallback((id: number | null) => {
    setHoveredId(id);
    if (id !== null) {
      setLensExpanded(true);
    }
  }, []);

  const handleCursorLeave = useCallback(() => {
    setLensExpanded(false);
    setHoveredId(null);
  }, []);

  return (
    <MagnifierCursor
      focused={lensExpanded}
      onCursorMove={handleCursorMove}
      onCursorLeave={handleCursorLeave}
      clone={
        <HeroScene
          hoveredId={hoveredId}
          onHover={handleRelicHover}
          interactive={false}
          forceFullColor
          lensExpanded={lensExpanded}
        />
      }
      overlay={
        <HeroScene
          hoveredId={hoveredId}
          onHover={handleRelicHover}
          interactive={false}
          bubblesOnly
        />
      }
    >
      <HeroScene
        hoveredId={hoveredId}
        onHover={handleRelicHover}
        interactive
        lensExpanded={lensExpanded}
      />
    </MagnifierCursor>
  );
}
