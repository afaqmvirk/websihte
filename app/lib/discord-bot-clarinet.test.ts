import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { getSqudClarinet, loadSqudClarinet, SQUD_CLARINET_SONGS } from "./discord-bot-clarinet";

describe("Squd clarinet voice clips", () => {
  it("selects repeatable performances across all 40 fallback clips and ten familiar tunes", async () => {
    const selected = new Map<string, string>();
    for (let index = 0; index < 2_000; index++) {
      const id = String(1560000000000000000n + BigInt(index));
      const clip = getSqudClarinet(id);
      assert.deepEqual(getSqudClarinet(id), clip);
      selected.set(clip.file, id);
    }
    assert.equal(selected.size, 40);
    const tunes = new Set<string>();
    for (const [file, id] of selected) {
      const reference = getSqudClarinet(id);
      tunes.add(reference.title);
      const clip = await loadSqudClarinet(id);
      assert.equal(clip.filename, file); assert.equal(clip.contentType, "audio/ogg");
      assert.ok(clip.duration > 1 && clip.duration < 10);
      assert.ok(Buffer.from(clip.bytes).includes(Buffer.from("OpusHead")));
      const waveform = Buffer.from(clip.waveform, "base64");
      assert.ok(waveform.length > 10 && waveform.length <= 256);
      assert.ok(waveform.some((sample) => sample > 0));
      const midi = await readFile(`public/discord/squd/${reference.midi}`);
      assert.equal(midi.subarray(0, 4).toString(), "MThd");
      assert.equal(midi.readUInt16BE(10), 1); // One track.
      assert.ok(midi.includes(Buffer.from([0xc0, 71]))); // GM clarinet.
      assert.ok(midi.includes(Buffer.from([0xff, 0x2f, 0]))); // End of track.
    }
    assert.equal(tunes.size, 10);
    assert.ok(tunes.has("Jingle Bells") && tunes.has("Ode to Joy"));
  });
  it("keeps every named selection within that song's four takes", () => {
    for (const song of SQUD_CLARINET_SONGS) {
      const files = new Set<string>();
      for (let index = 0; index < 256; index++) {
        const clip = getSqudClarinet(String(1560000000000000000n + BigInt(index)), song);
        assert.equal(clip.song, song); files.add(clip.file);
      }
      assert.equal(files.size, 4);
    }
    assert.throws(() => getSqudClarinet("1560000000000000002", "../../arbitrary"));
  });
});
