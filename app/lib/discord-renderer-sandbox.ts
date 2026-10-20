import { Sandbox } from "@vercel/sandbox";
import { Readable } from "node:stream";
import type { DiscordRenderRequest } from "./discord-bot-creation";

const MAX_BYTES = 8_000_000;

export async function renderDiscordSandbox(request: DiscordRenderRequest, image: string): Promise<Buffer> {
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
    const result = await sandbox.asUser("renderer").runCommand({
      cmd: "python", args: ["/app/sandbox_worker.py", request.kind], cwd: "/tmp",
      env: { HOME: "/tmp", XDG_CACHE_HOME: "/tmp/cache", OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
      stdin: Readable.from([input]), timeoutMs: 80_000, signal,
    });
    if (result.exitCode !== 0) throw new Error("Renderer could not produce this file");
    const stream = await sandbox.readFile({ path: "/tmp/result.bin" }, { signal });
    if (!stream) throw new Error("Rendered file is unavailable");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_BYTES) throw new Error("Rendered file is too large");
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  } finally {
    // Opting out of persistence discards the filesystem instead of snapshotting
    // user content. The VM deadline also terminates jobs if a caller disappears.
    await sandbox.stop({ signal: AbortSignal.timeout(10_000) }).catch(() => {});
  }
}
