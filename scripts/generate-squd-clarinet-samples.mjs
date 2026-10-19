import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Build instrument samples, not melodies. Luna can arrange these into new phrases
// in the Node runtime without shipping FluidSynth, FFmpeg, or the entire SoundFont.
const soundfont = process.env.SQUD_CLARINET_SOUNDFONT;
if (!soundfont || createHash("sha256").update(await readFile(soundfont)).digest("hex") !== "9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe") throw new Error("Set SQUD_CLARINET_SOUNDFONT to the pinned GeneralUser GS 2.0.3 SoundFont");
const output = "public/discord/squd/samples";
const scratch = ".vercel/verification/squd-samples";
await mkdir(output, { recursive: true }); await mkdir(scratch, { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { windowsHide: true, maxBuffer: 1_000_000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.toString());
  return result.stdout;
}
for (let pitch = 55; pitch <= 100; pitch++) {
  const events = Buffer.from([0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0xc0, 71,
    0, 0x90, pitch, 110, 0x89, 0x30, 0x80, pitch, 0, 0x81, 0x70, 0xff, 0x2f, 0]);
  const header = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0]);
  const track = Buffer.alloc(8); track.write("MTrk"); track.writeUInt32BE(events.length, 4);
  const midi = join(scratch, `${pitch}.mid`), wav = join(scratch, `${pitch}.wav`);
  await writeFile(midi, Buffer.concat([header, track, events]));
  run(process.env.FLUIDSYNTH_BIN || "fluidsynth", ["-ni", "-q", "-R", "0", "-C", "0", "-r", "48000", "-g", "0.7",
    "-o", "player.timing-source=sample", "-o", "synth.cpu-cores=1", "-F", wav, "-T", "wav", "-O", "s16", soundfont, midi]);
  const pcm = run(process.env.FFMPEG_BIN || "ffmpeg", ["-v", "error", "-i", wav, "-t", "1.35",
    "-af", "highpass=f=100,equalizer=f=1900:t=q:w=1.1:g=2.5", "-f", "s16le", "-ac", "1", "-ar", "48000", "pipe:1"]);
  let peak = 0;
  for (let offset = 0; offset < pcm.length; offset += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(offset)));
  if (!peak) throw new Error(`Silent clarinet sample ${pitch}`);
  for (let offset = 0; offset < pcm.length; offset += 2) pcm.writeInt16LE(Math.round(pcm.readInt16LE(offset) * 24000 / peak), offset);
  await writeFile(join(output, `${pitch}.pcm`), pcm);
}
await copyFile("scripts/licenses/GeneralUser-GS.txt", join(output, "LICENSE.txt"));
console.log("Generated 46 sampled clarinet notes as mono 48 kHz signed 16-bit PCM");
