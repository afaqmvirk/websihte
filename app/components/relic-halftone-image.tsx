"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type RelicHalftoneImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  objectFit?: "cover" | "bottom" | "contain";
  className?: string;
  priority?: boolean;
  halftoneActive?: boolean;
  "aria-hidden"?: boolean;
};

/** Tailwind classes for rendering a relic image at a given object-fit mode. */
export function relicObjectFitClass(
  objectFit: RelicHalftoneImageProps["objectFit"],
): string {
  if (objectFit === "cover") return "h-full w-full select-none object-cover";
  if (objectFit === "bottom")
    return "h-full w-full select-none object-contain object-bottom";
  return "h-full w-full select-none object-contain";
}

/** Dot pitch in CSS pixels. */
const HALFTONE_PITCH_CSS = 2;
/** Extra resolution when building the luminance field. */
const SAMPLE_SCALE = 2;
const MAX_DPR = 3;

/** Push midtones toward black/white for a punchier halftone read. */
function contrastLuminance(lum: number, amount = 1.55) {
  const n = lum / 255;
  return Math.max(0, Math.min(255, ((n - 0.5) * amount + 0.5) * 255));
}

function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  const read = (px: number, py: number) => {
    const i = (py * width + px) * 4;
    return {
      lum: 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
      alpha: data[i + 3] / 255,
    };
  };

  const p00 = read(x0, y0);
  const p10 = read(x1, y0);
  const p01 = read(x0, y1);
  const p11 = read(x1, y1);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    lum: lerp(lerp(p00.lum, p10.lum, fx), lerp(p01.lum, p11.lum, fx), fy),
    alpha: lerp(lerp(p00.alpha, p10.alpha, fx), lerp(p01.alpha, p11.alpha, fx), fy),
  };
}

function drawImageToFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  objectFit: RelicHalftoneImageProps["objectFit"],
) {
  const imageRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (objectFit === "cover") {
    if (imageRatio > boxRatio) {
      drawHeight = height;
      drawWidth = height * imageRatio;
      offsetX = (width - drawWidth) / 2;
    } else {
      drawWidth = width;
      drawHeight = width / imageRatio;
      offsetY = (height - drawHeight) / 2;
    }
  } else if (objectFit === "bottom") {
    if (imageRatio > boxRatio) {
      drawWidth = width;
      drawHeight = width / imageRatio;
      offsetY = height - drawHeight;
    } else {
      drawHeight = height;
      drawWidth = height * imageRatio;
      offsetX = (width - drawWidth) / 2;
      offsetY = height - drawHeight;
    }
  } else {
    if (imageRatio > boxRatio) {
      drawWidth = width;
      drawHeight = width / imageRatio;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * imageRatio;
      offsetX = (width - drawWidth) / 2;
    }
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function paintHalftone(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cssWidth: number,
  cssHeight: number,
  objectFit: RelicHalftoneImageProps["objectFit"],
  dpr: number,
) {
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  const sampleWidth = width * SAMPLE_SCALE;
  const sampleHeight = height * SAMPLE_SCALE;

  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleCtx = sample.getContext("2d");
  if (!sampleCtx) return;

  sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  sampleCtx.imageSmoothingEnabled = true;
  sampleCtx.imageSmoothingQuality = "high";
  drawImageToFit(sampleCtx, img, sampleWidth, sampleHeight, objectFit);

  const { data } = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const cell = Math.max(2, Math.round(HALFTONE_PITCH_CSS * dpr));
  const radiusMax = cell * 0.5;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";

  for (let cy = cell / 2; cy < height; cy += cell) {
    for (let cx = cell / 2; cx < width; cx += cell) {
      const { lum, alpha } = sampleBilinear(
        data,
        sampleWidth,
        sampleHeight,
        cx * SAMPLE_SCALE,
        cy * SAMPLE_SCALE,
      );
      if (alpha < 0.35) continue;

      const contrasted = contrastLuminance(lum);
      const darkness = Math.pow(1 - contrasted / 255, 0.82);
      const radius = radiusMax * Math.sqrt(Math.max(0, Math.min(1, darkness)));

      if (radius > 0.08) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export default function RelicHalftoneImage({
  src,
  alt,
  width,
  height,
  sizes,
  objectFit = "contain",
  className = "",
  priority = false,
  halftoneActive = false,
  "aria-hidden": ariaHidden,
}: RelicHalftoneImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imageClassName = relicObjectFitClass(objectFit);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let frame = 0;
    let disposed = false;

    const img = new window.Image();
    img.decoding = "async";
    img.src = src;

    const render = () => {
      if (disposed || !img.complete || !img.naturalWidth) return;

      const displayWidth = container.clientWidth;
      const displayHeight = container.clientHeight;
      if (displayWidth <= 0 || displayHeight <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      paintHalftone(ctx, img, displayWidth, displayHeight, objectFit, dpr);
    };

    const scheduleRender = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    img.onload = scheduleRender;
    if (img.complete) scheduleRender();

    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [src, objectFit]);

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <div
        className="absolute inset-0 transition-opacity duration-300 ease-out"
        style={{ opacity: halftoneActive ? 0 : 1 }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          draggable={false}
          sizes={sizes}
          className={imageClassName}
          priority={priority}
          aria-hidden={ariaHidden}
        />
      </div>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full select-none transition-opacity duration-300 ease-out"
        style={{ opacity: halftoneActive ? 1 : 0 }}
        aria-hidden
      />
    </div>
  );
}
