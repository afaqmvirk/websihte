import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Both ABC and Online Sequencer imports use this same bounded quarter-note format.
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

export async function writeClarinetCollection(root, source, imported) {
  const path = join(root, "app/lib/discord-bot-clarinet-library.json");
  const previous = JSON.parse(await readFile(path, "utf8"));
  const oldSources = previous.sources ?? [{ id: "wikimt", source: previous.source,
    revision: previous.revision, sha256: previous.sha256, license: previous.license }];
  const start = previous.entries.findIndex((entry) => entry.song.startsWith(`${source.id}_`));
  const entries = previous.entries.filter((entry) => !entry.song.startsWith(`${source.id}_`));
  entries.splice(start < 0 ? entries.length : start, 0, ...imported);
  const sources = [...oldSources.filter((entry) => entry.id !== source.id), source].sort((a, b) => a.id.localeCompare(b.id));
  const metadata = { count: entries.length, sources };
  await writeFile(path, JSON.stringify({ ...metadata, entries }) + "\n");
  await writeFile(join(root, "public/discord/squd/library.json"), JSON.stringify({ ...metadata,
    entries: entries.map(({ score, ...entry }) => { void score; return entry; }) }, null, 2) + "\n");
}
