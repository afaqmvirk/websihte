"use client";

export const APP_READY_GATES = ["viewport", "hero-layout"] as const;

export type AppReadyGate = (typeof APP_READY_GATES)[number];

const GATE_FALLBACK_MS = 1200;

const gateState = new Map<AppReadyGate, boolean>();
const gateListeners = new Set<() => void>();
let gateFallbacksScheduled = false;

function notifyGateListeners() {
  if (!APP_READY_GATES.every((name) => gateState.get(name))) return;
  for (const listener of gateListeners) {
    listener();
  }
}

export function markAppReady(gate: AppReadyGate) {
  if (gateState.get(gate)) return;
  gateState.set(gate, true);
  notifyGateListeners();
}

function scheduleGateFallbacks() {
  if (gateFallbacksScheduled) return;
  gateFallbacksScheduled = true;

  for (const gate of APP_READY_GATES) {
    window.setTimeout(() => markAppReady(gate), GATE_FALLBACK_MS);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}

function waitForGates(): Promise<void> {
  if (APP_READY_GATES.every((name) => gateState.get(name))) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const listener = () => {
      if (!APP_READY_GATES.every((name) => gateState.get(name))) return;
      gateListeners.delete(listener);
      resolve();
    };
    gateListeners.add(listener);
  });
}

function waitForDocumentInteractive(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();

  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Brief settle — tolerant of mobile URL-bar resize jitter. */
function waitForStableHeroScene(maxMs = 1200): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let lastWidth = 0;
    let lastHeight = 0;
    let stableFrames = 0;

    const tick = () => {
      if (performance.now() - started > maxMs) {
        resolve();
        return;
      }

      const scene = document.querySelector(
        "[data-hero-scene]",
      ) as HTMLElement | null;
      const rect = scene?.getBoundingClientRect();
      const width = rect?.width ?? 0;
      const height = rect?.height ?? 0;

      if (width > 0 && height > 0) {
        const dw = Math.abs(width - lastWidth);
        const dh = Math.abs(height - lastHeight);
        if (dw < 2 && dh < 2) {
          stableFrames += 1;
          if (stableFrames >= 2) {
            resolve();
            return;
          }
        } else {
          stableFrames = 0;
        }
        lastWidth = width;
        lastHeight = height;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

/** Resolves when fonts, layout gates, and paint are ready — never hangs. */
export async function whenAppReady(): Promise<void> {
  const hardCapMs = isMobileViewport() ? 4500 : 7000;

  scheduleGateFallbacks();

  const ready = (async () => {
    await Promise.all([
      withTimeout(document.fonts?.ready ?? Promise.resolve(), 2000),
      waitForGates(),
      waitForDocumentInteractive(),
    ]);
    await withTimeout(waitForStableHeroScene(), 1200);
    await withTimeout(doubleRaf(), 500);
  })();

  await Promise.race([
    ready.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, hardCapMs)),
  ]);
}
