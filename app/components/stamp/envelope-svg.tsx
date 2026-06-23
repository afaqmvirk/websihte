"use client";

import { useLayoutEffect, useId, useRef, type RefObject } from "react";

export type EnvelopeSvgLayer = "full" | "interior" | "flap" | "body";

export type EnvelopeSvgContentProps = {
  active?: boolean;
  className?: string;
  layer?: EnvelopeSvgLayer;
  flapApexY?: number;
  instantPalette?: boolean;
  flapLitRef?: RefObject<SVGPolygonElement | null>;
  flapDarkRef?: RefObject<SVGPolygonElement | null>;
};

type EnvelopeSvgProps = Omit<
  EnvelopeSvgContentProps,
  "flapApexY" | "flapLitRef" | "flapDarkRef" | "instantPalette"
> & {
  open: boolean;
};

export const ENVELOPE_VIEWBOX = { width: 400, height: 260 } as const;

export const bodyLeft = 48;
export const bodyRight = 352;
/** White body width as a fraction of the rendered SVG width. */
export const ENVELOPE_BODY_WIDTH_RATIO =
  (bodyRight - bodyLeft) / ENVELOPE_VIEWBOX.width;
export const bodyTop = 56;
export const bodyBottom = 248;
export const midX = 200;
export const midY = (bodyTop + bodyBottom) / 2;
export const hingeY = bodyTop;
export const closedApexY = midY;
export const openApexY = 2 * hingeY - midY;
export const FLAP_MS = 520;
export const FADE_MS = 450;

export const interiorPointsStatic = `${bodyLeft},${hingeY} ${bodyRight},${hingeY} ${midX},${closedApexY}`;

