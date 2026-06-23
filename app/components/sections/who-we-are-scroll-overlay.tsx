"use client";

import { useEffect, useRef } from "react";

const PAPER_WHITE = "#ffffff";
/** Same paper grain as the hero image, multiplied over the white sheet. */
const PAPER_TEXTURE = 'url("/Texturelabs_Paper_312XL%201.png")';
/** Section top must rise to this viewport fraction before the curl begins (0–1).
 *  Lower = kicks in later (the section has to scroll further up first). */
const ROTATION_START_VIEWPORT_RATIO = 0.4;
/** Scroll distance (as a fraction of viewport height) the tear plays out over.
 *  Larger = slower tear. */
const CURL_SCROLL_SPAN_RATIO = 0.85;
/** Curl progress at which the peel rotation begins (it stays flat until then). */
const ROTATION_START_PROGRESS = 0.42;

/** Portion of the sheet that rolls into the curl, as a fraction of width.
 *  1 = the whole page curls (no flat remainder). */
const CURL_REGION_FRACTION = 1;
/** Number of vertical strips the curl is wrapped from (more = smoother cylinder,
 *  fewer = visible facet bands). */
const N_STRIPS = 30;
/** Per-strip rotation at full progress; N_STRIPS * this is the total wrap angle.
 *  Negative so the page rolls under/away rather than toward the viewer. */
const DT_MAX_DEG = -6;
/** Peel rotation about the top-right corner that carries the whole sheet off, so
 *  the curl extends all the way and the section fully clears (degrees). */
const ROTATION_MAX_DEG = -92;

/** Ragged top-edge tile (px). The torn edge repeats horizontally across the sheet. */
const TORN_TILE_W = 168;
const TORN_TILE_H = 46;
/** Below this y the tile is fully solid, so the body fill can safely overlap it. */
const TORN_SOLID_FROM = 32;

/** The tear line P, shared by the curl's torn top and the fixed stub's torn bottom. */
const TEAR_LINE =
  "M0,20 L11,27 L23,13 L34,29 L46,17 L59,31 L72,15 L86,28 L99,12 L113,30 L126,16 L139,31 L151,14 L168,20";

// Curl top: white BELOW the tear line.
const tornTileSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TORN_TILE_W}' height='${TORN_TILE_H}' viewBox='0 0 ${TORN_TILE_W} ${TORN_TILE_H}'><path d='${TEAR_LINE} L168,46 L0,46 Z' fill='white'/></svg>`;
const TORN_MASK = `url("data:image/svg+xml,${encodeURIComponent(tornTileSvg)}")`;

// Stub bottom: white ABOVE the same tear line (the exact complement), so the two
// edges interlock into one torn seam.
const tornComplementSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TORN_TILE_W}' height='${TORN_TILE_H}' viewBox='0 0 ${TORN_TILE_W} ${TORN_TILE_H}'><path d='M0,0 L168,0 L168,20 L151,14 L139,31 L126,16 L113,30 L99,12 L86,28 L72,15 L59,31 L46,17 L34,29 L23,13 L11,27 L0,20 Z' fill='white'/></svg>`;
const TORN_COMPLEMENT_MASK = `url("data:image/svg+xml,${encodeURIComponent(tornComplementSvg)}")`;

/** Mask for the fixed stub: solid body up top, torn (white-above-tear) at the bottom. */
const stubTornStyle = {
  maskImage: `${TORN_COMPLEMENT_MASK}, linear-gradient(#000, #000)`,
  WebkitMaskImage: `${TORN_COMPLEMENT_MASK}, linear-gradient(#000, #000)`,
  maskRepeat: "repeat-x, no-repeat",
  WebkitMaskRepeat: "repeat-x, no-repeat",
  maskSize: `${TORN_TILE_W}px ${TORN_TILE_H}px, 100% calc(100% - ${TORN_TILE_H}px)`,
  WebkitMaskSize: `${TORN_TILE_W}px ${TORN_TILE_H}px, 100% calc(100% - ${TORN_TILE_H}px)`,
  maskPosition: "left bottom, left top",
  WebkitMaskPosition: "left bottom, left top",
  maskComposite: "add",
  WebkitMaskComposite: "source-over",
} as React.CSSProperties;

