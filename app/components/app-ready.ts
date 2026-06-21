"use client";

export const APP_READY_GATES = ["viewport", "hero-layout"] as const;

export type AppReadyGate = (typeof APP_READY_GATES)[number];

const gateState = new Map<AppReadyGate, boolean>();
const gateListeners = new Set<() => void>();

export function markAppReady(gate: AppReadyGate) {
  if (gateState.get(gate)) return;
  gateState.set(gate, true);

  if (APP_READY_GATES.every((name) => gateState.get(name))) {
    for (const listener of gateListeners) {
      listener();
    }
  }
}

function allGatesReady() {
  return APP_READY_GATES.every((name) => gateState.get(name));
}

function waitForGates(): Promise<void> {
  if (allGatesReady()) return Promise.resolve();

  return new Promise((resolve) => {
    const listener = () => {
      if (!allGatesReady()) return;
      gateListeners.delete(listener);
      resolve();
    };
    gateListeners.add(listener);
  });
}

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Wait until hero scene dimensions stop changing (layout + fit scale settled). */
function waitForStableHeroScene(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let lastWidth = 0;
    let lastHeight = 0;
    let stableFrames = 0;

    const tick = () => {
      if (performance.now() - started > timeoutMs) {
        resolve();
        return;
      }

      const scene = document.querySelector(
        "[data-hero-scene]",
      ) as HTMLElement | null;
      const rect = scene?.getBoundingClientRect();
      const width = rect?.width ?? 0;
      const height = rect?.height ?? 0;

      if (
        width > 0 &&
        height > 0 &&
        Math.abs(width - lastWidth) < 0.5 &&
        Math.abs(height - lastHeight) < 0.5
      ) {
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
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

/** Resolves when fonts, layout gates, images, and paint are ready. */
export async function whenAppReady(timeoutMs = 10000): Promise<void> {
  const ready = Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    waitForGates(),
    waitForWindowLoad(),
  ]).then(async () => {
    await waitForStableHeroScene();
    await doubleRaf();
  });

  await Promise.race([
    ready,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}
