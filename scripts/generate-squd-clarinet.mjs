import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Hand-sequenced short tune excerpts, deliberately played badly.
// Render with a sampled clarinet instead of an oscillator approximation.
// GeneralUser GS 2.0.3 by S. Christian Collins; see scripts/licenses/GeneralUser-GS.txt.
const rate = 48_000;
const target = "public/discord/squd";
const temporary = ".vercel/verification/squd-audio";
const soundfont = process.env.SQUD_CLARINET_SOUNDFONT;
const synthesizer = process.env.FLUIDSYNTH_BIN || "fluidsynth";
const encoder = process.env.FFMPEG_BIN || "ffmpeg";
if (!soundfont) throw new Error("Set SQUD_CLARINET_SOUNDFONT to GeneralUser GS 2.0.3.sf2; see README");
if (createHash("sha256").update(await readFile(soundfont)).digest("hex") !== "9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe") {
  throw new Error("Expected the pinned GeneralUser GS 2.0.3 SoundFont; see README");
}
await mkdir(target, { recursive: true });
await mkdir(temporary, { recursive: true });
const catalog = [];
// Pitches are MIDI numbers; durations are quarter-note beats. No third-party
// recordings or vocals are used. Append groups to preserve existing clip IDs/seeds.
const tuneGroups = [[
  { title: "Twinkle Twinkle Little Star", pitches: [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60], beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2] },
  { title: "Mary Had a Little Lamb", pitches: [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67], beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2] },
  { title: "Frere Jacques", pitches: [60, 62, 64, 60, 60, 62, 64, 60, 64, 65, 67, 64, 65, 67], beats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2] },
  { title: "Ode to Joy", pitches: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62], beats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2] },
  { title: "Jingle Bells", pitches: [64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64], beats: [1, 1, 2, 1, 1, 2, 1, 1, 1.5, 0.5, 4] },
  { title: "London Bridge Is Falling Down", pitches: [67, 69, 67, 65, 64, 65, 67, 62, 64, 65, 64, 65, 67], beats: [1.5, 0.5, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2] },
  { title: "Old MacDonald Had a Farm", pitches: [67, 67, 67, 62, 64, 64, 62, 71, 71, 69, 69, 67], beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 4] },
  { title: "Happy Birthday", pitches: [67, 67, 69, 67, 72, 71, 67, 67, 69, 67, 74, 72], beats: [0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 2] },
], [
  // Only the short instrumental motifs, not either complete song/theme.
  { id: "weezer_buddy_holly", title: "Weezer Buddy Holly lick", tempoBpm: 121, keepMelody: true,
    pitches: [80, 75, 80, 82, 83, 82, 80, 76, 75], beats: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1] },
  { id: "spongebob_nose_flute", title: "SpongeBob nose-flute outro", tempoBpm: 158, keepMelody: true,
    pitches: [79, 81, 83, 81, 83, 79, 74, 79], beats: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.5, 1] },
]];
const tunes = tuneGroups.flat();
await writeFile("app/lib/discord-bot-clarinet-tunes.json", JSON.stringify(tunes.map((tune) => ({
  song: tune.id ?? tune.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"), title: tune.title, pitches: tune.pitches, beats: tune.beats,
})), null, 2) + "\n");
const performances = tuneGroups.flatMap((group) => Array.from({ length: 4 }, (_, take) => group.map((tune) => ({ tune, take }))).flat());
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { windowsHide: true, maxBuffer: 4_000_000, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr?.toString()}`);
  return result.stdout;
}
function variable(value) {
  const bytes = [value & 127];
  while ((value >>= 7)) bytes.unshift((value & 127) | 128);
  return bytes;
}
for (const [variant, { tune, take }] of performances.entries()) {
  let state = createHash("sha256").update(`squd-clarinet-v3:${variant}`).digest().readUInt32BE(0);
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const tempoBpm = (tune.tempoBpm ?? 154) + Math.floor(random() * (tune.keepMelody ? 13 : 29)) - (tune.keepMelody ? 6 : 0);
  const transpose = take % 2 === 1 ? 2 : 0;
  const notes = tune.pitches.map((originalPitch, index) => {
    // Preserve the opening motif, then stumble on occasional notes and timing.
    const wrongNote = !tune.keepMelody && index > 3 && random() < 0.16 ? (random() < 0.5 ? -1 : 1) : 0;
    return { pitch: originalPitch + transpose + wrongNote,
      ticks: Math.max(160, Math.round(tune.beats[index] * 480 * (0.82 + random() * 0.35))), velocity: 75 + Math.floor(random() * 43),
      rest: !tune.keepMelody && index > 7 && random() < 0.08,
      // A clarinet's register break overblows a twelfth. Each phrase has several squeaks.
      squeak: tune.keepMelody ? index === Math.floor(tune.pitches.length / 2) : index % 4 === 2,
      bend: 8192 + Math.floor((random() - 0.5) * 2600), vibrato: 8 + Math.floor(random() * 24) };
  });
  const tempo = Buffer.alloc(3); tempo.writeUIntBE(Math.round(60_000_000 / tempoBpm), 0, 3);
  const events = [0, 0xff, 0x51, 3, ...tempo, 0, 0xc0, 71, 0, 0xb0, 7, 110]; // GM clarinet, program 72 (1-based).
  let ticks = 0;
  for (const note of notes) {
    if (note.rest) {
      events.push(...variable(note.ticks + 36), 0xe0, 0, 64);
      ticks += note.ticks + 36;
      continue;
    }
    events.push(0, 0xe0, note.bend & 127, note.bend >> 7, 0, 0xb0, 1, note.vibrato, 0, 0x90, note.pitch, note.velocity);
    if (note.squeak) {
      const upper = Math.min(100, note.pitch + 19);
      events.push(...variable(48), 0x80, note.pitch, 0, 0, 0x90, upper, 120,
        ...variable(96), 0x80, upper, 0, 0, 0x90, note.pitch, note.velocity,
        ...variable(note.ticks - 144), 0x80, note.pitch, 0);
    } else {
      events.push(...variable(note.ticks), 0x80, note.pitch, 0);
    }
    events.push(...variable(36), 0xe0, 0, 64);
    ticks += note.ticks + 36;
  }
  events.push(...variable(240), 0xff, 0x2f, 0);
  const header = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0]);
  const track = Buffer.alloc(8); track.write("MTrk"); track.writeUInt32BE(events.length, 4);
  const stem = `clarinet-${String(variant + 1).padStart(2, "0")}`;
  const midiPath = join(target, `${stem}.mid`);
  await writeFile(midiPath, Buffer.concat([header, track, Buffer.from(events)]));
  const renderedPath = join(temporary, `${stem}-rendered.wav`);
  run(synthesizer, ["-ni", "-q", "-R", "0", "-C", "0", "-r", String(rate), "-g", "0.7",
    "-o", "player.timing-source=sample", "-o", "synth.cpu-cores=1", "-F", renderedPath, "-T", "wav", "-O", "s16", soundfont, midiPath]);
  const pcm = run(encoder, ["-v", "error", "-i", renderedPath, "-t", String(ticks / 480 * 60 / tempoBpm + 0.25),
    "-af", "highpass=f=100,equalizer=f=1900:t=q:w=1.1:g=2.5", "-f", "s16le", "-ac", "1", "-ar", String(rate), "pipe:1"]);
  const samples = Array.from({ length: pcm.length / 2 }, (_, index) => pcm.readInt16LE(index * 2));
  const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
  if (peak === 0 || rms === 0) throw new Error(`Silent clarinet render: ${stem}`);
  const gain = Math.min(0.78 * 32767 / peak, 0.16 * 32767 / rms);
  samples.forEach((sample, index) => { samples[index] = Math.round(sample * gain); });
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + index * 2));
  const wavPath = join(temporary, `${stem}.wav`);
  await writeFile(wavPath, wav);
  const encodedPath = join(temporary, `${stem}.ogg`);
  run(encoder, ["-v", "error", "-y", "-i", wavPath, "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libopus", "-b:a", "32k", "-ac", "1", "-ar", String(rate), "-serial_offset", String(variant), encodedPath]);
  await writeFile(join(target, `${stem}.ogg`), await readFile(encodedPath));
  const waveform = [];
  for (let start = 0; start < samples.length; start += rate / 10) {
    const segment = samples.slice(start, start + rate / 10);
    waveform.push(Math.min(255, Math.round(Math.sqrt(segment.reduce((sum, sample) => sum + sample * sample, 0) / segment.length) / 40)));
  }
  catalog.push({ song: tune.id ?? tune.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"), title: tune.title,
    file: `${stem}.ogg`, midi: `${stem}.mid`, duration: samples.length / rate, waveform: Buffer.from(waveform).toString("base64") });
}
await writeFile(join(target, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`Generated ${catalog.length} deterministic bad clarinet renditions of ${tunes.length} familiar tunes`);
