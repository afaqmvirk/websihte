// Bounded monophonic excerpts in quarter-note beats, shared by imports and live MIDI playback.
import { createHash } from "node:crypto";

export function compileClarinetExcerpt(input, tempo, { maxSeconds = 7, maxNotes = 24 } = {}) {
  const events = [...input].sort((a, b) => a.time - b.time || b.pitch - a.pitch);
  if (!events.length) throw new Error("No melody voice");
  const tempo_bpm = Math.round(Math.min(200, Math.max(120, tempo || 160))), notes = [];
  let end = events[0].time, beats = 0;
  const add = (pitch, duration) => {
    const length = Math.round(Math.min(2, Math.max(0.125, duration)) * 1000) / 1000;
    if (notes.length >= maxNotes || (beats + length) * 60 / tempo_bpm > maxSeconds) return false;
    notes.push({ pitch, beats: length }); beats += length; return true;
  };
  for (const event of events) {
    if (event.time < end - 0.004) continue;
    if (event.time > end + 0.12 && !add(null, event.time - end)) break;
    if (!add(event.pitch, event.beats)) break;
    end = event.time + event.beats;
  }
  if (notes.length < 4 || notes.filter((note) => note.pitch !== null).length < 3) throw new Error("Excerpt too sparse");
  const pitches = notes.flatMap((note) => note.pitch === null ? [] : [note.pitch]);
  const min = Math.min(...pitches), max = Math.max(...pitches);
  const octave = [0, -12, 12, -24, 24, -36, 36].find((offset) => min + offset >= 55 && max + offset <= 82);
  for (const note of notes) {
    if (note.pitch === null) continue;
    note.pitch += octave ?? 0;
    while (note.pitch < 55) note.pitch += 12;
    while (note.pitch > 82) note.pitch -= 12;
  }
  return { tempo_bpm, notes };
}

export function clarinetPassageIndex(seed, count) {
  return createHash("sha256").update(`squd-passage-choice:${seed}`).digest().readUInt32BE(0) % count;
}

/**
 * @param {{pitch: number, time: number, beats: number}[]} input
 * @param {number} tempo
 * @param {string} [performanceSeed]
 */
export function compileClarinetPassage(input, tempo, performanceSeed) {
  const events = [...input].sort((a, b) => a.time - b.time || b.pitch - a.pitch);
  if (events.length < 4) throw new Error("No playable melody");
  const bpm = Math.min(200, Math.max(120, tempo || 160));
  let state = createHash("sha256").update(`squd-passage:${performanceSeed ?? "opening"}`).digest().readUInt32BE(0) || 1;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const maxSeconds = 10.5 + random() * 3;
  const end = events.reduce((maximum, note) => Math.max(maximum, note.time + note.beats), 0);
  // A short source may never meet the random 10.5–13.5s target. Still vary its
  // start when at least six seconds remain; tiny signature riffs stay whole.
  const sourceSeconds = (end - events[0].time) * 60 / bpm;
  const minimumSeconds = Math.min(10, Math.max(6, sourceSeconds * 0.6));
  const startSeconds = sourceSeconds < maxSeconds ? minimumSeconds : maxSeconds;
  const starts = events.flatMap((note, index) => index <= events.length - 4
    && (!index || note.time !== events[index - 1].time) && (end - note.time) * 60 / bpm >= startSeconds ? [index] : []);
  if (!starts.length) starts.push(0); // Short hooks finish naturally, without looping or inventing notes.
  if (performanceSeed !== undefined) for (let index = 0; index < Math.min(32, starts.length); index++) {
    const chosen = index + Math.floor(random() * (starts.length - index));
    [starts[index], starts[chosen]] = [starts[chosen], starts[index]];
  }
  let best, bestSeconds = 0;
  for (const start of starts.slice(0, 32)) {
    const origin = events[start].time;
    try {
      const score = compileClarinetExcerpt(events.slice(start, start + 600).filter((note) => (note.time - origin) * 60 / bpm < 45),
        bpm, { maxSeconds, maxNotes: 128 });
      const seconds = score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / bpm;
      if (seconds >= minimumSeconds || performanceSeed === undefined) return score;
      if (seconds > bestSeconds) { best = score; bestSeconds = seconds; }
    } catch { /* Try another real section of this melody. */ }
  }
  if (best) return best;
  throw new Error("No playable melody section");
}
