import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Readable } from "node:stream";
import { Sandbox } from "@vercel/sandbox";
import { renderDiscordSandbox } from "./discord-renderer-sandbox";

const create = Sandbox.create;
const image = `discord-renderer@sha256:${"a".repeat(64)}`;
const source = "\\documentclass{article}\\begin{document}$E=mc^2$\\end{document}";
let options: unknown;
let inputs: { path: string; content: Buffer; mode: number }[];
let command: Record<string, unknown> | undefined;
let commands: Record<string, unknown>[];
let username: string | undefined;
let stops = 0, exitCode = 0, previewExitCode = 0;
let stream: (path: string) => Readable | null;

beforeEach(() => {
  options = command = username = undefined;
  stops = exitCode = previewExitCode = 0;
  commands = [];
  inputs = [];
  stream = (path) => Readable.from([path.endsWith(".png") ? Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) : Buffer.from("%PDF-1.7\nexample")]);
  Sandbox.create = (async (value) => {
    options = value;
    return {
      writeFiles: async (files: typeof inputs) => { inputs = files; },
      asUser: (user: string) => {
        username = user;
        return { runCommand: async (value: Record<string, unknown>) => {
          command ??= value; commands.push(value);
          return { exitCode: value.cmd === "pdftoppm" ? previewExitCode : exitCode };
        } };
      },
      readFile: async (file: { path: string }) => { assert.ok(["/tmp/result.bin", "/tmp/preview.png"].includes(file.path)); return stream(file.path); },
      stop: async () => { stops++; },
    } as unknown as Sandbox;
  }) as typeof Sandbox.create;
});
afterEach(() => { Sandbox.create = create; });

describe("Vercel Discord renderer isolation", () => {
  it("uses a fresh networkless VM and unprivileged fixed worker without passing production secrets", async () => {
    const result = await renderDiscordSandbox({ kind: "latex", source }, image);
    assert.ok(result.bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
    assert.ok(result.preview?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    const { signal, ...settings } = options as Record<string, unknown>;
    assert.ok(signal instanceof AbortSignal);
    assert.deepEqual(settings, {
      image, persistent: false, networkPolicy: "deny-all", resources: { vcpus: 1 },
      timeout: 90_000, region: "iad1", tags: { purpose: "discord-render" },
    });
    assert.equal(username, "renderer");
    assert.ok(command);
    assert.equal(command.cmd, "sh");
    assert.deepEqual(command.args, ["-c", 'exec python /app/sandbox_worker.py "$1" < /tmp/request.json', "renderer", "latex"]);
    assert.equal(command.cwd, "/tmp");
    assert.equal(command.timeoutMs, 80_000);
    assert.deepEqual(command.env, { HOME: "/tmp", XDG_CACHE_HOME: "/tmp/cache", OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" });
    assert.equal(command.stdin, undefined);
    assert.equal(inputs.length, 1);
    assert.equal(inputs[0].path, "/tmp/request.json");
    assert.equal(inputs[0].mode, 0o644);
    assert.deepEqual(JSON.parse(inputs[0].content.toString()), { source });
    assert.deepEqual(commands[1].args, ["-f", "1", "-l", "1", "-singlefile", "-scale-to", "2048", "-png", "/tmp/result.bin", "/tmp/preview"]);
    assert.equal(commands[1].timeoutMs, 20_000);
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
    stream = () => Readable.from([Buffer.from("%PDF-1.7\nexample")]);
    previewExitCode = 1;
    await assert.rejects(renderDiscordSandbox({ kind: "latex", source }, image));
    assert.equal(stops, 5);
  });
});
