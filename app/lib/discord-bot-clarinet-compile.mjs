// Bounded monophonic excerpts in quarter-note beats, shared by imports and live MIDI playback.
export function compileClarinetExcerpt(input, tempo) {
  const events = [...input].sort((a, b) => a.time - b.time || b.pitch - a.pitch);
  if (!events.length) throw new Error("No melody voice");
  const tempo_bpm = Math.round(Math.min(200, Math.max(120, tempo || 160))), notes = [];
  let end = events[0].time, beats = 0;
  const add = (pitch, duration) => {
    const length = Math.round(Math.min(2, Math.max(0.125, duration)) * 1000) / 1000;
    if (notes.length >= 24 || (beats + length) * 60 / tempo_bpm > 7) return false;
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
  const octave = [0, 12, -12, 24, -24, 36, -36].find((offset) => min + offset >= 55 && max + offset <= 88);
  for (const note of notes) {
    if (note.pitch === null) continue;
    note.pitch += octave ?? 0;
    while (note.pitch < 55) note.pitch += 12;
    while (note.pitch > 88) note.pitch -= 12;
  }
  return { tempo_bpm, notes };
}
