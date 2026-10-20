import type { DiscordAiBotPersona } from "./discord-bot-knowledge";
import { DOMParser } from "@xmldom/xmldom";
import { renderDiscordSandbox } from "./discord-renderer-sandbox";

export type DiscordFile = { bytes: Uint8Array; filename: string; contentType: string };
export type DiscordRenderedFile = DiscordFile & { preview?: DiscordFile };
export type ManimObject = {
  id: string; kind: string; text: string | null; color: string; x: number; y: number; scale: number;
};
export type ManimStep = {
  action: string; target: string | null; x: number | null; y: number | null; angle: number | null; seconds: number;
};
export type ManimScene = { objects: ManimObject[]; steps: ManimStep[] };
export type DiscordRenderRequest = { kind: "latex"; source: string } | { kind: "manim"; scene: ManimScene };
const MAX_SOURCE_BYTES = 24_000;
const MAX_RENDER_BYTES = 8_000_000;
const KINDS = ["text", "circle", "square", "triangle", "arrow", "dot"];
const COLORS = ["white", "red", "orange", "yellow", "green", "blue", "purple", "pink"];
const ACTIONS = ["show", "hide", "move", "rotate", "indicate", "wait"];
const caption = { type: ["string", "null"], description: "Optional brief spoken caption in your own voice." };
const source = { type: "string", minLength: 1, maxLength: MAX_SOURCE_BYTES, description: "Complete source with exact syntax, no markdown fences." };
const nullableNumber = { type: ["number", "null"] };
export const MANIM_SCENE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    objects: { type: "array", minItems: 1, maxItems: 12, items: {
      type: "object", additionalProperties: false,
      properties: {
        id: { type: "string", pattern: "^[a-z][a-z0-9_]{0,23}$" },
        kind: { type: "string", enum: KINDS }, text: { type: ["string", "null"], maxLength: 120 },
        color: { type: "string", enum: COLORS }, x: { type: "number", minimum: -6, maximum: 6 },
        y: { type: "number", minimum: -3, maximum: 3 }, scale: { type: "number", minimum: 0.25, maximum: 2 },
      }, required: ["id", "kind", "text", "color", "x", "y", "scale"],
    } },
    steps: { type: "array", minItems: 1, maxItems: 16, items: {
      type: "object", additionalProperties: false,
      properties: {
        action: { type: "string", enum: ACTIONS }, target: { type: ["string", "null"] },
        x: { ...nullableNumber, minimum: -6, maximum: 6 }, y: { ...nullableNumber, minimum: -3, maximum: 3 },
        angle: { ...nullableNumber, minimum: -360, maximum: 360, description: "Rotation in degrees." },
        seconds: { type: "number", minimum: 0.25, maximum: 3 },
      }, required: ["action", "target", "x", "y", "angle", "seconds"],
    } },
  }, required: ["objects", "steps"],
};

export function isDiscordCreator(persona?: DiscordAiBotPersona) {
  return persona === "sand" || persona === "plank";
}

