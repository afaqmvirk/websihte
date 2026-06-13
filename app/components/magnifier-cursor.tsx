"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const LENS_SIZE = 150;
const ZOOM = 1.25;
const EDGE_ZOOM = ZOOM * 1.07;
const CHROMA_OFFSET_X = 1.75;
const CHROMA_OFFSET_Y = 0.35;
const FOCUS_EXPAND_PERCENT = 130;
const EXPAND_SIZE_TRANSITION =
  "width 800ms cubic-bezier(0.22, 1, 0.36, 1), height 800ms cubic-bezier(0.22, 1, 0.36, 1)";
const SHRINK_SIZE_TRANSITION = "width 280ms ease-out, height 280ms ease-out";

type MagnifierCursorProps = {
  children: React.ReactNode;
  clone: React.ReactNode;
  /** Lighter clone for the rim layer (images only). Falls back to `clone`. */
  edgeClone?: React.ReactNode;
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
  zoom: number,
  sceneWidth: number,
  sceneHeight: number,
  offsetX = 0,
  offsetY = 0,
) {
  if (!el) return;
  el.style.width = `${sceneWidth}px`;
  el.style.height = `${sceneHeight}px`;
  el.style.left = `calc(50% - ${localX * zoom}px + ${offsetX}px)`;
  el.style.top = `calc(50% - ${localY * zoom}px + ${offsetY}px)`;
  el.style.transform = `scale(${zoom})`;
}

export default function MagnifierCursor({
  children,
  clone,
  edgeClone,
  focused = false,
  focusExpandPercent = FOCUS_EXPAND_PERCENT,
  onCursorMove,
  onCursorLeave,
}: MagnifierCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const sharpContentRef = useRef<HTMLDivElement>(null);
  const edgeContentRef = useRef<HTMLDivElement>(null);
  const chromaRedRef = useRef<HTMLDivElement>(null);
  const chromaBlueRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const pendingRef = useRef({ x: 0, y: 0 });
  const sceneRef = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const focusedRef = useRef(focused);
  const focusExpandRef = useRef(focusExpandPercent);

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [scene, setScene] = useState({ width: 0, height: 0, left: 0, top: 0 });

  focusedRef.current = focused;
  focusExpandRef.current = focusExpandPercent;
  sceneRef.current = scene;

  const lensSize = focused
    ? LENS_SIZE * (1 + focusExpandPercent / 100)
    : LENS_SIZE;

  const getLensSize = useCallback(() => {
    return focusedRef.current
      ? LENS_SIZE * (1 + focusExpandRef.current / 100)
      : LENS_SIZE;
  }, []);

  const applyLensPosition = useCallback(
    (clientX: number, clientY: number) => {
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
        ZOOM,
        s.width,
        s.height,
      );
      applyContentPosition(
        edgeContentRef.current,
        localX,
        localY,
        EDGE_ZOOM,
        s.width,
        s.height,
      );
      applyContentPosition(
        chromaRedRef.current,
        localX,
        localY,
        ZOOM,
        s.width,
        s.height,
        CHROMA_OFFSET_X,
        CHROMA_OFFSET_Y,
      );
      applyContentPosition(
        chromaBlueRef.current,
        localX,
        localY,
        ZOOM,
        s.width,
        s.height,
        -CHROMA_OFFSET_X,
        -CHROMA_OFFSET_Y,
      );
    },
    [],
  );

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

  const rimClone = edgeClone ?? clone;
  const showLens = enabled && active && mounted && scene.width > 0;

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
      <div className="magnifier-viewport magnifier-viewport--sharp absolute inset-0 overflow-hidden rounded-full">
        <div
          ref={sharpContentRef}
          className="magnifier-content absolute"
          style={{ transformOrigin: "0 0" }}
        >
          {clone}
        </div>
      </div>
      <div
        className="magnifier-viewport magnifier-viewport--edge absolute inset-0 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          ref={edgeContentRef}
          className="magnifier-content absolute"
          style={{ transformOrigin: "0 0" }}
        >
          {rimClone}
        </div>
      </div>
      <div
        className="magnifier-viewport magnifier-viewport--chroma magnifier-viewport--chroma-red absolute inset-0 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          ref={chromaRedRef}
          className="magnifier-content magnifier-content--chroma-red absolute"
          style={{ transformOrigin: "0 0" }}
        >
          {rimClone}
        </div>
      </div>
      <div
        className="magnifier-viewport magnifier-viewport--chroma magnifier-viewport--chroma-blue absolute inset-0 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          ref={chromaBlueRef}
          className="magnifier-content magnifier-content--chroma-blue absolute"
          style={{ transformOrigin: "0 0" }}
        >
          {rimClone}
        </div>
      </div>
      <div className="magnifier-glass absolute inset-0 rounded-full" />
    </div>
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
      {mounted && lens ? createPortal(lens, document.body) : null}
    </div>
  );
}
