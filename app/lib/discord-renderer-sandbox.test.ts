import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Readable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { renderDiscordSandbox } from "./discord-renderer-sandbox";

const create = Sandbox.create;
const image = `discord-renderer@sha256:${"a".repeat(64)}`;
const source = "\\documentclass{article}\\begin{document}$E=mc^2$\\end{document}";
let options: unknown;
let command: Record<string, unknown> | undefined;
let username: string | undefined;
let stops = 0, exitCode = 0;
let stream: () => Readable | null;

beforeEach(() => {
  options = command = username = undefined;
  stops = exitCode = 0;
  stream = () => Readable.from([Buffer.from("%PDF-1.7\nexample")]);
  Sandbox.create = (async (value) => {
    options = value;
    return {
      asUser: (user: string) => {
        username = user;
        return { runCommand: async (value: Record<string, unknown>) => { command = value; return { exitCode }; } };
      },
      readFile: async (file: unknown) => { assert.deepEqual(file, { path: "/tmp/result.bin" }); return stream(); },
      stop: async () => { stops++; },
    } as unknown as Sandbox;
  }) as typeof Sandbox.create;
});
afterEach(() => { Sandbox.create = create; });

describe("Vercel Discord renderer isolation", () => {
  it("uses a fresh networkless VM and unprivileged fixed worker without passing production secrets", async () => {
    const result = await renderDiscordSandbox({ kind: "latex", source }, image);
    assert.ok(result.subarray(0, 5).equals(Buffer.from("%PDF-")));
    const { signal, ...settings } = options as Record<string, unknown>;
    assert.ok(signal instanceof AbortSignal);
    assert.deepEqual(settings, {
      image, persistent: false, networkPolicy: "deny-all", resources: { vcpus: 1 },
      timeout: 90_000, region: "iad1", tags: { purpose: "discord-render" },
    });
    assert.equal(username, "renderer");
    assert.ok(command);
    assert.equal(command.cmd, "python");
    assert.deepEqual(command.args, ["/app/sandbox_worker.py", "latex"]);
    assert.equal(command.cwd, "/tmp");
    assert.equal(command.timeoutMs, 80_000);
    assert.deepEqual(command.env, { HOME: "/tmp", XDG_CACHE_HOME: "/tmp/cache", OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" });
    assert.ok(command.stdin instanceof Readable);
    const parts = [];
    for await (const part of command.stdin) parts.push(part);
    assert.deepEqual(JSON.parse(parts.join("")), { source });
    assert.equal(stops, 1);
  });
  it("discards the sandbox after worker failure, missing output, oversized output and a failed download", async () => {
    exitCode = 1;
    await assert.rejects(renderDiscordSandbox({ kind: "latex", source }, image));
    assert.equal(stops, 1);
    exitCode = 0;
    stream = () => null;
    await assert.rejects(renderDiscordSandbox({ kind: "latex", source }, image));
    assert.equal(stops, 2);
    stream = () => Readable.from([Buffer.alloc(8_000_001)]);
    await assert.rejects(renderDiscordSandbox({ kind: "latex", source }, image));
    assert.equal(stops, 3);
    stream = () => Readable.from((async function* () { throw new Error("Download failed"); })());
    await assert.rejects(renderDiscordSandbox({ kind: "latex", source }, image));
    assert.equal(stops, 4);
  });
});
