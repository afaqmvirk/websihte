// Build bounded melody excerpts; the source scores and lyrics stay in the ignored cache.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import abcjs from "abcjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const revision = "ebb5a7b65dc0760467916c3287960bc89c6faa23";
const sha256 = "128b4385e232ec4f1239e68daea1adcf911ba8b37ed1dff58d6476171920e6aa";
const source = "https://huggingface.co/datasets/sander-wood/wikimt-x";
const url = `${source}/resolve/${revision}/wikimt-x-public.jsonl`;
const cache = process.env.SQUD_MELODY_DATASET || join(root, ".vercel/verification/squd-library/wikimt-x-public.jsonl");
let bytes;
try { bytes = await readFile(cache); }
catch (error) {
  if (error.code !== "ENOENT" || process.env.SQUD_MELODY_DATASET) throw error;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Melody dataset returned ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, bytes);
}
if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("Unexpected melody dataset checksum");
const rows = bytes.toString("utf8").trim().split("\n").map((line) => JSON.parse(line));

const normalize = (value) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const seen = new Set(), entries = [], rejected = [];
// Correct an upstream credit error, checked against https://www.haldavid.com/catalog.htm.
const artistCorrections = { "FZLa-1q-lkw": ["Burt Bacharach", "Hal David"] };
for (const row of rows) {
  try {
    const title = row.title.trim(), key = normalize(title);
    if (seen.has(key)) continue;
    // abcjs handles key signatures, accidentals, ties, tuplets, repeats and octave clefs.
    // Ignore lyrics before parsing, and never include descriptions or notation in the output.
    const abc = row.leadsheet.split("\n").filter((line) => !/^(?:[wW]:|%%MIDI control)/.test(line)).join("\n");
    const tune = abcjs.parseOnly(abc)[0];
    const audio = tune.setUpAudio({ chordsOff: true });
    const events = audio.tracks.find((track) => track.some((event) => event.cmd === "note"))
      ?.filter((event) => event.cmd === "note" && Number.isInteger(event.pitch) && event.duration > 0)
      .sort((a, b) => a.start - b.start || b.pitch - a.pitch);
    if (!events?.length) throw new Error("No melody voice");
    const tempo_bpm = Math.round(Math.min(200, Math.max(120, audio.tempo || 160)));
    const notes = [];
    let end = events[0].start, beats = 0;
    const add = (pitch, duration) => {
      const length = Math.round(Math.min(2, Math.max(0.125, duration)) * 1000) / 1000;
      if (notes.length >= 24 || (beats + length) * 60 / tempo_bpm > 7) return false;
      notes.push({ pitch, beats: length }); beats += length; return true;
    };
    for (const event of events) {
      if (event.start < end - 0.001) continue; // One melody note at a time, no accompaniment.
      if (event.start > end + 0.03 && !add(null, (event.start - end) * 4)) break;
      if (!add(event.pitch, event.duration * 4)) break;
      end = event.start + event.duration;
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
    entries.push({ song: `wikimt_${row.youtube_id}`, title, artists: artistCorrections[row.youtube_id] ?? row.artists, genre: row.genre,
      score: { tempo_bpm, notes } });
    seen.add(key);
  } catch (error) { rejected.push({ title: row.title, reason: error.message }); }
}
if (entries.length < 300) throw new Error(`Only ${entries.length} usable melodies`);
const metadata = { source, revision, sha256, license: "CC-BY-NC-4.0", count: entries.length };
await writeFile(join(root, "app/lib/discord-bot-clarinet-library.json"), JSON.stringify({ ...metadata, entries }) + "\n");
await writeFile(join(root, "public/discord/squd/library.json"), JSON.stringify({ ...metadata,
  entries: entries.map(({ song, title, artists, genre }) => ({ song, title, artists, genre })) }, null, 2) + "\n");
console.log(JSON.stringify({ ...metadata, rejected }, null, 2));
