import { parseMidi } from "midi-file";
import { compileClarinetExcerpt } from "./discord-bot-clarinet-compile.mjs";
import { parseClarinetScore } from "./discord-bot-clarinet-score";

export const MAX_CLARINET_MIDI_BYTES = 1_000_000;
type Note = { pitch: number; start: number; end: number; program: number };
type Voice = { name: string; channel: number; notes: Note[] };

export function clarinetScoreFromMidi(bytes: Uint8Array) {
  if (bytes.length > MAX_CLARINET_MIDI_BYTES || Buffer.from(bytes.subarray(0, 4)).toString() !== "MThd") throw new Error("Invalid MIDI size or header");
  const midi = parseMidi(bytes), ppq = midi.header.ticksPerBeat;
  if (!ppq || !Number.isInteger(ppq) || ppq < 1 || midi.header.format > 1
    || !midi.tracks.length || midi.tracks.length > 128) throw new Error("Unsupported MIDI timing or track count");
  let eventCount = 0;
  const tempos = [{ tick: 0, micros: 500_000 }], voices: Voice[] = [];
  for (const track of midi.tracks) {
    let tick = 0, name = "";
    const programs = Array<number>(16).fill(0), notes = new Map<number, Note[]>(), active = new Map<number, Note[]>();
    for (const event of track) {
      if (++eventCount > 200_000 || !Number.isSafeInteger(event.deltaTime) || event.deltaTime < 0) throw new Error("MIDI event limit exceeded");
      tick += event.deltaTime;
      if (!Number.isSafeInteger(tick)) throw new Error("Invalid MIDI tick");
      if (event.type === "trackName" || event.type === "instrumentName") name += ` ${event.text.slice(0, 160)}`;
      else if (event.type === "setTempo") {
        if (event.microsecondsPerBeat < 1 || event.microsecondsPerBeat > 60_000_000) throw new Error("Invalid MIDI tempo");
        tempos.push({ tick, micros: event.microsecondsPerBeat });
      } else if (event.type === "programChange") programs[event.channel] = event.programNumber;
      else if ((event.type === "noteOn" || event.type === "noteOff") && event.channel !== 9) {
        if (!Number.isInteger(event.noteNumber) || event.noteNumber < 0 || event.noteNumber > 127) throw new Error("Invalid MIDI pitch");
        const key = event.channel * 128 + event.noteNumber;
        if (event.type === "noteOn" && event.velocity > 0) {
          const pending = active.get(key) ?? [];
          pending.push({ pitch: event.noteNumber, start: tick, end: tick, program: programs[event.channel] }); active.set(key, pending);
        } else {
          const note = active.get(key)?.shift();
          if (note && tick > note.start) {
            note.end = tick;
            const channel = notes.get(event.channel) ?? []; channel.push(note); notes.set(event.channel, channel);
          }
        }
      }
    }
    for (const [channel, sequence] of notes) if (sequence.length >= 4) {
      voices.push({ name, channel, notes: sequence.sort((a, b) => a.start - b.start || b.pitch - a.pitch) });
    }
  }
  const segments: { tick: number; seconds: number; step: number }[] = [];
  for (const tempo of tempos.sort((a, b) => a.tick - b.tick)) {
    const previous = segments.at(-1);
    const seconds = previous ? previous.seconds + (tempo.tick - previous.tick) * previous.step : 0;
    const segment = { tick: tempo.tick, seconds, step: tempo.micros / ppq / 1_000_000 };
    if (previous?.tick === tempo.tick) segments[segments.length - 1] = segment;
    else segments.push(segment);
  }
  const time = (tick: number) => {
    let left = 0, right = segments.length;
    while (left + 1 < right) { const middle = (left + right) >>> 1; if (segments[middle].tick <= tick) left = middle; else right = middle; }
    const segment = segments[left]; return segment.seconds + (tick - segment.tick) * segment.step;
  };
  const ranked = voices.map((voice, index) => {
    const pitches = voice.notes.map((note) => note.pitch).sort((a, b) => a - b);
    const median = pitches[pitches.length >>> 1], program = voice.notes[0].program;
    const overlap = voice.notes.filter((note, index, notes) => index && note.start < notes[index - 1].end).length / voice.notes.length;
    const explicit = /melod|vocal|lead|voice|cantus|solo/i.test(voice.name) ? 150 : 0;
    const accompaniment = /bass|drum|accomp|arpeggio|chord|rhythm/i.test(voice.name) || (program >= 32 && program <= 39) ? 150 : 0;
    const wind = program >= 64 && program <= 87 ? 25 : 0;
    return { voice, rank: explicit - accompaniment + wind + median * 0.5 - overlap * 60 - index * 0.1 };
  }).filter(({ voice }) => new Set(voice.notes.map((note) => note.pitch)).size >= 3).sort((a, b) => b.rank - a.rank);
  for (const { voice } of ranked) {
    for (let start = 0; start < Math.min(64, voice.notes.length - 3); start += 8) {
      const origin = time(voice.notes[start].start);
      const events = voice.notes.slice(start, start + 200).filter((note) => time(note.start) - origin < 8).map((note) => ({
        pitch: note.pitch, time: (time(note.start) - origin) * 160 / 60, beats: (time(note.end) - time(note.start)) * 160 / 60,
      }));
      // Convert elapsed seconds to a common beat grid so tempo changes retain their timing.
      try { return parseClarinetScore(compileClarinetExcerpt(events, 160)); } catch { /* Try the next scored phrase or voice. */ }
    }
  }
  throw new Error("No playable melody in MIDI");
}
