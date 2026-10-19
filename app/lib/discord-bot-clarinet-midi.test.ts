import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeMidi, type MidiEvent } from "midi-file";
import { clarinetScoreFromMidi, MAX_CLARINET_MIDI_BYTES } from "./discord-bot-clarinet-midi";

function melody(channel = 0, pitches = [60, 62, 64, 65, 67, 69]) {
  return pitches.flatMap((noteNumber): MidiEvent[] => [
    { deltaTime: 0, type: "noteOn", channel, noteNumber, velocity: 90 },
    { deltaTime: 480, type: "noteOff", channel, noteNumber, velocity: 0 },
  ]);
}
function file(tracks: MidiEvent[][]) {
  return Buffer.from(writeMidi({ header: { format: 1, numTracks: tracks.length, ticksPerBeat: 480 },
    tracks: tracks.map((track) => [...track, { deltaTime: 0, type: "endOfTrack" }]) }));
}
describe("archive MIDI melody extraction", () => {
  it("retains scored pitches and elapsed timing across tempo changes", () => {
    const notes = melody();
    notes.splice(4, 0, { deltaTime: 0, type: "setTempo", microsecondsPerBeat: 250_000 });
    const score = clarinetScoreFromMidi(file([[{ deltaTime: 0, type: "setTempo", microsecondsPerBeat: 500_000 }, ...notes]]));
    assert.deepEqual(score.notes.map(({ pitch }) => pitch), [60, 62, 64, 65, 67, 69]);
    assert.deepEqual(score.notes.map(({ beats }) => beats), [1.333, 1.333, 0.667, 0.667, 0.667, 0.667]);
    assert.ok(Math.abs(score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm - 2) < 0.002);
  });
  it("selects the named melodic wind part ahead of bass and percussion", () => {
    const score = clarinetScoreFromMidi(file([
      [{ deltaTime: 0, type: "trackName", text: "Bass accompaniment" },
        { deltaTime: 0, type: "programChange", channel: 1, programNumber: 33 }, ...melody(1, [36, 40, 43, 36, 40, 43])],
      [{ deltaTime: 0, type: "trackName", text: "Lead melody" },
        { deltaTime: 0, type: "programChange", channel: 2, programNumber: 73 }, ...melody(2, [72, 74, 76, 77, 79, 81])],
      melody(9, [80, 82, 84, 85, 87, 89]),
    ]));
    assert.deepEqual(score.notes.map(({ pitch }) => pitch), [72, 74, 76, 77, 79, 81]);
  });
  it("rejects oversized malformed silent and percussion-only files", () => {
    for (const bytes of [Buffer.alloc(MAX_CLARINET_MIDI_BYTES + 1), Buffer.from("MThd"), file([[]]), file([melody(9)])]) {
      assert.throws(() => clarinetScoreFromMidi(bytes));
    }
  });
  it("chooses repeatable longer sections throughout the melody rather than only its opening", () => {
    const bytes = file([melody(0, Array.from({ length: 240 }, (_, index) => 55 + Math.floor(index / 8) % 24))]);
    const passages = Array.from({ length: 24 }, (_, index) => clarinetScoreFromMidi(bytes, `message-${index}`));
    assert.deepEqual(clarinetScoreFromMidi(bytes, "message-0"), passages[0]);
    assert.ok(new Set(passages.map((score) => JSON.stringify(score.notes))).size >= 12);
    assert.ok(passages.some((score) => score.notes[0].pitch! >= 70)); // Beyond the old first-64-note window.
    for (const score of passages) {
      const seconds = score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm;
      assert.ok(seconds >= 10 && seconds <= 15);
      assert.ok(score.notes.length >= 4 && score.notes.length <= 128);
    }
  });
  it("moves very high melodies down by octaves while preserving their intervals", () => {
    const score = clarinetScoreFromMidi(file([melody(0, [84, 86, 88, 89, 91, 93])]));
    assert.deepEqual(score.notes.map(({ pitch }) => pitch), [72, 74, 76, 77, 79, 81]);
  });
});
