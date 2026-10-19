import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileClarinetExcerpt } from "./clarinet-library.mjs";
import { decodeOnlineSequence } from "./online-sequencer.mjs";

function integer(value) {
  const bytes = [];
  do { const byte = value & 127; value >>>= 7; bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
}
const scalar = (field, value) => Buffer.concat([integer(field * 8), integer(value)]);
const message = (field, bytes) => Buffer.concat([integer(field * 8 + 2), integer(bytes.length), bytes]);
const float = (field, value) => {
  const bytes = Buffer.alloc(4); bytes.writeFloatLE(value);
  return Buffer.concat([integer(field * 8 + 5), bytes]);
};
const note = (pitch, time, length, volume = 1, annotation = false) => message(2, Buffer.concat([
  scalar(1, pitch), float(2, time), float(3, length), scalar(4, 43), float(5, volume),
  ...(annotation ? [message(7, Buffer.from("label"))] : []),
]));
const settings = message(1, scalar(1, 160));

describe("offline clarinet imports", () => {
  it("converts sequence steps to concert pitches and quarter-note beats before using the shared compiler", () => {
    const pitches = [60, 64, 67, 72];
    const bytes = Buffer.concat([settings, ...pitches.map((pitch, index) => note(pitch, index * 2, 2))]);
    const sequence = decodeOnlineSequence(bytes);
    assert.equal(sequence.tempo, 160);
    assert.deepEqual(sequence.notes.map(({ pitch, time, beats }) => ({ pitch, time, beats })),
      pitches.map((pitch, index) => ({ pitch, time: index / 2, beats: 0.5 })));
    assert.deepEqual(compileClarinetExcerpt(sequence.notes, sequence.tempo), {
      tempo_bpm: 160, notes: pitches.map((pitch) => ({ pitch, beats: 0.5 })),
    });
  });
  it("ignores muted notes and annotations instead of playing labels as melody", () => {
    const sequence = decodeOnlineSequence(Buffer.concat([settings, note(60, 0, 4),
      note(64, 4, 4, 0), note(67, 4, 4, 1, true)]));
    assert.equal(sequence.notes.length, 1);
    assert.equal(sequence.notes[0].pitch, 60);
  });
  it("rejects truncated oversized and empty source data", () => {
    for (const bytes of [Buffer.from([10, 8, 1]), Buffer.from([0]), Buffer.from([15]),
      Buffer.from([10, 1, 128]), Buffer.from([21, 0]), Buffer.alloc(5_000_001), settings]) {
      assert.throws(() => decodeOnlineSequence(bytes));
    }
  });
  it("bounds imported excerpts and preserves a recognizable melody register", () => {
    const notes = Array.from({ length: 100 }, (_, index) => ({ pitch: 36 + index % 8, time: index, beats: 1 }));
    const score = compileClarinetExcerpt(notes, 240);
    assert.equal(score.tempo_bpm, 200);
    assert.ok(score.notes.length <= 24);
    assert.ok(score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm <= 7);
    assert.deepEqual(score.notes.slice(0, 8).map(({ pitch }) => pitch), [60, 61, 62, 63, 64, 65, 66, 67]);
    assert.throws(() => compileClarinetExcerpt([], 160));
  });
});
