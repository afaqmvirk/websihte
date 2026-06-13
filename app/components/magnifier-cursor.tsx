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
const RETREAT_TRANSITION_MS = 320;
const RETREAT_SCALE = 0.12;
const LENS_PRESENTATION_TRANSITION = `transform ${RETREAT_TRANSITION_MS}ms ease-out, opacity ${RETREAT_TRANSITION_MS}ms ease-out`;

const MAP_SIZE = 256;
/** Match hero mobile tier — scroll passthrough when touch is not on a relic. */
const MOBILE_BREAKPOINT = 768;
/** Lift the lens above the touch point so the finger doesn't cover it. */
const TOUCH_LENS_OFFSET_Y = -150;
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
  onMagnifierActiveChange?: (active: boolean) => void;
  /** Mobile: return true to engage the lens; false allows page scroll (e.g. text / empty areas). */
  shouldCaptureTouch?: (
    localX: number,
    localY: number,
    scene: { width: number; height: number },
  ) => boolean;
};

function applyContentPosition(
  el: HTMLDivElement | null,
  localX: number,
  localY: number,
  sceneWidth: number,
  sceneHeight: number,
  lensSize: number,
) {
  if (!el) return;
  el.style.width = `${sceneWidth}px`;
  el.style.height = `${sceneHeight}px`;
  // Pin scene sample point to the lens center (avoid % containing-block ambiguity).
  el.style.left = `${lensSize / 2 - localX * ZOOM}px`;
  el.style.top = `${lensSize / 2 - localY * ZOOM}px`;
  el.style.transform = `scale(${ZOOM})`;
}

function measureSceneRect(container: HTMLElement | null) {
  const sceneEl =
    container?.querySelector<HTMLElement>("[data-hero-scene]") ?? container;
  if (!sceneEl) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  const rect = sceneEl.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    left: rect.left,
    top: rect.top,
  };
}

