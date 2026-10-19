import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileClarinetPassage, writeClarinetCollection } from "./lib/clarinet-library.mjs";
import { decodeOnlineSequence } from "./lib/online-sequencer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "scripts/squd-modern-sources.json"), "utf8"));
const cache = process.env.SQUD_SEQUENCE_CACHE || join(root, ".vercel/verification/squd-modern");
await mkdir(cache, { recursive: true });
const entries = [];
for (const row of manifest.entries) {
  const path = join(cache, `${row.id}.proto`);
  let bytes;
  try { bytes = await readFile(path); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const url = new URL(row.dataUrl);
    if (url.origin !== "https://onlinesequencer.net" || url.pathname !== "/app/api/get_proto.php") throw new Error("Unexpected source URL");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Sequence ${row.id} returned ${response.status}; retry later, respecting Retry-After`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path, bytes);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`Unexpected source checksum: ${row.id}`);
  const sequence = decodeOnlineSequence(bytes);
  const melody = sequence.notes.filter((note) => note.instrument === row.instrument && note.time >= row.startBeat && note.pitch >= row.minPitch)
    .sort((a, b) => a.time - b.time || b.pitch - a.pitch);
  // Human-played piano chords can have millisecond offsets; keep the upper melody.
  const onsets = [];
  for (const note of melody) {
    const previous = onsets.at(-1);
    if (previous && note.time - previous.time < 0.025) {
      if (note.pitch > previous.pitch) { previous.pitch = note.pitch; previous.beats = note.beats; }
    } else onsets.push({ pitch: note.pitch, time: note.time, beats: note.beats });
  }
  const passages = Array.from({ length: 8 }, (_, index) => compileClarinetPassage(onsets, sequence.tempo, `os_${row.id}:${index}`));
  entries.push({ song: `os_${row.id}`, title: row.title, artists: row.artists, genre: row.genre,
    aliases: row.aliases, score: passages[0], passages });
}
await writeClarinetCollection(root, { id: "os", source: manifest.source,
  notice: "https://www.stupideas.com/discord/squd/OnlineSequencer-NOTICE.md", count: entries.length }, entries);
await writeFile(join(root, "public/discord/squd/online-sequencer-sources.json"), JSON.stringify(manifest, null, 2) + "\n");

// Move the original ten references into the same score-selection path too.
const originals = JSON.parse(await readFile(join(root, "app/lib/discord-bot-clarinet-tunes.json"), "utf8"));
const aliases = {
  happy_birthday: ["happy bday", "birthday song", "happybirthday"],
  weezer_buddy_holly: ["weezer lick", "weezer riff", "buddy holly"],
  spongebob_nose_flute: ["spongebob theme", "spongebob opening theme", "spongebob nose flute", "spongebob outro"],
};
const core = originals.map((tune) => {
  let time = 0;
  const events = tune.pitches.map((pitch, index) => {
    const note = { pitch, time, beats: tune.beats[index] }; time += note.beats; return note;
  });
  const score = compileClarinetPassage(events,
    tune.song === "weezer_buddy_holly" ? 121 : tune.song === "spongebob_nose_flute" ? 158 : 160);
  return { song: `core_${tune.song}`, title: tune.title, artists: ["Original Squd reference"], genre: "Familiar tune",
    aliases: aliases[tune.song] ?? [], score, passages: [score] };
});
await writeClarinetCollection(root, { id: "core", source: "https://www.stupideas.com/discord/squd/catalog.json", count: core.length }, core);
console.log(`Imported ${entries.length} modern/meme tunes and unified ${core.length} original references.`);
