import { Sandbox } from "@vercel/sandbox";
import type { DiscordRenderRequest } from "./discord-bot-creation";

const MAX_BYTES = 8_000_000;

export async function renderDiscordSandbox(request: DiscordRenderRequest, image: string): Promise<{ bytes: Buffer; preview?: Buffer }> {
  const signal = AbortSignal.timeout(90_000);
  const sandbox = await Sandbox.create({
    image, persistent: false, networkPolicy: "deny-all", resources: { vcpus: 1 },
    timeout: 90_000, region: "iad1", tags: { purpose: "discord-render" }, signal,
  });
  try {
    // Project authentication stays in the caller. No bot/model tokens, ports,
    // drives, source repositories or other participants' files enter the VM.
    const input = JSON.stringify(request.kind === "latex" ? { source: request.source } : request.scene);
    if (Buffer.byteLength(input) > 64_000) throw new Error("Render input is too large");
    await sandbox.writeFiles([{ path: "/tmp/request.json", content: Buffer.from(input), mode: 0o644 }], { signal });
    const result = await sandbox.asUser("renderer").runCommand({
      // Fixed redirection avoids a streamed-stdin close race. User source is
      // file data, never shell text; the only argument is the validated kind.
      cmd: "sh", args: ["-c", 'exec python /app/sandbox_worker.py "$1" < /tmp/request.json', "renderer", request.kind], cwd: "/tmp",
      env: { HOME: "/tmp", XDG_CACHE_HOME: "/tmp/cache", OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
      timeoutMs: 80_000, signal,
    });
    if (result.exitCode !== 0) throw new Error("Renderer could not produce this file");
    let size = 0;
    async function read(path: string) {
      const stream = await sandbox.readFile({ path }, { signal });
      if (!stream) throw new Error("Rendered file is unavailable");
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_BYTES) throw new Error("Rendered files are too large");
        chunks.push(bytes);
      }
      return Buffer.concat(chunks);
    }
    const bytes = await read("/tmp/result.bin");
    if (request.kind !== "latex") return { bytes };
    const converted = await sandbox.asUser("renderer").runCommand({
      cmd: "pdftoppm", args: ["-f", "1", "-l", "1", "-singlefile", "-scale-to", "2048", "-png", "/tmp/result.bin", "/tmp/preview"],
      cwd: "/tmp", timeoutMs: 20_000, signal,
    });
    if (converted.exitCode !== 0) throw new Error("LaTeX preview could not be rendered");
    return { bytes, preview: await read("/tmp/preview.png") };
  } finally {
    // Opting out of persistence discards the filesystem instead of snapshotting
    // user content. The VM deadline also terminates jobs if a caller disappears.
    await sandbox.stop({ signal: AbortSignal.timeout(10_000) }).catch(() => {});
  }
}
