"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  EnvelopeSvgContent,
  ENVELOPE_BODY_WIDTH_RATIO,
  useEnvelopeFlap,
  useFlapPolygonSync,
} from "@/components/stamp/envelope-svg";
import { ENVELOPE_CONFIG, STAMP_FRAME, stampPhotoTransform } from "@/components/stamp/stamp-config";
import { useEnvelope, type FlyRequest } from "@/components/stamp/envelope-context";
import { BREAKPOINT } from "@/components/shared/breakpoints";
import StampSheen from "@/components/stamp/stamp-sheen";

const PHOTO_INSET = STAMP_FRAME.photoInset;
const PHOTO_W = STAMP_FRAME.photoWidth;
const PHOTO_H = STAMP_FRAME.photoHeight;
const STAMP_SIZE = STAMP_FRAME.size;
const DRAG_THRESHOLD_PX = 8;
const MOBILE_MAX_WIDTH = BREAKPOINT.desktopMin - 1;

const POP_MS = 200;
const FLY_MS = 1080;
const FADE_MS = 140;
const FLY_EXIT_WIDTH_FRACTION = 1 / 3;
const POP_PEAK_SCALE = 1.16;

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function cubicAt(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Fraction of fly progress when the stamp reaches the envelope slot. */
const ENTRY_PATH_T = 0.4;

function flyApproachControls(
  sx: number,
  sy: number,
  entryX: number,
  entryY: number,
) {
  const dx = entryX - sx;
  const approachDist = Math.hypot(dx, sy - entryY);
  const arc = Math.min(420, Math.max(180, approachDist * 0.62));
  const dropIn = Math.max(120, approachDist * 0.3);

  return {
    c1x: sx + dx * 0.32,
    c1y: Math.min(sy, entryY) - arc,
    c2x: entryX,
    c2y: entryY - dropIn,
  };
}

function flyDescentControls(
  entryX: number,
  entryY: number,
  endX: number,
  endY: number,
) {
  const drop = endY - entryY;

  return {
    c1x: entryX,
    c1y: entryY + drop * 0.3,
    c2x: endX,
    c2y: entryY + drop * 0.78,
  };
}

function flyPositionAt(
  t: number,
  sx: number,
  sy: number,
  entryX: number,
  entryY: number,
  endX: number,
  endY: number,
) {
  if (t <= ENTRY_PATH_T) {
    const u = t / ENTRY_PATH_T;
    const { c1x, c1y, c2x, c2y } = flyApproachControls(sx, sy, entryX, entryY);
    return {
      x: cubicAt(u, sx, c1x, c2x, entryX),
      y: cubicAt(u, sy, c1y, c2y, entryY),
    };
  }

  const u = (t - ENTRY_PATH_T) / (1 - ENTRY_PATH_T);
  const { c1x, c1y, c2x, c2y } = flyDescentControls(
    entryX,
    entryY,
    endX,
    endY,
  );
  return {
    x: cubicAt(u, entryX, c1x, c2x, endX),
    y: cubicAt(u, entryY, c1y, c2y, endY),
  };
}

function flyExitY(viewportHeight: number, stampHeight: number) {
  return viewportHeight + stampHeight * 0.65 + 32;
}

/** Transform scale so rendered width = ⅓ of the visible envelope body. */
function flyExitScale(envelopeWidth: number, stampSize: number) {
  const bodyWidth = envelopeWidth * ENVELOPE_BODY_WIDTH_RATIO;
  const targetWidth = bodyWidth * FLY_EXIT_WIDTH_FRACTION;
  return targetWidth / stampSize;
}

function shortestAngleDelta(fromDeg: number, toDeg: number) {
  return ((toDeg - fromDeg + 180) % 360) - 180;
}

function useIsMobileEnvelope() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function FlyingStamp({
  flight,
  onDone,
  entryRotation,
}: {
  flight: FlyRequest;
  onDone: () => void;
  entryRotation: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { from, to, startRotation, startScale, stampSize, photoRotateDeg, envelopeWidth } =
    flight;
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const entryX = to.left + to.width / 2;
    const entryY = to.top + to.height / 2;
    const endX = entryX;
    const endY = flyExitY(window.innerHeight, stampSize);
    const exitScale = flyExitScale(envelopeWidth, stampSize);
    const rotationDelta = shortestAngleDelta(startRotation, entryRotation);

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.width = `${stampSize}px`;
    el.style.height = `${stampSize}px`;
    el.style.opacity = "1";
    el.style.transition = "none";

    const t0 = performance.now();
    let raf = 0;
    let fadeTimer = 0;
    let done = false;

    const applyTransform = (
      x: number,
      y: number,
      scale: number,
      rotate: number,
    ) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`;
    };

    const tick = (now: number) => {
      if (done) return;

      const elapsed = now - t0;

      if (elapsed < POP_MS) {
        const t = elapsed / POP_MS;
        const popMul = 1 + (POP_PEAK_SCALE - 1) * Math.sin(t * Math.PI);
        applyTransform(startX, startY, startScale * popMul, startRotation);
        raf = requestAnimationFrame(tick);
        return;
      }

      const flyElapsed = elapsed - POP_MS;
      if (flyElapsed < FLY_MS) {
        const t = easeInOutSine(flyElapsed / FLY_MS);
        const { x, y } = flyPositionAt(
          t,
          startX,
          startY,
          entryX,
          entryY,
          endX,
          endY,
        );
        const scale =
          startScale + (exitScale - startScale) * easeInOutSine(t);
        const alignT = Math.min(1, t / (ENTRY_PATH_T * 1.15));
        const rotate =
          startRotation + rotationDelta * easeInOutSine(alignT);
        const fadeT = Math.max(0, (t - 0.68) / 0.32);
        el.style.opacity = String(1 - fadeT * 0.9);
        applyTransform(x, y, scale, rotate);
        raf = requestAnimationFrame(tick);
        return;
      }

      done = true;
      el.style.opacity = "0";
      fadeTimer = window.setTimeout(onDone, FADE_MS);
    };

    applyTransform(startX, startY, startScale, startRotation);
    tick(t0);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(fadeTimer);
    };
  }, [
    flight,
    onDone,
    envelopeWidth,
    entryRotation,
    photoRotateDeg,
    stampSize,
    startRotation,
    startScale,
    startX,
    startY,
    to,
  ]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[2] overflow-hidden"
      style={{
        left: startX,
        top: startY,
        width: stampSize,
        height: stampSize,
        transform: `translate(-50%, -50%) rotate(${startRotation}deg) scale(${startScale})`,
        transformOrigin: "center center",
        opacity: 1,
        isolation: "isolate",
      }}
    >
      <Image
        src="/sections/stamp-frame.png"
        alt=""
        width={STAMP_SIZE}
        height={STAMP_SIZE}
        className="absolute inset-0 z-0 h-full w-full"
        draggable={false}
      />
      <div
        className="absolute z-[1] overflow-hidden"
        style={{
          left: `${(PHOTO_INSET / STAMP_SIZE) * 100}%`,
          top: `${(PHOTO_INSET / STAMP_SIZE) * 100}%`,
          width: `${(PHOTO_W / STAMP_SIZE) * 100}%`,
          height: `${(PHOTO_H / STAMP_SIZE) * 100}%`,
        }}
      >
        <Image
          src={flight.photo.src}
          alt=""
          width={Math.round(PHOTO_W)}
          height={Math.round(PHOTO_H)}
          className="h-full w-full object-cover"
          draggable={false}
          style={{
            objectPosition: flight.photo.objectPosition ?? "center",
            transform: stampPhotoTransform(flight.photo, photoRotateDeg),
          }}
        />
      </div>
      <StampSheen active />
    </div>
  );
}

function FlyingPhotoLayer({
  flights,
  onComplete,
  entryRotation,
}: {
  flights: FlyRequest[];
  onComplete: (id: string) => void;
  entryRotation: number;
}) {
  if (flights.length === 0) return null;

  return (
    <>
      {flights.map((flight) => (
        <FlyingStamp
          key={flight.id}
          flight={flight}
          entryRotation={entryRotation}
          onDone={() => onComplete(flight.id)}
        />
      ))}
    </>
  );
}

/** SVG envelope — pops up in the black sections, draggable on desktop. */
export function SectionEnvelope() {
  const {
    registerEnvelope,
    registerPocket,
    registerEntry,
    isOpen,
    isVisible,
    setVisible,
    releaseAllStamps,
    collectedStamps,
    flights,
    flyingStamp,
    completeFlight,
  } = useEnvelope();
  const cfg = ENVELOPE_CONFIG;
  const isMobile = useIsMobileEnvelope();
  const envelopeRef = useRef<HTMLButtonElement>(null);
  const assignEnvelopeRef = useCallback(
    (el: HTMLButtonElement | null) => {
      envelopeRef.current = el;
      registerEnvelope(el);
    },
    [registerEnvelope],
  );
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startDragX: 0,
    dragging: false,
  });

  const dragEnabled = !isMobile;
  const rotateDeg = isMobile ? cfg.rotateDegMobile : cfg.rotateDeg;
  const entryRotation = rotateDeg;

  const isEngaged =
    isOpen ||
    flights.length > 0 ||
    flyingStamp !== null ||
    isHovered ||
    isPressed ||
    isDragging;

  const hasFlights = flights.length > 0;
  const flapLitRef = useRef<SVGPolygonElement>(null);
  const flapDarkRef = useRef<SVGPolygonElement>(null);
  const syncFlap = useFlapPolygonSync(flapLitRef, flapDarkRef);
  useEnvelopeFlap(isOpen, syncFlap);
  const instantPalette = isEngaged || hasFlights;
  const innerScale = isEngaged ? cfg.engagedScale : 1;
  const innerOpacity = isEngaged ? 1 : 0.72;
  const innerVisualClass =
    "origin-bottom overflow-visible transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
  const innerVisualStyle = {
    transform: `scale(${innerScale})`,
    opacity: innerOpacity,
  } as const;
  const [flightBodyEngaged, setFlightBodyEngaged] = useState(false);

  useLayoutEffect(() => {
    if (!hasFlights) {
      setFlightBodyEngaged(false);
      return;
    }

    setFlightBodyEngaged(false);
    const raf = requestAnimationFrame(() => setFlightBodyEngaged(true));
    return () => cancelAnimationFrame(raf);
  }, [hasFlights]);

  const flightBodyStyle = {
    transform: `scale(${flightBodyEngaged ? innerScale : 1})`,
    opacity: flightBodyEngaged ? innerOpacity : 0.72,
  } as const;
  const shellTransform = `translateX(calc(-50% + ${dragX}px)) translateY(${cfg.translateYPercent}%) rotate(${rotateDeg}deg)`;
  const shellWidth = `min(${cfg.widthVw}vw, ${cfg.maxWidthPx}px)`;

  useEffect(() => {
    const target = document.getElementById("dark-sections");
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.04, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [setVisible]);

  useEffect(() => {
    if (!dragEnabled) {
      setDragX(0);
      setIsDragging(false);
    }
  }, [dragEnabled]);

  const clampDragX = useCallback((x: number) => {
    const el = envelopeRef.current;
    if (!el) return x;
    const margin = 12;
    const max = Math.max(0, (window.innerWidth - el.offsetWidth) / 2 - margin);
    return Math.max(-max, Math.min(max, x));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setIsPressed(true);
      if (!dragEnabled || e.button !== 0) return;
      suppressClickRef.current = false;
      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startDragX: dragX,
        dragging: false,
      };
    },
    [dragEnabled, dragX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragEnabled || !dragRef.current.active || e.pointerId !== dragRef.current.pointerId) {
        return;
      }

      const dx = e.clientX - dragRef.current.startX;
      if (!dragRef.current.dragging) {
        if (Math.abs(dx) <= DRAG_THRESHOLD_PX) return;
        dragRef.current.dragging = true;
        suppressClickRef.current = true;
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      setDragX(clampDragX(dragRef.current.startDragX + dx));
    },
    [clampDragX, dragEnabled],
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setIsPressed(false);
      if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;

      if (dragRef.current.dragging && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      dragRef.current.active = false;
      dragRef.current.dragging = false;
      setIsDragging(false);
    },
    [],
  );

  const handleClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    releaseAllStamps();
  }, [releaseAllStamps]);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[9998] transition-[opacity,bottom] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          bottom: isVisible ? 0 : "-42vh",
          opacity: isVisible ? 1 : 0,
        }}
        aria-hidden={!isVisible}
      >
        <div className="relative mx-auto w-full">
          {/* Interior + flap — stamp flies in front of these */}
          <button
            ref={assignEnvelopeRef}
            type="button"
            className={`group absolute bottom-0 left-1/2 z-0 max-w-none overflow-visible border-0 bg-transparent p-0 shadow-none outline-none select-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-section-bg ${isVisible ? "pointer-events-auto" : "pointer-events-none"} ${dragEnabled ? (isDragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : "cursor-pointer"}`}
            style={{
              width: shellWidth,
              transform: shellTransform,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => {
              setIsHovered(false);
              setIsPressed(false);
            }}
            onClick={handleClick}
            aria-label={
              collectedStamps.size > 0
                ? `release ${collectedStamps.size} stamps from envelope${dragEnabled ? " — drag to reposition" : ""}`
                : `envelope${dragEnabled ? " — drag to reposition" : ""}`
            }
          >
            <div className={innerVisualClass} style={innerVisualStyle}>
              <div className="relative">
                <EnvelopeSvgContent
                  layer="interior"
                  active={isEngaged}
                  instantPalette={instantPalette}
                  className="h-auto w-full"
                />
                {!hasFlights ? (
                  <EnvelopeSvgContent
                    layer="body"
                    active={isEngaged}
                    instantPalette={instantPalette}
                    className="absolute inset-0 h-full w-full"
                  />
                ) : null}
                <EnvelopeSvgContent
                  layer="flap"
                  active={isEngaged}
                  instantPalette={instantPalette}
                  flapLitRef={flapLitRef}
                  flapDarkRef={flapDarkRef}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
            <div
              ref={registerEntry}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2"
              style={{
                top: cfg.entryTop,
                width: cfg.entryWidth,
                height: "5%",
              }}
              aria-hidden
            />
            <div
              ref={registerPocket}
              className="pointer-events-none absolute"
              style={{
                left: cfg.pocketLeft,
                top: cfg.pocketTop,
                width: cfg.pocketWidth,
                height: cfg.pocketHeight,
              }}
              aria-hidden
            />
          </button>

          {/* Flying stamps — above interior + flap, below white body frame */}
          {hasFlights ? (
            <FlyingPhotoLayer
              flights={flights}
              onComplete={completeFlight}
              entryRotation={entryRotation}
            />
          ) : null}

          {/* White body frame — occludes stamp except over the opening */}
          {hasFlights ? (
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 z-[3]"
              style={{
                width: shellWidth,
                transform: shellTransform,
              }}
              aria-hidden
            >
              <div className={innerVisualClass} style={flightBodyStyle}>
                <EnvelopeSvgContent
                  layer="body"
                  active={isEngaged}
                  instantPalette={instantPalette}
                  className="h-auto w-full"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
