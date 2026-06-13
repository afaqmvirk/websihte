"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const LENS_SIZE = 150;
const ZOOM = 1.25;
const FOCUS_EXPAND_PERCENT = 130;
const EXPAND_SIZE_TRANSITION =
  "width 800ms cubic-bezier(0.22, 1, 0.36, 1), height 800ms cubic-bezier(0.22, 1, 0.36, 1)";
const SHRINK_SIZE_TRANSITION = "width 280ms ease-out, height 280ms ease-out";

const MAP_SIZE = 256;
/** Displacement concentrated toward the rim (sharp center, warped edges). */
const RIM_EXPONENT = 3.5;
/** Edge displacement strength as a fraction of lens radius. */
const WARP_STRENGTH = 0.26;
/** Per-channel scale delta → chromatic aberration at the rim. */
const CHROMA_SPREAD = 0.04;
/** Inner radius (0–1) kept free of warp and chroma. */
const CENTER_DEAD_ZONE = 0.12;

/**
 * Radial lens displacement map (barrel distortion), generated on a canvas.
 * R = X displacement, G = Y displacement, neutral (128) in the center.
 * Adapted from Johan Beronius' canvas barrel-distortion technique.
 */
function buildDisplacementMap(): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
  const data = img.data;
  const c = MAP_SIZE / 2;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - c;
      const dy = y - c;
      const l = Math.sqrt(dx * dx + dy * dy);
      const rr = l / c;

      let r = 128;
      let g = 128;
      if (rr < 1 && rr > CENTER_DEAD_ZONE && l > 0) {
        const ux = dx / l;
        const uy = dy / l;
        const rimT = (rr - CENTER_DEAD_ZONE) / (1 - CENTER_DEAD_ZONE);
        const m = Math.pow(rimT, RIM_EXPONENT);
        // Inverted: pull pixels inward at rim (convex lens / magnify feel).
        r = 128 - ux * m * 127;
        g = 128 - uy * m * 127;

        // Smooth fade near the outer boundary to avoid filter-edge halos.
        if (rr > 0.86) {
          const fade = Math.pow(Math.max(0, (1 - rr) / 0.14), 1.6);
          r = 128 + (r - 128) * fade;
          g = 128 + (g - 128) * fade;
        }
      }

      const i = (y * MAP_SIZE + x) * 4;
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

type MagnifierCursorProps = {
  children: React.ReactNode;
  clone: React.ReactNode;
  /** Rendered above glass overlays, outside the displacement filter (e.g. speech bubbles). */
  overlay?: React.ReactNode;
  focused?: boolean;
  focusExpandPercent?: number;
  onCursorMove?: (
    localX: number,
    localY: number,
    scene: { width: number; height: number },
  ) => void;
  onCursorLeave?: () => void;
};

function applyContentPosition(
  el: HTMLDivElement | null,
  localX: number,
  localY: number,
  sceneWidth: number,
  sceneHeight: number,
) {
  if (!el) return;
  el.style.width = `${sceneWidth}px`;
  el.style.height = `${sceneHeight}px`;
  el.style.left = `calc(50% - ${localX * ZOOM}px)`;
  el.style.top = `calc(50% - ${localY * ZOOM}px)`;
  el.style.transform = `scale(${ZOOM})`;
}

