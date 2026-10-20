import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createDiscordSourceFile, getDiscordRendererConfig, parseDiscordCreation, renderDiscordFile, validateManimScene, type ManimScene } from "./discord-bot-creation";

const scene: ManimScene = {
  objects: [{ id: "ball", kind: "circle", text: null, color: "red", x: 0, y: 0, scale: 1 }],
  steps: [{ action: "show", target: "ball", x: null, y: null, angle: null, seconds: 1 }],
};
const originalFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of ["DISCORD_RENDERER_IMAGE", "DISCORD_RENDERER_URL", "DISCORD_RENDERER_TOKEN", "DISCORD_BOT_RENDER_DAILY_LIMIT"]) {
    if (env[name] === undefined) delete process.env[name]; else process.env[name] = env[name];
  }
});

describe("Discord file and render protocol", () => {
  it("accepts only immutable project-local sandbox images and keeps render limits", () => {
    const image = `discord-renderer@sha256:${"a".repeat(64)}`;
    process.env.DISCORD_RENDERER_IMAGE = image;
    assert.deepEqual(getDiscordRendererConfig(), { backend: "sandbox", image, dailyLimit: 25 });
    for (const value of ["discord-renderer:latest", "https://outside.example/image", `other-team/project/${image}`, "discord-renderer@sha256:short"]) {
      process.env.DISCORD_RENDERER_IMAGE = value;
      assert.equal(getDiscordRendererConfig(), null);
    }
    process.env.DISCORD_RENDERER_IMAGE = image;
    process.env.DISCORD_BOT_RENDER_DAILY_LIMIT = "101";
    assert.equal(getDiscordRendererConfig(), null);
  });
  it("rejects generated execution capabilities, unknown fields, bad references and oversized scenes", () => {
    assert.deepEqual(validateManimScene(scene), scene);
    for (const change of [
      { ...scene, python: "import os" },
      { ...scene, objects: [{ ...scene.objects[0], kind: "python" }] },
      { ...scene, objects: [...scene.objects, scene.objects[0]] },
      { ...scene, steps: [{ ...scene.steps[0], target: "invented" }] },
      { ...scene, steps: [{ ...scene.steps[0], action: "move", x: 1, y: 1 }] },
      { ...scene, steps: [{ ...scene.steps[0], x: 1 }] },
      { ...scene, steps: [{ ...scene.steps[0], seconds: Infinity }] },
      { ...scene, steps: [scene.steps[0], ...Array(6).fill({ action: "wait", target: null, x: null, y: null, angle: null, seconds: 3 })] },
    ]) assert.throws(() => validateManimScene(change));
    assert.throws(() => parseDiscordCreation("render_manim", { scene, reply: null }, false));
    assert.throws(() => parseDiscordCreation("create_source_file", { format: "python", source: "import os", reply: null }, true));
  });
  it("keeps source exact and rejects active, external or oversized SVG output", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="20" fill="Blue"/></svg>';
    assert.equal(Buffer.from(createDiscordSourceFile("svg", svg).bytes).toString(), svg);
    for (const source of ["```svg\n" + svg, "x".repeat(24_001), '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>', '<svg><image href="https://example.com"/></svg>',
      '<!DOCTYPE svg><svg></svg>', '<svg><foreignObject/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="u&#114;l(https://example.com)"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill: red"/></svg>',
      '<?xml-stylesheet href="https://example.com"?><svg xmlns="http://www.w3.org/2000/svg"/>',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>']) assert.throws(() => createDiscordSourceFile("svg", source));
    assert.throws(() => parseDiscordCreation("render_latex", { source: "just some text", reply: null }, true));
  });
  it("hides the renderer for missing authentication, unsafe URLs or invalid limits", () => {
    process.env.DISCORD_RENDERER_URL = "https://renderer.example";
    delete process.env.DISCORD_RENDERER_TOKEN;
    assert.equal(getDiscordRendererConfig(), null);
    process.env.DISCORD_RENDERER_TOKEN = "a".repeat(40);
    assert.ok(getDiscordRendererConfig());
    for (const url of ["http://remote.example", "https://user:password@remote.example", "https://remote.example/?secret=x", "file:///tmp/result"]) {
      process.env.DISCORD_RENDERER_URL = url; assert.equal(getDiscordRendererConfig(), null);
    }
    process.env.DISCORD_RENDERER_URL = "https://renderer.example";
    process.env.DISCORD_BOT_RENDER_DAILY_LIMIT = "101";
    assert.equal(getDiscordRendererConfig(), null);
  });
  it("rejects invalid MIME, file signatures, redirects and oversized renderer responses", async () => {
    Object.assign(process.env, { DISCORD_RENDERER_URL: "https://renderer.example", DISCORD_RENDERER_TOKEN: "a".repeat(40), DISCORD_BOT_RENDER_DAILY_LIMIT: "25" });
    for (const response of [
      new Response("<html>failure</html>", { headers: { "Content-Type": "text/html" } }),
      new Response("invalid", { headers: { "Content-Type": "application/pdf" } }),
      new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf", "Content-Length": "8000001" } }),
      new Response(null, { status: 302, headers: { Location: "https://elsewhere.example" } }),
      new Response(new Uint8Array(8_000_001), { headers: { "Content-Type": "application/pdf" } }),
    ]) {
      globalThis.fetch = async (_input, init) => { assert.equal(init?.redirect, "error"); return response; };
      await assert.rejects(renderDiscordFile({ kind: "latex", source: "unused" }));
    }
  });
});
