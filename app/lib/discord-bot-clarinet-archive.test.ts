import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants, createGzip, deflateRawSync } from "node:zlib";
import { writeMidi } from "midi-file";
import { createDiscoverArchive, type ArchiveRange, type DiscoverArchiveManifest } from "./discord-bot-clarinet-archive";

async function fixture() {
  const midi = Buffer.from(writeMidi({ header: { format: 0, numTracks: 1, ticksPerBeat: 480 }, tracks: [[
    ...[60, 62, 64, 65].flatMap((noteNumber) => [
      { deltaTime: 0, type: "noteOn" as const, channel: 0, noteNumber, velocity: 100 },
      { deltaTime: 480, type: "noteOff" as const, channel: 0, noteNumber, velocity: 0 },
    ]), { deltaTime: 0, type: "endOfTrack" },
  ]] }));
  const hash = createHash("md5").update(midi).digest("hex");
  const prefix = Buffer.from("preceding public MIDI bytes ".repeat(2000)), padding = Buffer.alloc(512);
  const gzip = createGzip(), chunks: Buffer[] = [];
  gzip.on("data", (chunk) => chunks.push(chunk));
  gzip.write(prefix);
  await new Promise<void>((resolve) => gzip.flush(constants.Z_SYNC_FLUSH, resolve));
  const checkpoint = chunks.reduce((sum, bytes) => sum + bytes.length, 0);
  gzip.end(Buffer.concat([padding, midi])); await once(gzip, "end");
  const source = Buffer.concat(chunks), record = Buffer.alloc(28);
  Buffer.from(hash, "hex").copy(record); record.writeBigUInt64LE(BigInt(prefix.length + padding.length), 16); record.writeUInt32LE(midi.length, 24);
  const parts: Buffer[] = [];
  function packed(bytes: Buffer): ArchiveRange {
    const compressed = deflateRawSync(bytes), offset = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(compressed);
    return { offset, length: compressed.length, sha256: createHash("sha256").update(compressed).digest("hex"), decoded: bytes.length };
  }
  const shard = packed(record), dictionary = packed(prefix.subarray(-32768)), pack = Buffer.concat(parts);
  const manifest: DiscoverArchiveManifest = { version: 1, midiCount: 1,
    source: { url: "https://example.test/archive.gz", bytes: source.length, sha256: createHash("sha256").update(source).digest("hex") },
    pack: { url: "https://example.test/index.bin", bytes: pack.length, sha256: createHash("sha256").update(pack).digest("hex") },
    shards: Array(256).fill(shard), checkpoints: [
      { compressed: 10, uncompressed: 0, dictionary: null },
      { compressed: checkpoint, uncompressed: prefix.length, dictionary },
    ],
  };
  const calls: { url: string; start: number; end: number }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input), bytes = url === manifest.pack.url ? pack : source;
    const [, first, last] = new Headers(init?.headers).get("range")!.match(/^bytes=(\d+)-(\d+)$/)!;
    const start = Number(first), end = Number(last); calls.push({ url, start, end });
    return new Response(bytes.subarray(start, end + 1), { status: 206, headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` } });
  };
  return { midi, hash, manifest, calls, fetcher, source, pack };
}
describe("remote Discover MIDI byte-range playback", () => {
  it("restores a MIDI beyond a gzip checkpoint without downloading the archive", async () => {
    const f = await fixture(), archive = createDiscoverArchive(f.manifest, f.fetcher);
    assert.deepEqual(await archive.midi(f.hash), f.midi);
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls.find(({ url }) => url === f.manifest.source.url)?.start, f.manifest.checkpoints[1].compressed);
    assert.deepEqual(await archive.midi(f.hash), f.midi);
    assert.equal(f.calls.length, 3); // Bounded public-byte cache avoids repeated downloads.
  });
  it("shares concurrent requests and never fetches source data for an unknown ID", async () => {
    const f = await fixture(), archive = createDiscoverArchive(f.manifest, f.fetcher);
    await Promise.all([archive.midi(f.hash), archive.midi(f.hash)]);
    assert.equal(f.calls.length, 3);
    const count = f.calls.length;
    await assert.rejects(archive.midi("0".repeat(32)), /not in the archive/);
    assert.equal(f.calls.length, count);
    await assert.rejects(archive.midi("../../secret"));
    assert.equal(f.calls.length, count);
  });
  it("rejects full-download responses corrupt indexes and altered MIDI bytes", async () => {
    const f = await fixture();
    const full: typeof fetch = async () => new Response("unexpected full archive", { status: 200 });
    await assert.rejects(createDiscoverArchive(f.manifest, full).midi(f.hash), /range unavailable/);
    const bad = structuredClone(f.manifest); bad.shards[parseInt(f.hash.slice(0, 2), 16)].sha256 = "0".repeat(64);
    await assert.rejects(createDiscoverArchive(bad, f.fetcher).midi(f.hash), /index checksum/);
    const changed: typeof fetch = async (input, init) => {
      const response = await f.fetcher(input, init);
      if (String(input) !== f.manifest.source.url) return response;
      const bytes = new Uint8Array(await response.arrayBuffer()); bytes.fill(0);
      return new Response(bytes, { status: 206, headers: response.headers });
    };
    await assert.rejects(createDiscoverArchive(f.manifest, changed).midi(f.hash));
  });
});