export default function MagnifierCursor({
  children,
  clone,
  overlay,
  focused = false,
  focusExpandPercent = FOCUS_EXPAND_PERCENT,
  onCursorMove,
  onCursorLeave,
}: MagnifierCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const sharpContentRef = useRef<HTMLDivElement>(null);
  const overlayContentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const pendingRef = useRef({ x: 0, y: 0 });
  const sceneRef = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const focusedRef = useRef(focused);
  const focusExpandRef = useRef(focusExpandPercent);
  const filterId = `magnifier-lens-${useId().replace(/:/g, "")}`;

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [scene, setScene] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [dispMap, setDispMap] = useState("");

  focusedRef.current = focused;
  focusExpandRef.current = focusExpandPercent;
  sceneRef.current = scene;

  const lensSize = focused
    ? LENS_SIZE * (1 + focusExpandPercent / 100)
    : LENS_SIZE;
  const warpScale = lensSize * WARP_STRENGTH;

  const getLensSize = useCallback(() => {
    return focusedRef.current
      ? LENS_SIZE * (1 + focusExpandRef.current / 100)
      : LENS_SIZE;
  }, []);

  const applyLensPosition = useCallback((clientX: number, clientY: number) => {
    const s = sceneRef.current;
    if (s.width <= 0) return;

    const localX = clientX - s.left;
    const localY = clientY - s.top;
    const lens = lensRef.current;

    if (lens) {
      lens.style.left = `${clientX}px`;
      lens.style.top = `${clientY}px`;
    }

    applyContentPosition(
      sharpContentRef.current,
      localX,
      localY,
      s.width,
      s.height,
    );
    applyContentPosition(
      overlayContentRef.current,
      localX,
      localY,
      s.width,
      s.height,
    );
  }, []);

  const updateScene = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };
    sceneRef.current = next;
    setScene(next);
  }, []);

  useLayoutEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const size = getLensSize();
    lens.style.width = `${size}px`;
    lens.style.height = `${size}px`;
    lens.style.transform = "translate(-50%, -50%)";
    lens.style.transition = focused
      ? EXPAND_SIZE_TRANSITION
      : SHRINK_SIZE_TRANSITION;

    applyLensPosition(pendingRef.current.x, pendingRef.current.y);
  }, [focused, focusExpandPercent, applyLensPosition, getLensSize]);

  useEffect(() => {
    setMounted(true);
    setEnabled(!window.matchMedia("(pointer: coarse)").matches);
    setDispMap(buildDisplacementMap());
    updateScene();
    window.addEventListener("resize", updateScene);
    window.addEventListener("scroll", updateScene, true);
    return () => {
      window.removeEventListener("resize", updateScene);
      window.removeEventListener("scroll", updateScene, true);
    };
  }, [updateScene]);

  useEffect(() => {
    if (scene.width > 0) {
      applyLensPosition(pendingRef.current.x, pendingRef.current.y);
    }
  }, [scene.width, scene.height, applyLensPosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    pendingRef.current = { x: e.clientX, y: e.clientY };

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        const { x, y } = pendingRef.current;
        applyLensPosition(x, y);

        const s = sceneRef.current;
        if (onCursorMove && s.width > 0) {
          onCursorMove(x - s.left, y - s.top, {
            width: s.width,
            height: s.height,
          });
        }

        rafRef.current = 0;
      });
    }
  };

  const showLens =
    enabled && active && mounted && scene.width > 0 && dispMap !== "";

  const lensFilter = useMemo(
    () => (showLens ? `url(#${filterId})` : undefined),
    [showLens, filterId],
  );

  const lens = showLens ? (
    <div
      ref={lensRef}
      className="magnifier-lens pointer-events-none fixed z-[9999] overflow-hidden rounded-full select-none"
      style={{
        left: pendingRef.current.x,
        top: pendingRef.current.y,
        width: lensSize,
        height: lensSize,
        transform: "translate(-50%, -50%)",
      }}
      onDragStart={(e) => e.preventDefault()}
      aria-hidden
    >
      <div
        className="magnifier-viewport absolute inset-0 overflow-hidden rounded-full"
        style={{ filter: lensFilter }}
      >
        <div
          ref={sharpContentRef}
          className="magnifier-content absolute"
          style={{ transformOrigin: "0 0" }}
        >
          {clone}
        </div>
      </div>
      <div className="magnifier-glass-edge absolute inset-0 rounded-full" />
      <div className="magnifier-glass-specular absolute inset-0 rounded-full" />
      {overlay ? (
        <div className="magnifier-bubble-overlay pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <div
            ref={overlayContentRef}
            className="magnifier-content absolute"
            style={{ transformOrigin: "0 0" }}
          >
            {overlay}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const lensPortal = showLens ? (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={lensSize}
            height={lensSize}
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={dispMap}
              x="0"
              y="0"
              width={lensSize}
              height={lensSize}
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={warpScale * (1 + CHROMA_SPREAD)}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispR"
            />
            <feColorMatrix
              in="dispR"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="red"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={warpScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispG"
            />
            <feColorMatrix
              in="dispG"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="green"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={warpScale * (1 - CHROMA_SPREAD)}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispB"
            />
            <feColorMatrix
              in="dispB"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blue"
            />
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="out" />
          </filter>
        </defs>
      </svg>
      {lens}
    </>
  ) : null;

  return (
    <div
      ref={containerRef}
      className="magnifier-root relative min-h-screen w-full select-none"
      onMouseMove={handleMouseMove}
      onDragStart={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => {
        setActive(false);
        onCursorLeave?.();
      }}
    >
      {children}
      {mounted && lensPortal ? createPortal(lensPortal, document.body) : null}
    </div>
  );
}