export default function MagnifierCursor({
  children,
  clone,
  overlay,
  focused = false,
  focusExpandPercent = FOCUS_EXPAND_PERCENT,
  onCursorMove,
  onMagnifierActiveChange,
  shouldCaptureTouch,
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
  const activeRef = useRef(false);
  const touchScrollPassthroughRef = useRef(false);
  const isMobileViewportRef = useRef(false);
  const retreatTimerRef = useRef<number>(0);
  const enteringRafRef = useRef<number>(0);
  const enterAnimStartedRef = useRef(false);
  const sizeSyncRafRef = useRef<number>(0);
  const sizeSyncTimeoutRef = useRef<number>(0);
  const filterId = `magnifier-lens-${useId().replace(/:/g, "")}`;

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [entering, setEntering] = useState(false);
  const [retreating, setRetreating] = useState(false);
  const [scene, setScene] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [dispMap, setDispMap] = useState("");

  focusedRef.current = focused;
  focusExpandRef.current = focusExpandPercent;
  activeRef.current = active;
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

  const getRenderedLensSize = useCallback((lens: HTMLDivElement | null) => {
    if (!lens) return getLensSize();
    const { width } = lens.getBoundingClientRect();
    return width > 0 ? width : getLensSize();
  }, [getLensSize]);

  const cancelSizeSync = useCallback(() => {
    if (sizeSyncRafRef.current) {
      cancelAnimationFrame(sizeSyncRafRef.current);
      sizeSyncRafRef.current = 0;
    }
    if (sizeSyncTimeoutRef.current) {
      window.clearTimeout(sizeSyncTimeoutRef.current);
      sizeSyncTimeoutRef.current = 0;
    }
  }, []);

  const cancelEnterAnimation = useCallback(() => {
    if (enteringRafRef.current) {
      cancelAnimationFrame(enteringRafRef.current);
      enteringRafRef.current = 0;
    }
    enterAnimStartedRef.current = false;
    setEntering(false);
  }, []);

  const finishEnterAnimation = useCallback(() => {
    enterAnimStartedRef.current = false;
    setEntering(false);
  }, []);

  const deactivateMagnifier = useCallback(() => {
    cancelEnterAnimation();
    cancelSizeSync();
    if (retreatTimerRef.current) {
      window.clearTimeout(retreatTimerRef.current);
      retreatTimerRef.current = 0;
    }
    setRetreating(false);
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    onMagnifierActiveChange?.(false);
  }, [cancelEnterAnimation, cancelSizeSync, onMagnifierActiveChange]);

  const setMagnifierActive = useCallback(
    (next: boolean) => {
      if (activeRef.current === next) return;
      if (next) {
        if (retreatTimerRef.current) {
          window.clearTimeout(retreatTimerRef.current);
          retreatTimerRef.current = 0;
        }
        setRetreating(false);
        setActive(true);
        activeRef.current = true;
        onMagnifierActiveChange?.(true);
        return;
      }
      deactivateMagnifier();
    },
    [deactivateMagnifier, onMagnifierActiveChange],
  );

  const isPointerInContainer = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  const beginRetreat = useCallback(() => {
    if (!activeRef.current) return;
    if (retreatTimerRef.current) return;
    cancelEnterAnimation();
    setRetreating(true);
    retreatTimerRef.current = window.setTimeout(() => {
      retreatTimerRef.current = 0;
      deactivateMagnifier();
    }, RETREAT_TRANSITION_MS);
  }, [cancelEnterAnimation, deactivateMagnifier]);

  const cancelRetreat = useCallback(() => {
    if (retreatTimerRef.current) {
      window.clearTimeout(retreatTimerRef.current);
      retreatTimerRef.current = 0;
    }
    setRetreating(false);
  }, []);

  const getLensClientCoords = useCallback((clientX: number, clientY: number) => {
    return {
      x: clientX,
      y: isMobileViewportRef.current
        ? clientY + TOUCH_LENS_OFFSET_Y
        : clientY,
    };
  }, []);

  const applyLensPosition = useCallback(
    (clientX: number, clientY: number) => {
      const next = measureSceneRect(containerRef.current);
      if (next.width <= 0) return;
      sceneRef.current = next;

      const { x: lensX, y: lensY } = getLensClientCoords(clientX, clientY);
      const localX = lensX - next.left;
      const localY = lensY - next.top;
      const lens = lensRef.current;
      const size = getRenderedLensSize(lens);

      if (lens) {
        lens.style.left = `${lensX}px`;
        lens.style.top = `${lensY}px`;
      }

      applyContentPosition(
        sharpContentRef.current,
        localX,
        localY,
        next.width,
        next.height,
        size,
      );
      applyContentPosition(
        overlayContentRef.current,
        localX,
        localY,
        next.width,
        next.height,
        size,
      );
    },
    [getLensClientCoords, getRenderedLensSize],
  );

  const runSizeSyncLoop = useCallback(
    (durationMs: number) => {
      cancelSizeSync();
      const tick = () => {
        applyLensPosition(pendingRef.current.x, pendingRef.current.y);
        sizeSyncRafRef.current = requestAnimationFrame(tick);
      };
      sizeSyncRafRef.current = requestAnimationFrame(tick);
      sizeSyncTimeoutRef.current = window.setTimeout(cancelSizeSync, durationMs);
    },
    [applyLensPosition, cancelSizeSync],
  );

  const syncSceneAndLens = useCallback(() => {
    const next = measureSceneRect(containerRef.current);
    if (next.width <= 0) return;

    sceneRef.current = next;
    setScene(next);

    if (!activeRef.current) return;

    const { x, y } = pendingRef.current;
    applyLensPosition(x, y);

    const s = sceneRef.current;
    if (onCursorMove && s.width > 0) {
      const { x: lensX, y: lensY } = getLensClientCoords(x, y);
      onCursorMove(lensX - s.left, lensY - s.top, {
        width: s.width,
        height: s.height,
      });
    }

    if (!isPointerInContainer(x, y)) {
      beginRetreat();
    } else {
      cancelRetreat();
    }
  }, [
    applyLensPosition,
    beginRetreat,
    cancelRetreat,
    getLensClientCoords,
    isPointerInContainer,
    onCursorMove,
  ]);

  useLayoutEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const size = getLensSize();
    lens.style.width = `${size}px`;
    lens.style.height = `${size}px`;

    const sizeTransition = focused
      ? EXPAND_SIZE_TRANSITION
      : SHRINK_SIZE_TRANSITION;

    if (retreating) {
      lens.style.transition = `${sizeTransition}, ${LENS_PRESENTATION_TRANSITION}`;
      lens.style.transform = `translate(-50%, -50%) scale(${RETREAT_SCALE})`;
      lens.style.opacity = "0";
    } else if (entering && !enterAnimStartedRef.current) {
      enterAnimStartedRef.current = true;
      lens.style.transition = "none";
      lens.style.transform = `translate(-50%, -50%) scale(${RETREAT_SCALE})`;
      lens.style.opacity = "0";
      void lens.offsetWidth;

      enteringRafRef.current = requestAnimationFrame(() => {
        enteringRafRef.current = 0;
        const currentLens = lensRef.current;
        if (!currentLens || !activeRef.current) {
          finishEnterAnimation();
          return;
        }

        currentLens.style.transition = `${sizeTransition}, ${LENS_PRESENTATION_TRANSITION}`;
        currentLens.style.transform = "translate(-50%, -50%) scale(1)";
        currentLens.style.opacity = "1";

        let finished = false;
        const finishOnce = () => {
          if (finished) return;
          finished = true;
          currentLens.removeEventListener("transitionend", onTransitionEnd);
          finishEnterAnimation();
        };

        const onTransitionEnd = (event: TransitionEvent) => {
          if (event.target !== currentLens) return;
          if (event.propertyName !== "opacity") return;
          finishOnce();
        };
        currentLens.addEventListener("transitionend", onTransitionEnd);
        window.setTimeout(finishOnce, RETREAT_TRANSITION_MS + 80);
      });
    } else if (!entering) {
      lens.style.transition = `${sizeTransition}, ${LENS_PRESENTATION_TRANSITION}`;
      lens.style.transform = "translate(-50%, -50%) scale(1)";
      lens.style.opacity = "1";
    }

    applyLensPosition(pendingRef.current.x, pendingRef.current.y);

    if (activeRef.current && !retreating && !entering) {
      runSizeSyncLoop(focused ? 820 : 300);
    }
  }, [
    focused,
    focusExpandPercent,
    applyLensPosition,
    getLensSize,
    retreating,
    entering,
    finishEnterAnimation,
    runSizeSyncLoop,
  ]);

  useEffect(() => {
    setMounted(true);
    setEnabled(true);
    setDispMap(buildDisplacementMap());
    syncSceneAndLens();

    const mobileMq = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT}px)`,
    );
    const syncMobile = () => {
      isMobileViewportRef.current = mobileMq.matches;
    };
    syncMobile();
    mobileMq.addEventListener("change", syncMobile);

    window.addEventListener("resize", syncSceneAndLens);
    window.addEventListener("scroll", syncSceneAndLens, true);
    return () => {
      mobileMq.removeEventListener("change", syncMobile);
      window.removeEventListener("resize", syncSceneAndLens);
      window.removeEventListener("scroll", syncSceneAndLens, true);
      window.clearTimeout(retreatTimerRef.current);
      cancelEnterAnimation();
      cancelSizeSync();
    };
  }, [syncSceneAndLens, cancelEnterAnimation, cancelSizeSync]);

  useEffect(() => {
    const onDocumentMouseMove = (e: MouseEvent) => {
      if (isMobileViewportRef.current) return;
      if (!activeRef.current && !retreatTimerRef.current) return;
      if (isPointerInContainer(e.clientX, e.clientY)) return;
      beginRetreat();
    };

    document.addEventListener("mousemove", onDocumentMouseMove);
    return () => document.removeEventListener("mousemove", onDocumentMouseMove);
  }, [beginRetreat, isPointerInContainer]);

  const schedulePointerUpdate = useCallback(
    (clientX: number, clientY: number) => {
      pendingRef.current = { x: clientX, y: clientY };

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const { x, y } = pendingRef.current;
          applyLensPosition(x, y);

          const s = sceneRef.current;
          if (onCursorMove && s.width > 0) {
            const { x: lensX, y: lensY } = getLensClientCoords(x, y);
            onCursorMove(lensX - s.left, lensY - s.top, {
              width: s.width,
              height: s.height,
            });
          }

          rafRef.current = 0;
        });
      }
    },
    [applyLensPosition, getLensClientCoords, onCursorMove],
  );

  const activateFromHeroEntry = useCallback(
    (clientX: number, clientY: number) => {
      if (isMobileViewportRef.current) return;
      cancelRetreat();
      cancelEnterAnimation();
      pendingRef.current = { x: clientX, y: clientY };
      setMagnifierActive(true);
      setEntering(true);
      schedulePointerUpdate(clientX, clientY);
    },
    [cancelEnterAnimation, cancelRetreat, schedulePointerUpdate, setMagnifierActive],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (touchScrollPassthroughRef.current) return;
      if (!activeRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      schedulePointerUpdate(touch.clientX, touch.clientY);
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [schedulePointerUpdate]);

  useEffect(() => {
    if (scene.width > 0 && activeRef.current) {
      applyLensPosition(pendingRef.current.x, pendingRef.current.y);
    }
  }, [scene.width, scene.height, scene.left, scene.top, applyLensPosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    schedulePointerUpdate(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    touchScrollPassthroughRef.current = false;

    const touch = e.touches[0];
    if (isMobileViewportRef.current) {
      const s = measureSceneRect(containerRef.current);
      const localX = touch.clientX - s.left;
      const localY = touch.clientY - s.top;
      const capture =
        s.width > 0 &&
        (shouldCaptureTouch?.(localX, localY, s) ?? false);
      if (!capture) {
        touchScrollPassthroughRef.current = true;
        return;
      }
    }

    setMagnifierActive(true);
    schedulePointerUpdate(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchScrollPassthroughRef.current) {
      if (e.touches.length === 0) {
        touchScrollPassthroughRef.current = false;
      }
      return;
    }
    if (e.touches.length > 0) return;
    setMagnifierActive(false);
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
      className="magnifier-root h-app relative w-full overflow-hidden select-none max-md:touch-pan-y md:touch-none"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragStart={(e) => e.preventDefault()}
      onMouseEnter={(e) => {
        activateFromHeroEntry(e.clientX, e.clientY);
      }}
      onMouseLeave={() => {
        if (isMobileViewportRef.current) return;
        beginRetreat();
      }}
    >
      {children}
      {mounted && lensPortal ? createPortal(lensPortal, document.body) : null}
    </div>
  );
}
