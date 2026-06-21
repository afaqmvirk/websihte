"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEnvelope } from "./envelope-context";
import {
  getArcConfig,
  stampPhotoTransform,
  type StampArcCorner,
  type StampArcEllipseConfig,
} from "./stamp-arc-config";
import { readViewportHeightPx } from "./viewport-height-sync";
import type { StampPhoto } from "./section-layout";
import StampSheen from "./stamp-sheen";

const STAMP_SIZE = 183;
const MOBILE_STAMP_SIZE = 72;
const MOBILE_LINE_GAP = 36;
const MOBILE_BREAKPOINT = 1024;
const PHOTO_INSET_RATIO = 12.56 / STAMP_SIZE;
const PHOTO_W_RATIO = 159.1 / STAMP_SIZE;
const PHOTO_H_RATIO = 161.2 / STAMP_SIZE;

const HOVER_SCALE = 1.3;
const TILT_DEG = 52;
const PERSPECTIVE_PX = 660;

export type ArcCorner = StampArcCorner;

type FramedPhotoArcProps = {
  photos: StampPhoto[];
  corner: StampArcCorner;
  className?: string;
};

export type ArcPoint = {
  x: number;
  y: number;
  rotate: number;
  t: number;
};

type TrackLayout = {
  a: number;
  b: number;
  width: number;
  height: number;
  stampSize: number;
  /** Mobile line — shift track left so stamps enter from offscreen. */
  leadOffset?: number;
};

function layoutForCorner(
  viewportH: number,
  config: StampArcEllipseConfig,
): TrackLayout {
  const b = viewportH * config.bViewportRatio;
  const a = b * config.aRatio;

  return {
    a,
    b,
    width: a + STAMP_SIZE,
    height: b + STAMP_SIZE,
    stampSize: STAMP_SIZE,
  };
}

function layoutForLine(photoCount: number): TrackLayout {
  const stampSize = MOBILE_STAMP_SIZE;
  const span =
    photoCount * stampSize + Math.max(0, photoCount - 1) * MOBILE_LINE_GAP;
  const leadOffset =
    typeof window !== "undefined" ? window.innerWidth : 400;

  return {
    a: 0,
    b: 0,
    width: span + leadOffset * 2,
    height: stampSize,
    stampSize,
    leadOffset,
  };
}

export function getArcPointAt(
  t: number,
  corner: StampArcCorner,
  layout: TrackLayout,
): ArcPoint {
  const wrapped = ((t % 1) + 1) % 1;
  const { a, b } = layout;
  const theta = wrapped * Math.PI * 2;

  let x: number;
  let y: number;
  let dx: number;
  let dy: number;

  if (corner === "bottom-left") {
    x = a + a * Math.cos(theta);
    y = b * Math.sin(theta);
    dx = -a * Math.sin(theta);
    dy = b * Math.cos(theta);
  } else {
    x = a * Math.cos(theta);
    y = b + b * Math.sin(theta);
    dx = -a * Math.sin(theta);
    dy = b * Math.cos(theta);
  }

  const rotate = (Math.atan2(dy, dx) * 180) / Math.PI;

  return { x, y, rotate, t: wrapped };
}

function getLinePointAt(t: number, layout: TrackLayout): ArcPoint {
  const wrapped = ((t % 1) + 1) % 1;
  const { stampSize, width } = layout;
  const travel = Math.max(0, width - stampSize);
  const x = stampSize / 2 + wrapped * travel;
  const y = stampSize / 2;

  return { x, y, rotate: 0, t: wrapped };
}

