import { createHash } from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import { resolve, join } from "node:path";
import { writeSqudCatalog } from "./lib/write-squd-catalog.mjs";

const root = resolve(process.env.SQUD_DISCOVER_INDEX || ".vercel/verification/squd-discover-index");
const verified = JSON.parse(await readFile(join(root, "source-verified.json"), "utf8"));
const summary = JSON.parse(await readFile(join(root, "index-summary.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(root, "catalog-summary.json"), "utf8")).catalog;
if (summary.compressedBytes !== verified.bytes || summary.midis < 6_000_000) throw new Error("Archive indexing is incomplete");
const output = await open(join(root, "discover-index.bin"), "w"), windows = await open(join(root, "windows.bin"), "r");
const hash = createHash("sha256"), shards = [], checkpoints = [];
let offset = 0;
async function packed(bytes) {
  const data = deflateRawSync(bytes), part = { offset, length: data.length,
    sha256: createHash("sha256").update(data).digest("hex"), decoded: bytes.length };
  await output.write(data); hash.update(data); offset += data.length; return part;
}
try {
  for (let prefix = 0; prefix < 256; prefix++) {
    const bytes = await readFile(join(root, `midis-${prefix.toString(16).padStart(2, "0")}.bin`));
    if (bytes.length % 28) throw new Error("Truncated MIDI offset index");
    const order = Array.from({ length: bytes.length / 28 }, (_, index) => index);
    order.sort((a, b) => Buffer.compare(bytes.subarray(a * 28, a * 28 + 16), bytes.subarray(b * 28, b * 28 + 16)));
    const sorted = Buffer.alloc(bytes.length);
    order.forEach((index, position) => bytes.copy(sorted, position * 28, index * 28, index * 28 + 28));
    shards.push(await packed(sorted));
  }
  const points = (await readFile(join(root, "points.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  for (const point of points) {
    const dictionary = Buffer.alloc(point.length);
    if (point.length) {
      const { bytesRead } = await windows.read(dictionary, 0, point.length, point.dictionary);
      if (bytesRead !== point.length) throw new Error("Truncated gzip dictionary");
    }
    checkpoints.push({ compressed: point.in, uncompressed: point.out,
      dictionary: point.length ? await packed(dictionary) : null });
  }
} finally { await output.close(); await windows.close(); }
const manifest = { version: 1, midiCount: summary.midis,
  source: { url: verified.url, bytes: verified.bytes, sha256: verified.sha256 },
  pack: { url: "https://github.com/afaqmvirk/websihte/releases/download/squd-discover-0eaecb5-v1/discover-index.bin",
    bytes: offset, sha256: hash.digest("hex") },
  catalog: { ...catalog, url: "https://github.com/afaqmvirk/websihte/releases/download/squd-discover-0eaecb5-v1/catalog.sqlite.gz" },
  shards, checkpoints };
await writeFile(join(root, "archive-manifest.json"), JSON.stringify(manifest) + "\n");
await writeFile("app/lib/discord-bot-clarinet-discover.json", JSON.stringify(manifest) + "\n");
await writeSqudCatalog(process.cwd());
console.log({ indexedMidis: summary.midis, packBytes: offset, checkpointCount: checkpoints.length });