export function getDiscordCreationTools(rendererAvailable: boolean) {
  return [{ type: "function", function: {
    name: "create_source_file", strict: true,
    description: "Send a requested SVG or LaTeX source file as a real attachment. Only on the current human's explicit request. SVGs need the http://www.w3.org/2000/svg namespace and presentation attributes such as fill/stroke rather than style attributes or style elements. Use basic shapes, paths, text, groups and gradients; references must be local #ids. No scripts, foreign content or external resources. Use render_latex instead when a rendered PDF is wanted. Never include credentials or collectors.",
    parameters: { type: "object", additionalProperties: false, properties: {
      format: { type: "string", enum: ["svg", "latex"] }, source, reply: caption,
    }, required: ["format", "source", "reply"] },
  } }, ...(rendererAvailable ? [{ type: "function", function: {
    name: "render_latex", strict: true,
    description: `Compile a requested complete standalone LaTeX document and send ${getDiscordRendererConfig()?.backend === "sandbox" ? "an inline PNG preview of its first page, the complete rendered PDF, and the .tex source" : "its rendered PDF plus .tex source"}. Use this for LaTeX-as-an-image requests. Only for an explicit current human request. No shell escape, external files or network resources. Up to 6 pages.`,
    parameters: { type: "object", additionalProperties: false, properties: { source, reply: caption }, required: ["source", "reply"] },
  } }, { type: "function", function: {
    name: "render_manim", strict: true,
    description: "Render a requested short Manim scene as a playable 854x480 24fps MP4. Only for an explicit current human request. Use up to 12 fixed shapes/plain text labels, 16 steps and 15 seconds total. Objects begin hidden; show before animating. Move uses absolute x/y; rotate uses degrees. Set unused target/x/y/angle fields to null. No Python, expressions, URLs, imports or code execution.",
    parameters: { type: "object", additionalProperties: false, properties: { scene: MANIM_SCENE_SCHEMA, reply: caption }, required: ["scene", "reply"] },
  } }] : [])];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const number = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const includes = (choices: string[], value: unknown): value is string => typeof value === "string" && choices.includes(value);
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SVG_ELEMENTS = new Set("svg g defs rect circle ellipse line polyline polygon path text tspan title desc linearGradient radialGradient stop clipPath mask pattern use symbol".split(" "));
const SVG_ATTRIBUTES = new Set(("xmlns xmlns:xlink viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-opacity opacity transform id font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing dx dy offset stop-color stop-opacity gradientUnits gradientTransform clip-path clipPathUnits mask maskUnits patternUnits patternTransform patternContentUnits preserveAspectRatio href xlink:href role aria-label").split(" "));

function validateStaticSvg(source: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("SVG declarations are unavailable");
  if (source.replace(/^\s*<\?xml\s[^?]*\?>/, "").includes("<?")) throw new Error("SVG processing instructions are unavailable");
  const document = new DOMParser({ onError: () => { throw new Error("Invalid SVG syntax"); } }).parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) throw new Error("An SVG document is required");
  const elements = document.getElementsByTagName("*");
  if (elements.length > 512) throw new Error("SVG is too complex");
  for (let i = 0; i < document.childNodes.length; i++) {
    const node = document.childNodes.item(i)!;
    if (node.nodeType === 7 && node.nodeName !== "xml") throw new Error("SVG processing instructions are unavailable");
  }
  for (let i = 0; i < elements.length; i++) {
    const element = elements.item(i)!;
    if (element.namespaceURI !== SVG_NAMESPACE || !SVG_ELEMENTS.has(element.localName ?? "")) throw new Error("Unsupported SVG element");
    for (let j = 0; j < element.attributes.length; j++) {
      const attribute = element.attributes.item(j)!;
      if (!SVG_ATTRIBUTES.has(attribute.name) || /[\\\x00-\x1f]/.test(attribute.value)) throw new Error("Unsupported SVG attribute");
      if (["href", "xlink:href"].includes(attribute.name) && !/^#[a-z_][\w.-]*$/i.test(attribute.value)) throw new Error("External SVG references are unavailable");
      if (/url\s*\(/i.test(attribute.value) && !/^url\(#[a-z_][\w.-]*\)$/i.test(attribute.value)) throw new Error("External SVG resources are unavailable");
    }
  }
}

export function validateManimScene(value: unknown): ManimScene {
  if (!record(value) || !keys(value, ["objects", "steps"]) || !Array.isArray(value.objects) || !Array.isArray(value.steps)
    || value.objects.length < 1 || value.objects.length > 12 || value.steps.length < 1 || value.steps.length > 16) throw new Error("Invalid Manim scene");
  const ids = new Set<string>(), visible = new Set<string>();
  for (const item of value.objects) {
    if (!record(item) || !keys(item, ["id", "kind", "text", "color", "x", "y", "scale"])
      || typeof item.id !== "string" || !/^[a-z][a-z0-9_]{0,23}$/.test(item.id) || ids.has(item.id)
      || !includes(KINDS, item.kind) || !includes(COLORS, item.color)
      || (item.kind === "text" ? typeof item.text !== "string" || !item.text.trim() || item.text.length > 120 : item.text !== null)
      || !number(item.x, -6, 6) || !number(item.y, -3, 3) || !number(item.scale, 0.25, 2)) throw new Error("Invalid Manim object");
    ids.add(item.id);
  }
  let duration = 0, shown = false;
  for (const step of value.steps) {
    if (!record(step) || !keys(step, ["action", "target", "x", "y", "angle", "seconds"])
      || !includes(ACTIONS, step.action) || !number(step.seconds, 0.25, 3)) throw new Error("Invalid Manim step");
    duration += step.seconds;
    if (duration > 15) throw new Error("Animation is too long");
    if (step.action === "wait") {
      if (step.target !== null) throw new Error("Wait cannot target an object");
    } else {
      if (typeof step.target !== "string" || !ids.has(step.target)) throw new Error("Unknown Manim target");
      if (step.action === "show") {
        if (visible.has(step.target)) throw new Error("Object is already visible");
        visible.add(step.target); shown = true;
      } else if (!visible.has(step.target)) throw new Error("Show the object first");
      if (step.action === "hide") visible.delete(step.target);
    }
    if (step.action === "move" ? !number(step.x, -6, 6) || !number(step.y, -3, 3) : step.x !== null || step.y !== null) throw new Error("Invalid movement");
    if (step.action === "rotate" ? !number(step.angle, -360, 360) : step.angle !== null) throw new Error("Invalid rotation");
  }
  if (!shown) throw new Error("Animation has no visible objects");
  return value as ManimScene;
}

export function createDiscordSourceFile(format: unknown, value: unknown): DiscordFile {
  if (!includes(["svg", "latex"], format) || typeof value !== "string" || !value.trim()
    || Buffer.byteLength(value, "utf8") > MAX_SOURCE_BYTES || value.includes("\0") || /^\s*```/.test(value)) throw new Error("Invalid source file");
  if (format === "svg") validateStaticSvg(value);
  return { bytes: Buffer.from(value, "utf8"), filename: format === "svg" ? "overlord-drawing.svg" : "overlord-document.tex", contentType: format === "svg" ? "image/svg+xml" : "application/x-tex" };
}

export function parseDiscordCreation(name: string, value: unknown, rendererAvailable: boolean): { text: string; files?: DiscordFile[]; render?: DiscordRenderRequest } {
  if (!record(value) || (value.reply !== null && typeof value.reply !== "string")) throw new Error("Invalid creation request");
  const text = typeof value.reply === "string" ? value.reply : "";
  if (name === "create_source_file" && keys(value, ["format", "source", "reply"])) return { text, files: [createDiscordSourceFile(value.format, value.source)] };
  if (rendererAvailable && name === "render_latex" && keys(value, ["source", "reply"])) {
    const file = createDiscordSourceFile("latex", value.source);
    const latex = Buffer.from(file.bytes).toString("utf8");
    if (!/\\documentclass(?:\[[^\]]*\])?\{[a-z]+\}/i.test(latex) || !latex.includes("\\begin{document}") || !latex.includes("\\end{document}")) throw new Error("A standalone LaTeX document is required");
    return { text, files: [file], render: { kind: "latex", source: latex } };
  }
  if (rendererAvailable && name === "render_manim" && keys(value, ["scene", "reply"])) return { text, render: { kind: "manim", scene: validateManimScene(value.scene) } };
  throw new Error("Unknown creation request");
}

export function getDiscordRendererConfig() {
  const token = process.env.DISCORD_RENDERER_TOKEN?.trim();
  const dailyLimit = Number(process.env.DISCORD_BOT_RENDER_DAILY_LIMIT || 25);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) return null;
  const image = process.env.DISCORD_RENDERER_IMAGE?.trim();
  if (image) {
    // Only immutable images in this Vercel project's private registry qualify.
    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/.test(image)) return null;
    return { backend: "sandbox" as const, image, dailyLimit };
  }
  try {
    const url = new URL(process.env.DISCORD_RENDERER_URL || "");
    if (!token || token.length < 32 || /\s/.test(token)
      || url.username || url.password || url.search || url.hash
      || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    return { backend: "http" as const, url: url.href.replace(/\/$/, ""), token, dailyLimit };
  } catch { return null; }
}

export async function renderDiscordFile(request: DiscordRenderRequest): Promise<DiscordRenderedFile> {
  const config = getDiscordRendererConfig();
  if (!config) throw new Error("Renderer is unavailable");
  const contentType = request.kind === "latex" ? "application/pdf" : "video/mp4";
  let bytes: Buffer;
  let preview: DiscordFile | undefined;
  if (config.backend === "sandbox") {
    const rendered = await renderDiscordSandbox(request, config.image);
    bytes = rendered.bytes;
    if (rendered.preview) {
      if (!rendered.preview.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Invalid LaTeX preview");
      preview = { bytes: rendered.preview, contentType: "image/png", filename: "overlord-document.png" };
    }
  } else {
    const response = await fetch(`${config.url}/render/${request.kind}`, {
      method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(request.kind === "latex" ? { source: request.source } : request.scene),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== contentType || !response.body
      || Number(response.headers.get("content-length")) > MAX_RENDER_BYTES) throw new Error("Renderer could not produce this file");
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_RENDER_BYTES) throw new Error("Rendered file is too large");
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    bytes = Buffer.concat(chunks);
  }
  if (bytes.length > MAX_RENDER_BYTES) throw new Error("Rendered file is too large");
  if (request.kind === "latex" ? !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
    : bytes.length < 12 || !bytes.subarray(4, 8).equals(Buffer.from("ftyp"))) throw new Error("Invalid rendered file");
  return { bytes, contentType, filename: request.kind === "latex" ? "overlord-document.pdf" : "overlord-animation.mp4", ...(preview ? { preview } : {}) };
}
