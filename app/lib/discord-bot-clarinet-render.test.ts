import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { parseClarinetScore } from "./discord-bot-clarinet-score";
import { createClarinetPerformance, renderClarinetScore } from "./discord-bot-clarinet-render";
import { getSqudClarinet } from "./discord-bot-clarinet";
const OpusScript = createRequire(import.meta.url)("opusscript") as typeof import("opusscript");
const score = { tempo_bpm: 160, notes: [67, 69, 71, 72].map((pitch) => ({ pitch, beats: 1 })) };

describe("Luna clarinet rendering", () => {
  it("rejects malformed scores and bounds notes duration pitch and silence", () => {
    assert.deepEqual(parseClarinetScore(score), score);
    for (const invalid of [null, [], { ...score, code: "arbitrary" }, { ...score, tempo_bpm: 0 },
      { ...score, notes: [] }, { ...score, notes: Array(129).fill({ pitch: 67, beats: 0.125 }) },
      { ...score, notes: Array(4).fill({ pitch: 83, beats: 1 }) },
      { ...score, notes: Array(4).fill({ pitch: 900, beats: 1 }) },
      { ...score, notes: Array(4).fill({ pitch: 67, beats: NaN }) },
      { ...score, notes: Array(4).fill({ pitch: null, beats: 1 }) },
      { tempo_bpm: 120, notes: Array(24).fill({ pitch: 67, beats: 2 }) }]) assert.throws(() => parseClarinetScore(invalid));
  });
  it("renders the supplied notes into repeatable decodable Opus with voice metadata", async () => {
    const clip = await renderClarinetScore(score, "1560000000000000002");
    const repeat = await renderClarinetScore(score, "1560000000000000002");
    assert.deepEqual(clip, repeat);
    assert.ok(clip.filename.startsWith("clarinet-live-"));
    assert.ok(clip.duration > 1 && clip.duration < 10 && clip.bytes.length < 500_000);
    assert.ok(Buffer.from(clip.waveform, "base64").some((value) => value > 0));
    const bytes = Buffer.from(clip.bytes), decoder = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
    let audioPackets = 0, nonzero = false;
    try {
      for (let offset = 0; offset < bytes.length;) {
        assert.equal(bytes.subarray(offset, offset + 4).toString(), "OggS");
        const segments = bytes[offset + 26];
        let length = 0; for (let index = 0; index < segments; index++) length += bytes[offset + 27 + index];
        const packet = bytes.subarray(offset + 27 + segments, offset + 27 + segments + length);
        if (audioPackets || (packet.subarray(0, 8).toString() !== "OpusHead" && packet.subarray(0, 8).toString() !== "OpusTags")) {
          const decoded = decoder.decode(packet); audioPackets++;
          nonzero ||= decoded.some((value) => value !== 0);
        }
        offset += 27 + segments + length;
      }
    } finally { decoder.delete(); }
    assert.ok(audioPackets > 50 && nonzero);
    const different = await renderClarinetScore({ ...score, notes: score.notes.map((note) => ({ ...note, pitch: note.pitch + 3 })) }, "1560000000000000002");
    assert.notDeepEqual(different.bytes, clip.bytes);
  });
  it("falls back to the requested song and fails rather than substituting another tune", async () => {
    const unavailable = async () => { throw new Error("Encoder unavailable"); };
    const clip = await createClarinetPerformance(score, "1560000000000000002", "happy_birthday", unavailable);
    assert.equal(clip.filename, getSqudClarinet("1560000000000000002", "happy_birthday").file);
    await assert.rejects(createClarinetPerformance(score, "1560000000000000002", undefined, unavailable));
  });
  it("renders a longer section and caps added mistakes and breath gaps at fifteen seconds", async () => {
    const long = { tempo_bpm: 128, notes: Array.from({ length: 64 }, (_, index) => ({ pitch: 60 + index % 12, beats: 0.5 })) };
    assert.deepEqual(parseClarinetScore(long), long);
    const clip = await renderClarinetScore(long, "1560000000000000018");
    assert.ok(clip.duration >= 10 && clip.duration <= 15);
    assert.equal(Buffer.from(clip.waveform, "base64").length, Math.ceil(clip.duration * 10));
    const bytes = Buffer.from(clip.bytes);
    let last = 0;
    for (let offset = 0; offset < bytes.length;) {
      last = offset;
      const segments = bytes[offset + 26]; let length = 0;
      for (let index = 0; index < segments; index++) length += bytes[offset + 27 + index];
      offset += 27 + segments + length;
    }
    assert.equal(Number(bytes.readBigUInt64LE(last + 6)) - 312, Math.round(clip.duration * 48000));
  });
});
