import { createHash } from "node:crypto";
import { constants, inflateRawSync } from "node:zlib";
import { MAX_CLARINET_MIDI_BYTES } from "./discord-bot-clarinet-midi";

export type ArchiveRange = { offset: number; length: number; sha256: string; decoded: number };
export type DiscoverArchiveManifest = {
  version: 1; midiCount: number;
  source: { url: string; bytes: number; sha256: string };
  pack: { url: string; bytes: number; sha256: string };
  shards: ArchiveRange[];
  checkpoints: { compressed: number; uncompressed: number; dictionary: ArchiveRange | null }[];
};

const MAX_RANGE_BYTES = 12 * 1024 * 1024, MAX_INFLATED_BYTES = 24 * 1024 * 1024;
const CACHE_BYTES = 32 * 1024 * 1024;

export function createDiscoverArchive(manifest: DiscoverArchiveManifest, fetcher: typeof fetch = (...args) => fetch(...args)) {
  const cached = new Map<string, Buffer>(), pending = new Map<string, Promise<Buffer>>();
  let cachedBytes = 0;
  async function range(url: string, total: number, offset: number, length: number) {
    if (![total, offset, length].every(Number.isSafeInteger) || offset < 0 || length < 1
      || length > MAX_RANGE_BYTES || offset + length > total) throw new Error("Archive byte range exceeds bounds");
    const key = `${url}:${offset}:${length}`, hit = cached.get(key);
    if (hit) { cached.delete(key); cached.set(key, hit); return hit; }
    const existing = pending.get(key); if (existing) return existing;
    if (pending.size >= 32) throw new Error("Archive is busy");
    const request = (async () => {
      const end = offset + length - 1;
      const response = await fetcher(url, { headers: { Range: `bytes=${offset}-${end}` },
        redirect: "follow", signal: AbortSignal.timeout(12_000), cache: "no-store" });
      if (response.status !== 206 || response.headers.get("content-range") !== `bytes ${offset}-${end}/${total}`
        || !response.body) { await response.body?.cancel(); throw new Error("Archive range unavailable"); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let received = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          received += value.byteLength;
          if (received > length) { await reader.cancel(); throw new Error("Archive response exceeds requested range"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (received !== length) throw new Error("Truncated archive range");
      const bytes = Buffer.concat(chunks, received);
      cached.set(key, bytes); cachedBytes += bytes.length;
      while (cachedBytes > CACHE_BYTES) {
        const oldest = cached.keys().next().value!;
        cachedBytes -= cached.get(oldest)!.length; cached.delete(oldest);
      }
      return bytes;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  async function packed(part: ArchiveRange) {
    if (part.decoded < 0 || part.decoded > MAX_INFLATED_BYTES) throw new Error("Invalid index record size");
    const bytes = await range(manifest.pack.url, manifest.pack.bytes, part.offset, part.length);
    if (createHash("sha256").update(bytes).digest("hex") !== part.sha256) throw new Error("Archive index checksum mismatch");
    const decoded = inflateRawSync(bytes, { maxOutputLength: Math.max(1, part.decoded) });
    if (decoded.length !== part.decoded) throw new Error("Archive index length mismatch");
    return decoded;
  }
  async function recordFor(hash: string) {
      if (!/^[a-f0-9]{32}$/.test(hash) || manifest.version !== 1 || manifest.shards.length !== 256) throw new Error("Invalid archive song ID");
      const shard = await packed(manifest.shards[parseInt(hash.slice(0, 2), 16)]);
      if (shard.length % 28) throw new Error("Invalid MIDI index shard");
      const wanted = Buffer.from(hash, "hex");
      let left = 0, right = shard.length / 28;
      while (left < right) {
        const middle = (left + right) >>> 1;
        if (Buffer.compare(shard.subarray(middle * 28, middle * 28 + 16), wanted) < 0) left = middle + 1;
        else right = middle;
      }
      const record = shard.subarray(left * 28, left * 28 + 28);
      return record.length === 28 && record.subarray(0, 16).equals(wanted) ? record : null;
  }
  return {
    async has(hash: string) { return !!await recordFor(hash); },
    async midi(hash: string) {
      const record = await recordFor(hash);
      if (!record) throw new Error("Song is not in the archive");
      const offset = Number(record.readBigUInt64LE(16)), length = record.readUInt32LE(24);
      if (!Number.isSafeInteger(offset) || length > MAX_CLARINET_MIDI_BYTES || length < 14) throw new Error("MIDI exceeds playback bounds");
      const points = manifest.checkpoints;
      let left = 0, right = points.length;
      while (left + 1 < right) {
        const middle = (left + right) >>> 1;
        if (points[middle].uncompressed <= offset) left = middle; else right = middle;
      }
      const point = points[left];
      if (!point || point.uncompressed > offset) throw new Error("No preceding gzip checkpoint");
      let after = left + 1;
      while (after < points.length && points[after].uncompressed < offset + length) after++;
      const end = after < points.length ? points[after].compressed : manifest.source.bytes;
      const [dictionary, compressed] = await Promise.all([
        point.dictionary ? packed(point.dictionary) : Promise.resolve(Buffer.alloc(0)),
        range(manifest.source.url, manifest.source.bytes, point.compressed, end - point.compressed),
      ]);
      if (dictionary.length > 32_768) throw new Error("Invalid gzip dictionary");
      const decoded = inflateRawSync(compressed, { dictionary, finishFlush: constants.Z_SYNC_FLUSH, maxOutputLength: MAX_INFLATED_BYTES });
      const relative = offset - point.uncompressed;
      if (relative + length > decoded.length) throw new Error("MIDI crosses an unavailable archive range");
      const midi = decoded.subarray(relative, relative + length);
      if (createHash("md5").update(midi).digest("hex") !== hash) throw new Error("MIDI checksum mismatch");
      return midi;
    },
  };
}