function applyStampPosition(
  el: HTMLDivElement,
  point: ArcPoint,
  isPaused: boolean,
) {
  // Single transform for position + rotation — avoids subpixel jitter from
  // updating left/top separately from transform each frame.
  const tx = point.x;
  const ty = point.y;
  el.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) rotate(${point.rotate}deg)`;
  el.style.willChange = isPaused ? "auto" : "transform";
}

function FramedStamp({
  photo,
  corner,
  photoRotateDeg,
  stampSize,
  isHovered,
  isHidden,
  onHoverStart,
  onHoverEnd,
  onClick,
}: {
  photo: StampPhoto;
  corner: StampArcCorner;
  photoRotateDeg: number;
  stampSize: number;
  isHovered: boolean;
  isHidden: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tiltDir = corner === "bottom-left" ? 1 : -1;
  const photoInset = stampSize * PHOTO_INSET_RATIO;
  const photoW = stampSize * PHOTO_W_RATIO;
  const photoH = stampSize * PHOTO_H_RATIO;

  const handleMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px, y: py });
  }, []);

  const handleLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    onHoverEnd();
  }, [onHoverEnd]);

  const innerScale = isHovered ? HOVER_SCALE : 1;

  return (
    <div
      className="h-full w-full cursor-pointer touch-manipulation pointer-events-auto"
      style={{
        opacity: isHidden ? 0 : 1,
        visibility: isHidden ? "hidden" : "visible",
        pointerEvents: isHidden ? "none" : "auto",
        transition: "opacity 180ms ease-out, visibility 180ms ease-out",
        perspective: `${PERSPECTIVE_PX}px`,
      }}
      onPointerEnter={onHoverStart}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="send photo to envelope"
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          transform: `rotateX(${-tilt.y * TILT_DEG}deg) rotateY(${tilt.x * TILT_DEG * tiltDir}deg) scale(${innerScale})`,
          transformStyle: "preserve-3d",
          transition: "transform 200ms ease-out",
          isolation: "isolate",
        }}
      >
        <Image
          src="/sections/stamp-frame.png"
          alt=""
          width={STAMP_SIZE}
          height={STAMP_SIZE}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
          draggable={false}
        />
        <div
          className="absolute z-[1] overflow-hidden"
          style={{
            left: photoInset,
            top: photoInset,
            width: photoW,
            height: photoH,
          }}
        >
          <Image
            src={photo.src}
            alt=""
            width={Math.round(photoW)}
            height={Math.round(photoH)}
            className="block h-full w-full object-cover"
            sizes={`${Math.round(stampSize)}px`}
            draggable={false}
            style={{
              objectPosition: photo.objectPosition ?? "center",
              transform: stampPhotoTransform(photo, photoRotateDeg),
            }}
          />
        </div>
        <StampSheen tiltX={tilt.x} tiltY={tilt.y} active={isHovered} />
      </div>
    </div>
  );
}

export default function FramedPhotoArc({
  photos,
  corner,
  className,
}: FramedPhotoArcProps) {
  const { requestFly, isStampHidden, flyingStamp } = useEnvelope();
  const arcConfig = getArcConfig(corner);
  const trackRef = useRef<HTMLDivElement>(null);
  const stampRefs = useRef<(HTMLDivElement | null)[]>([]);
  const layoutRef = useRef<TrackLayout>(layoutForCorner(900, arcConfig));
  const isMobileLineRef = useRef(false);
  const phaseRef = useRef(0);
  const phaseBaseRef = useRef(0);
  const phaseEpochRef = useRef(0);
  const pausedRef = useRef(false);
  const cornerRef = useRef(corner);
  const lapDurationRef = useRef(arcConfig.lapDurationS);
  const clipMarginRef = useRef({
    top: arcConfig.clipMarginTop,
    bottom: arcConfig.clipMarginBottom,
  });
  const totalRef = useRef(photos.length);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [flyingKey, setFlyingKey] = useState<string | null>(null);
  const [isMobileLine, setIsMobileLine] = useState(false);
  const [layoutSize, setLayoutSize] = useState({
    width: layoutRef.current.width,
    height: layoutRef.current.height,
    stampSize: layoutRef.current.stampSize,
    leadOffset: layoutRef.current.leadOffset ?? 0,
  });

  cornerRef.current = corner;
  totalRef.current = photos.length;
  lapDurationRef.current = arcConfig.lapDurationS;

  const syncLayout = useCallback(() => {
    const mobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
    isMobileLineRef.current = mobile;
    setIsMobileLine(mobile);

    if (mobile) {
      const next = layoutForLine(totalRef.current);
      layoutRef.current = next;
      clipMarginRef.current = { top: 0, bottom: 0 };
      setLayoutSize({
        width: next.width,
        height: next.height,
        stampSize: next.stampSize,
        leadOffset: next.leadOffset ?? 0,
      });
      return;
    }

    const cfg = getArcConfig(cornerRef.current);
    const next = layoutForCorner(readViewportHeightPx(), cfg);
    layoutRef.current = next;
    lapDurationRef.current = cfg.lapDurationS;
    clipMarginRef.current = {
      top: cfg.clipMarginTop,
      bottom: cfg.clipMarginBottom,
    };
    setLayoutSize({
      width: next.width,
      height: next.height,
      stampSize: next.stampSize,
      leadOffset: 0,
    });
  }, []);

  const paintStamps = useCallback(() => {
    const layout = layoutRef.current;
    const total = totalRef.current;
    const isPaused = pausedRef.current;

    for (let index = 0; index < total; index++) {
      const el = stampRefs.current[index];
      if (!el) continue;

      const slotT = (index / total + phaseRef.current) % 1;
      const point = isMobileLineRef.current
        ? getLinePointAt(slotT, layout)
        : getArcPointAt(slotT, cornerRef.current, layout);
      applyStampPosition(el, point, isPaused);
    }
  }, []);

  useLayoutEffect(() => {
    if (!flyingStamp) {
      setFlyingKey(null);
      setHoveredKey(null);
      phaseEpochRef.current = performance.now();
      pausedRef.current = false;
    }
  }, [flyingStamp]);

  useLayoutEffect(() => {
    syncLayout();
    paintStamps();

    window.addEventListener("resize", syncLayout);
    window.visualViewport?.addEventListener("resize", syncLayout);
    return () => {
      window.removeEventListener("resize", syncLayout);
      window.visualViewport?.removeEventListener("resize", syncLayout);
    };
  }, [syncLayout, paintStamps]);

  useLayoutEffect(() => {
    paintStamps();
  }, [layoutSize, paintStamps]);

  useLayoutEffect(() => {
    let raf = 0;
    phaseEpochRef.current = performance.now();

    const animate = (now: number) => {
      if (!pausedRef.current) {
        phaseRef.current =
          (phaseBaseRef.current +
            (now - phaseEpochRef.current) /
              (lapDurationRef.current * 1000)) %
          1;
        paintStamps();
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [paintStamps]);

  const handleHoverStart = useCallback(
    (key: string) => {
      phaseBaseRef.current = phaseRef.current;
      phaseEpochRef.current = performance.now();
      pausedRef.current = true;
      setHoveredKey(key);
      paintStamps();
    },
    [paintStamps],
  );

  const handleHoverEnd = useCallback(() => {
    if (flyingKey) return;
    phaseEpochRef.current = performance.now();
    pausedRef.current = false;
    setHoveredKey(null);
    paintStamps();
  }, [flyingKey, paintStamps]);

  const handleClick = useCallback(
    (photo: StampPhoto, index: number) => {
      const el = stampRefs.current[index];
      if (!el || flyingKey || isStampHidden(photo.src)) return;

      phaseBaseRef.current = phaseRef.current;
      phaseEpochRef.current = performance.now();
      pausedRef.current = true;
      setFlyingKey(photo.src);
      setHoveredKey(photo.src);
      paintStamps();

      const layout = layoutRef.current;
      const slotT = (index / photos.length + phaseRef.current) % 1;
      const point = isMobileLineRef.current
        ? getLinePointAt(slotT, layout)
        : getArcPointAt(slotT, cornerRef.current, layout);
      const startScale = hoveredKey === photo.src ? HOVER_SCALE : 1;

      requestFly(photo, {
        fromEl: el,
        rotation: point.rotate,
        scale: startScale,
        stampSize: layout.stampSize,
        photoRotateDeg: isMobileLineRef.current ? 0 : arcConfig.photoRotateDeg,
      });
    },
    [flyingKey, hoveredKey, isStampHidden, paintStamps, photos.length, arcConfig.photoRotateDeg, requestFly],
  );

  return (
    <div
      className={
        isMobileLine
          ? `relative w-full max-w-full overflow-x-clip ${className ?? ""}`
          : `pointer-events-auto relative overflow-visible ${className ?? ""}`
      }
      style={
        isMobileLine
          ? { height: layoutSize.height, minHeight: layoutSize.height }
          : undefined
      }
    >
      <div
        ref={trackRef}
        className="relative overflow-visible"
        style={{
          width: layoutSize.width,
          height: layoutSize.height,
          minHeight: layoutSize.height,
          marginLeft: isMobileLine ? -layoutSize.leadOffset : 0,
          marginTop: isMobileLine ? 0 : STAMP_SIZE * clipMarginRef.current.top,
          marginBottom: isMobileLine
            ? 0
            : STAMP_SIZE * clipMarginRef.current.bottom,
        }}
      >
      {photos.map((photo, index) => {
        const hidden = isStampHidden(photo.src);
        return (
          <div
            key={photo.src}
            ref={(el) => {
              stampRefs.current[index] = el;
              if (!el) return;
              const layout = layoutRef.current;
              const slotT = (index / photos.length + phaseRef.current) % 1;
              const point = isMobileLineRef.current
                ? getLinePointAt(slotT, layout)
                : getArcPointAt(slotT, corner, layout);
              applyStampPosition(el, point, pausedRef.current);
            }}
            className="absolute left-0 top-0 pointer-events-auto [backface-visibility:hidden]"
            style={{
              width: layoutSize.stampSize,
              height: layoutSize.stampSize,
              zIndex: hoveredKey === photo.src ? 40 : 10 + index,
              visibility: hidden ? "hidden" : "visible",
              pointerEvents: hidden ? "none" : "auto",
            }}
          >
            <FramedStamp
              photo={photo}
              corner={corner}
              photoRotateDeg={isMobileLine ? 0 : arcConfig.photoRotateDeg}
              stampSize={layoutSize.stampSize}
              isHovered={hoveredKey === photo.src}
              isHidden={hidden}
              onHoverStart={() => handleHoverStart(photo.src)}
              onHoverEnd={handleHoverEnd}
              onClick={() => handleClick(photo, index)}
            />
          </div>
        );
      })}
      </div>
    </div>
  );
}
