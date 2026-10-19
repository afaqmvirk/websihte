import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Original procedural melodies and a small clarinet-like synthesizer; no soundfont needed.
const rate = 48_000;
const target = "public/discord/squd";
const temporary = ".vercel/verification/squd-audio";
await mkdir(target, { recursive: true });
await mkdir(temporary, { recursive: true });
const catalog = [];
function variable(value) {
  const bytes = [value & 127];
  while ((value >>= 7)) bytes.unshift((value & 127) | 128);
  return bytes;
}
for (let variant = 0; variant < 32; variant++) {
  let state = createHash("sha256").update(`squd-clarinet-v1:${variant}`).digest().readUInt32BE(0);
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const notes = Array.from({ length: 10 + Math.floor(random() * 7) }, () => ({
    pitch: 60 + Math.floor(random() * 22), ticks: [120, 240, 360][Math.floor(random() * 3)], velocity: 60 + Math.floor(random() * 35),
  }));
  const events = [0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0xc0, 71]; // GM clarinet, program 72 (1-based).
  const samples = [];
  for (const note of notes) {
    events.push(0, 0x90, note.pitch, note.velocity, ...variable(note.ticks), 0x80, note.pitch, 0, ...variable(60), 0xff, 1, 0);
    const seconds = note.ticks / 960;
    const length = Math.round(seconds * rate);
    const frequency = 440 * 2 ** ((note.pitch - 69) / 12);
    for (let index = 0; index < length; index++) {
      const time = index / rate;
      const envelope = Math.min(1, time / 0.018, (seconds - time) / 0.04);
      const phase = 2 * Math.PI * frequency * time + 0.07 * Math.sin(2 * Math.PI * 5 * time);
      const tone = Math.sin(phase) + 0.42 * Math.sin(phase * 3) + 0.16 * Math.sin(phase * 5) + 0.05 * Math.sin(phase * 7);
      samples.push(Math.round(10_000 * (note.velocity / 94) * Math.max(0, envelope) * tone));
    }
    samples.push(...Array(Math.round(rate / 16)).fill(0));
  }
  samples.push(...Array(Math.round(rate * 0.15)).fill(0));
  events.push(0, 0xff, 0x2f, 0);
  const header = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0]);
  const track = Buffer.alloc(8); track.write("MTrk"); track.writeUInt32BE(events.length, 4);
  const stem = `clarinet-${String(variant + 1).padStart(2, "0")}`;
  await writeFile(join(target, `${stem}.mid`), Buffer.concat([header, track, Buffer.from(events)]));
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + index * 2));
  const wavPath = join(temporary, `${stem}.wav`);
  await writeFile(wavPath, wav);
  const encode = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", wavPath, "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libopus", "-b:a", "32k", "-ac", "1", "-ar", String(rate), "-serial_offset", String(variant), join(target, `${stem}.ogg`)], { encoding: "utf8", windowsHide: true });
  if (encode.status !== 0) throw new Error(`Clarinet encoding failed: ${encode.stderr}`);
  const waveform = [];
  for (let start = 0; start < samples.length; start += rate / 10) {
    const segment = samples.slice(start, start + rate / 10);
    waveform.push(Math.min(255, Math.round(Math.sqrt(segment.reduce((sum, sample) => sum + sample * sample, 0) / segment.length) / 40)));
  }
  catalog.push({ file: `${stem}.ogg`, midi: `${stem}.mid`, duration: samples.length / rate, waveform: Buffer.from(waveform).toString("base64") });
}
await writeFile(join(target, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`Generated ${catalog.length} deterministic clarinet MIDI files and Discord-compatible Opus previews`);
