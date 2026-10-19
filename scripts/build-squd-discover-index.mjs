// Stream the pinned archive once; store only MIDI offsets, gzip checkpoints and name metadata.
// No model calls, full-archive disk copy, source-code execution, or paid service is involved.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const output = resolve(process.env.SQUD_DISCOVER_INDEX || ".vercel/verification/squd-discover-index");
const executable = resolve(process.env.SQUD_DISCOVER_INDEXER || ".vercel/verification/index-squd-discover.exe");
const url = "https://huggingface.co/datasets/projectlosangeles/Discover-MIDI-Dataset/resolve/0eaecb5b1c1be02751f4dca97bb9b25e8408e498/Discover-MIDI-Dataset-CC-BY-NC-SA.tar.gz";
const size = 29_378_161_788, expected = "64fc6e1f0ab5bbd595d676549f3e315fd3d05f7f74d79f1c689f72c0e89d2357";
const chunk = 64 * 1024 * 1024, parallel = 4;
await mkdir(output, { recursive: true });
const child = spawn(executable, [output], { stdio: ["pipe", "ignore", "inherit"], windowsHide: true });
const finished = new Promise((resolve, reject) => {
  child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Indexer exited ${code}`)));
});
// Keep failure observable while upstream chunks are still being downloaded.
finished.catch(() => {});
child.stdin.on("error", () => {});
const pending = new Map(), hash = createHash("sha256");
const controller = new AbortController();
async function download(index) {
  const start = index * chunk, end = Math.min(size, start + chunk) - 1;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]) });
    if (response.status === 429 || response.status >= 500) {
      const seconds = Math.max(5, Number(response.headers.get("retry-after")) || 30);
      await response.body?.cancel();
      console.log(`Upstream ${response.status}; waiting ${seconds}s before retry`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000)); continue;
    }
    if (response.status !== 206 || response.headers.get("content-range") !== `bytes ${start}-${end}/${size}`) {
      await response.body?.cancel(); throw new Error("Upstream did not honor the bounded byte range");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== end - start + 1) throw new Error("Truncated archive range");
    return bytes;
  }
  throw new Error("Archive range unavailable after bounded retries");
}
function enqueue(index) {
  const request = download(index);
  request.catch(() => {}); // A later chunk can fail before the preceding chunk is consumed.
  pending.set(index, request);
}
try {
  const chunks = Math.ceil(size / chunk);
  for (let index = 0; index < Math.min(parallel, chunks); index++) enqueue(index);
  for (let index = 0; index < chunks; index++) {
    const bytes = await pending.get(index); pending.delete(index);
    hash.update(bytes);
    if (!child.stdin.write(bytes)) await Promise.race([once(child.stdin, "drain"), finished.then(() => { throw new Error("Indexer ended early"); })]);
    if (index + parallel < chunks) enqueue(index + parallel);
  }
  child.stdin.end(); await finished;
  const sha256 = hash.digest("hex");
  if (sha256 !== expected) throw new Error("Pinned archive checksum mismatch");
  await writeFile(join(output, "source-verified.json"), JSON.stringify({ url, bytes: size, sha256, verifiedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log("Complete archive indexed and SHA-256 verified");
} catch (error) {
  controller.abort(); child.kill(); throw error;
}