/**
 * Two mask layers — the ragged top tile plus a solid body that overlaps below it.
 * `offsetX` phases the torn tile so the teeth stay continuous across the strips.
 */
function tornMask(offsetX: string): React.CSSProperties {
  const layers = `${TORN_MASK}, linear-gradient(#000, #000)`;
  const size = `${TORN_TILE_W}px ${TORN_TILE_H}px, 100% calc(100% - ${TORN_SOLID_FROM}px)`;
  const position = `${offsetX} top, left bottom`;
  return {
    maskImage: layers,
    WebkitMaskImage: layers,
    maskRepeat: "repeat-x, no-repeat",
    WebkitMaskRepeat: "repeat-x, no-repeat",
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
    maskComposite: "add",
    WebkitMaskComposite: "source-over",
  } as React.CSSProperties;
}

/**
 * One slice of the curling page. Strips nest from the curl boundary (i=0, hinged
 * to the flat page) outward to the free left edge (i=N-1). Each strip adds another
 * `--dt` of rotation about its right edge, so the stack wraps into a cylinder.
 */
function CurlStrip({ i }: { i: number }) {
  // Shade is sampled at each strip's two edges (u=0 at the boundary, u=1 at the
  // free edge) and applied as a horizontal gradient, so brightness stays
  // continuous across the seams — no facet banding / Mach bands.
  const shadeAt = (u: number) => (Math.pow(u, 1.3) * 0.4).toFixed(4);
  const hiAt = (u: number) =>
    (Math.exp(-Math.pow((u - 0.5) / 0.28, 2)) * 0.2).toFixed(4);
  const uL = (i + 1) / N_STRIPS; // free-edge side of this strip (more curled)
  const uR = i / N_STRIPS; // boundary side of this strip (flatter)

  return (
    <div
      className="absolute top-0 h-full"
      style={
        {
          // Right edge sits 0.6px inside the parent so neighbours overlap and
          // there are no subpixel gaps; the leftward step stays exactly --seg.
          right: "calc(100% - 0.6px)",
          width: "calc(var(--seg) + 0.6px)",
          transformOrigin: "right center",
          transform: "rotateY(calc(var(--dt) * 1deg))",
          transformStyle: "preserve-3d",
          ["--i"]: i,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: PAPER_WHITE,
          // Shading gradients over the paper grain (texture multiplied onto white).
          // The texture spans the full sheet width and is offset to this strip's
          // global position, so the grain is continuous across the strips.
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,calc(${hiAt(uL)} * var(--p))), rgba(255,255,255,calc(${hiAt(uR)} * var(--p)))), linear-gradient(to right, rgba(12,18,32,calc(${shadeAt(uL)} * var(--p))), rgba(12,18,32,calc(${shadeAt(uR)} * var(--p)))), ${PAPER_TEXTURE}`,
          backgroundBlendMode: "normal, normal, multiply",
          backgroundRepeat: "no-repeat, no-repeat, no-repeat",
          backgroundSize: "100% 100%, 100% 100%, var(--cmax) 100%",
          backgroundPosition:
            "0 0, 0 0, calc((var(--i) + 1) * var(--seg) - var(--cmax)) 0",
          // Global tile phase (anchored to x=0) so the torn top is one clean,
          // repeating tile — letting the fixed stub's complement line up exactly.
          ...tornMask("calc((var(--i) + 1) * var(--seg) - var(--cmax))"),
        }}
      />
      {i < N_STRIPS - 1 ? <CurlStrip i={i + 1} /> : null}
    </div>
  );
}

function progressForSection(section: HTMLElement) {
  const rect = section.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const start = viewportHeight * ROTATION_START_VIEWPORT_RATIO;
  const span = viewportHeight * CURL_SCROLL_SPAN_RATIO;

  // 0 once the section top passes the start line, then ramps to 1 over `span`.
  return Math.min(1, Math.max(0, (start - rect.top) / span));
}

export default function WhoWeAreScrollOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stubRef = useRef<HTMLDivElement>(null);
  // Highest curl progress reached — the sheet only ever tears further forward.
  const maxProgressRef = useRef(0);

  useEffect(() => {
    const overlay = overlayRef.current;
    const stub = stubRef.current;
    const doc = overlay?.ownerDocument;
    const section = doc?.getElementById("who-we-are");
    const darkSections = overlay?.parentElement ?? null;
    if (!overlay || !section) return;

    const heroEl = doc?.querySelector<HTMLElement>("[data-hero-scene]") ?? null;

    // The stub fills the gap from the hero's bottom down to the tear line. That
    // gap is fixed in layout (scroll-invariant), so this only runs on mount and
    // resize — never on scroll. Both overlay and stub are absolutely positioned
    // inside #dark-sections, so they scroll natively with the content (no lag).
    const layoutStub = () => {
      if (!stub) return;
      const darkTop = (darkSections ?? section).getBoundingClientRect().top;
      const heroBottom = heroEl
        ? heroEl.getBoundingClientRect().bottom
        : darkTop;
      // -4px reaches slightly into the hero; +2px overlaps the curl's white
      // across the tear so the sub-pixel seam never shows as a black line.
      const top = -Math.max(0, darkTop - heroBottom) - 4;
      stub.style.top = `${top}px`;
      stub.style.height = `${TORN_TILE_H + 2 - top}px`;
    };

    let raf = 0;
    const updateCurl = () => {
      raf = 0;

      const raw = progressForSection(section);
      const progress = Math.max(maxProgressRef.current, raw);
      maxProgressRef.current = progress;

      const region = overlay.offsetWidth * CURL_REGION_FRACTION;

      // The left edge curls into a cylinder; the peel rotation about the top-right
      // corner holds off until the curl has led, then eases in (smootherstep) over
      // the remaining scroll so it ramps smoothly rather than linearly.
      const rotT = Math.max(
        0,
        (progress - ROTATION_START_PROGRESS) / (1 - ROTATION_START_PROGRESS),
      );
      const eased = rotT * rotT * rotT * (rotT * (rotT * 6 - 15) + 10);
      overlay.style.transform = `rotate3d(0, 0, 1, ${eased * ROTATION_MAX_DEG}deg)`;
      overlay.style.setProperty("--p", String(progress));
      overlay.style.setProperty("--dt", String(progress * DT_MAX_DEG));
      overlay.style.setProperty("--cmax", `${region}px`);
      overlay.style.setProperty("--seg", `${region / N_STRIPS}px`);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateCurl);
    };
    const onResize = () => {
      layoutStub();
      if (!raf) raf = requestAnimationFrame(updateCurl);
    };

    layoutStub();
    updateCurl();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Fixed white piece that closes the gap to the hero; its torn bottom edge
          matches the curl's torn top, so a clean tear remains as the curl peels. */}
      <div
        ref={stubRef}
        className="pointer-events-none absolute left-0 right-0 z-[24]"
        style={{
          backgroundColor: PAPER_WHITE,
          backgroundImage: PAPER_TEXTURE,
          backgroundBlendMode: "multiply",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 100%",
          ...stubTornStyle,
        }}
        aria-hidden
      />

      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[25]"
      style={
        {
          transformOrigin: "top right",
          transformStyle: "preserve-3d",
          perspective: "1600px",
          willChange: "transform",
          ["--p"]: "0",
          ["--dt"]: "0",
          ["--cmax"]: "0px",
          ["--seg"]: "0px",
        } as React.CSSProperties
      }
      aria-hidden
    >
      {/* The curl: nested strips wrapping the whole page into a cylinder. */}
      <div
        className="absolute top-0 h-full"
        style={
          { left: "var(--cmax)", width: 0, transformStyle: "preserve-3d" } as React.CSSProperties
        }
      >
        <CurlStrip i={0} />
      </div>
      </div>
    </>
  );
}