export function flapPointsFor(apexY: number) {
  return `${bodyLeft},${hingeY} ${bodyRight},${hingeY} ${midX},${apexY}`;
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Imperative flap motion — avoids per-frame React re-renders. */
export function useEnvelopeFlap(open: boolean, onApex?: (y: number) => void) {
  const apexRef = useRef(closedApexY);
  const rafRef = useRef(0);
  const onApexRef = useRef(onApex);
  onApexRef.current = onApex;

  useLayoutEffect(() => {
    const target = open ? openApexY : closedApexY;
    const start = apexRef.current;

    cancelAnimationFrame(rafRef.current);
    onApexRef.current?.(start);

    if (Math.abs(start - target) < 0.5) {
      apexRef.current = target;
      onApexRef.current?.(target);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / FLAP_MS);
      const y = start + (target - start) * easeOut(t);
      apexRef.current = y;
      onApexRef.current?.(y);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

  return apexRef;
}

export function useFlapPolygonSync(
  flapLitRef: RefObject<SVGPolygonElement | null>,
  flapDarkRef: RefObject<SVGPolygonElement | null>,
) {
  return (y: number) => {
    const pts = flapPointsFor(y);
    flapLitRef.current?.setAttribute("points", pts);
    flapDarkRef.current?.setAttribute("points", pts);
  };
}

type PaletteLayerProps = {
  uid: string;
  variant: "dark" | "lit";
  flapPoints: string;
  visible: boolean;
  layer: EnvelopeSvgLayer;
  instantPalette: boolean;
  flapLitRef?: RefObject<SVGPolygonElement | null>;
  flapDarkRef?: RefObject<SVGPolygonElement | null>;
};

function PaletteLayer({
  uid,
  variant,
  flapPoints,
  visible,
  layer,
  instantPalette,
  flapLitRef,
  flapDarkRef,
}: PaletteLayerProps) {
  const isLit = variant === "lit";
  const showInterior = layer === "full" || layer === "interior";
  const showBody = layer === "full" || layer === "body";
  const showFlap = layer === "full" || layer === "flap";
  const flapRef = isLit ? flapLitRef : flapDarkRef;

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transition: instantPalette ? "none" : `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      {showBody ? (
        <g mask={layer === "body" ? `url(#${uid}-body-frame-mask)` : undefined}>
          <rect
            x={bodyLeft}
            y={bodyTop}
            width={bodyRight - bodyLeft}
            height={bodyBottom - bodyTop}
            rx={4}
            fill={`url(#${uid}-body-${variant})`}
            stroke={isLit ? "#d0d0c8" : "#3a3a38"}
            strokeWidth={isLit ? 1.5 : 1}
          />
          {layer === "full" ? (
            <g clipPath={`url(#${uid}-body-clip)`}>
              <polygon
                points={interiorPointsStatic}
                fill={`url(#${uid}-interior-${variant})`}
              />
            </g>
          ) : null}
          <line
            x1={bodyLeft + 12}
            y1={bodyBottom - 1}
            x2={bodyRight - 12}
            y2={bodyBottom - 1}
            stroke={isLit ? "#d0d0c8" : "#333330"}
            strokeWidth={isLit ? 1 : 0.75}
          />
        </g>
      ) : null}

      {showInterior ? (
        <g clipPath={`url(#${uid}-body-clip)`}>
          <polygon
            points={interiorPointsStatic}
            fill={`url(#${uid}-interior-${variant})`}
          />
        </g>
      ) : null}

      {showFlap ? (
        <polygon
          ref={flapRef}
          points={flapPoints}
          fill={`url(#${uid}-flap-${variant})`}
          stroke={isLit ? "#d8d8d0" : "#444441"}
          strokeWidth={isLit ? 1.5 : 1}
          strokeLinejoin="round"
        />
      ) : null}
    </g>
  );
}

function EnvelopeDefs({
  uid,
  includeBodyMask,
}: {
  uid: string;
  includeBodyMask: boolean;
}) {
  return (
    <defs>
      <clipPath id={`${uid}-body-clip`}>
        <rect
          x={bodyLeft}
          y={bodyTop}
          width={bodyRight - bodyLeft}
          height={bodyBottom - bodyTop}
          rx={4}
        />
      </clipPath>
      {includeBodyMask ? (
        <mask id={`${uid}-body-frame-mask`}>
          <rect x={0} y={0} width={400} height={260} fill="white" />
          <polygon points={interiorPointsStatic} fill="black" />
        </mask>
      ) : null}
      <linearGradient id={`${uid}-body-lit`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f6f6f2" />
        <stop offset="100%" stopColor="#e8e8e2" />
      </linearGradient>
      <linearGradient id={`${uid}-flap-lit`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fcfcfa" />
        <stop offset="100%" stopColor="#efefe9" />
      </linearGradient>
      <linearGradient id={`${uid}-interior-lit`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3d3d3a" />
        <stop offset="100%" stopColor="#222220" />
      </linearGradient>
      <linearGradient id={`${uid}-body-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3a3a38" />
        <stop offset="100%" stopColor="#222220" />
      </linearGradient>
      <linearGradient id={`${uid}-flap-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4a4a47" />
        <stop offset="100%" stopColor="#2e2e2c" />
      </linearGradient>
      <linearGradient id={`${uid}-interior-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a1a18" />
        <stop offset="100%" stopColor="#0e0e0e" />
      </linearGradient>
    </defs>
  );
}

export function EnvelopeSvgContent({
  active = false,
  className,
  layer = "full",
  flapApexY = closedApexY,
  instantPalette = false,
  flapLitRef,
  flapDarkRef,
}: EnvelopeSvgContentProps) {
  const uid = useId().replace(/:/g, "");
  const flapPoints = flapPointsFor(flapApexY);

  return (
    <svg
      viewBox={`0 0 ${ENVELOPE_VIEWBOX.width} ${ENVELOPE_VIEWBOX.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      overflow="visible"
    >
      <EnvelopeDefs uid={uid} includeBodyMask={layer === "body"} />
      <PaletteLayer
        uid={uid}
        variant="dark"
        flapPoints={flapPoints}
        visible={!active}
        layer={layer}
        instantPalette={instantPalette}
        flapDarkRef={flapDarkRef}
      />
      <PaletteLayer
        uid={uid}
        variant="lit"
        flapPoints={flapPoints}
        visible={active}
        layer={layer}
        instantPalette={instantPalette}
        flapLitRef={flapLitRef}
      />
    </svg>
  );
}

/** Full envelope with imperative flap animation. */
export default function EnvelopeSvg({
  open,
  active = false,
  className,
  layer = "full",
}: EnvelopeSvgProps) {
  const flapLitRef = useRef<SVGPolygonElement>(null);
  const flapDarkRef = useRef<SVGPolygonElement>(null);
  const syncFlap = useFlapPolygonSync(flapLitRef, flapDarkRef);

  useEnvelopeFlap(open, syncFlap);

  return (
    <EnvelopeSvgContent
      active={active}
      className={className}
      layer={layer}
      flapApexY={closedApexY}
      instantPalette={open}
      flapLitRef={flapLitRef}
      flapDarkRef={flapDarkRef}
    />
  );
}
