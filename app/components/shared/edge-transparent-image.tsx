"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  markAppReady,
  type AppReadyGate,
} from "@/components/shared/app-ready";

type EdgeTransparentImageProps = {
  src: string;
  alt: string;
  sizes: string;
  readyGate: Extract<AppReadyGate, "who-photo" | "sponsor-photo">;
  className?: string;
};

const EDGE_COLOR_TOLERANCE = 3;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode edge-transparent image"));
    };
    image.src = objectUrl;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode edge-transparent image"));
    }, "image/png");
  });
}

/** Removes only the solid matte connected to the source image's outer edge. */
async function removeConnectedEdgeMatte(src: string): Promise<string> {
  const response = await fetch(src, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Unable to load ${src}`);

  const image = await loadImage(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const width = canvas.width;
  const height = canvas.height;
  const pixelCount = width * height;
  const keyRed = data[0];
  const keyGreen = data[1];
  const keyBlue = data[2];
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueHead = 0;
  let queueTail = 0;

  const matchesMatte = (pixel: number) => {
    const offset = pixel * 4;
    return (
      Math.abs(data[offset] - keyRed) <= EDGE_COLOR_TOLERANCE &&
      Math.abs(data[offset + 1] - keyGreen) <= EDGE_COLOR_TOLERANCE &&
      Math.abs(data[offset + 2] - keyBlue) <= EDGE_COLOR_TOLERANCE
    );
  };

  const enqueue = (pixel: number) => {
    if (visited[pixel] || !matchesMatte(pixel)) return;
    visited[pixel] = 1;
    queue[queueTail] = pixel;
    queueTail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueHead < queueTail) {
    const pixel = queue[queueHead];
    queueHead += 1;
    data[pixel * 4 + 3] = 0;

    const x = pixel % width;
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (pixel >= width) enqueue(pixel - width);
    if (pixel < pixelCount - width) enqueue(pixel + width);
  }

  context.putImageData(imageData, 0, 0);
  return URL.createObjectURL(await canvasToPng(canvas));
}

export default function EdgeTransparentImage({
  src,
  alt,
  sizes,
  readyGate,
  className = "object-cover",
}: EdgeTransparentImageProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    void removeConnectedEdgeMatte(src)
      .then((url) => {
        objectUrl = url;
        if (disposed) URL.revokeObjectURL(url);
        else setProcessedSrc(url);
      })
      .catch(() => {
        if (!disposed) setProcessedSrc(src);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!processedSrc) return null;

  return (
    <Image
      src={processedSrc}
      alt={alt}
      fill
      unoptimized
      className={className}
      sizes={sizes}
      onLoad={() => markAppReady(readyGate)}
      onError={() => markAppReady(readyGate)}
    />
  );
}
