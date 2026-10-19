import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = "https://www.youtube.com/watch?v=MnURI2mo6Wg";
const target = "public/discord/gerald";
const rate = 48_000;
const temporary = await mkdtemp(join(tmpdir(), "gerald-meow-"));
const run = (command, args) => execFileSync(command, args, { windowsHide: true, maxBuffer: 4_000_000 });
const downloaded = run("yt-dlp", ["--js-runtimes", "node", "--no-playlist", "-f", "bestaudio",
  "--no-progress", "--print", "after_move:filepath", "-o", join(temporary, "source.%(ext)s"), source])
  .toString().trim().split(/\r?\n/).at(-1);
if (!downloaded) throw new Error("yt-dlp did not return an audio file");
await mkdir(target, { recursive: true });
const file = "deep-meow.ogg";
run("ffmpeg", ["-v", "error", "-y", "-i", downloaded, "-vn", "-map_metadata", "-1",
  "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libopus", "-b:a", "48k",
  "-ac", "1", "-ar", String(rate), join(target, file)]);
const pcm = run("ffmpeg", ["-v", "error", "-xerror", "-i", join(target, file),
  "-f", "s16le", "-ac", "1", "-ar", String(rate), "pipe:1"]);
const samples = Array.from({ length: pcm.length / 2 }, (_, index) => pcm.readInt16LE(index * 2));
if (!samples.some((sample) => sample !== 0)) throw new Error("The downloaded meow is silent");
const waveform = [];
for (let start = 0; start < samples.length; start += rate / 10) {
  const segment = samples.slice(start, start + rate / 10);
  waveform.push(Math.min(255, Math.round(Math.sqrt(segment.reduce((sum, sample) => sum + sample * sample, 0) / segment.length) / 40)));
}
await writeFile(join(target, "deep-meow.json"), JSON.stringify({ file, source,
  duration: samples.length / rate, waveform: Buffer.from(waveform).toString("base64") }, null, 2) + "\n");
console.log(`Saved Gerald's deep meow and voice metadata to ${target}`);
