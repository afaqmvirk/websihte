import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseClarinetScore, type ClarinetScore } from "./discord-bot-clarinet-score";
import { loadSqudClarinet, type DiscordVoiceClip } from "./discord-bot-clarinet";

const OpusScript = createRequire(import.meta.url)("opusscript") as typeof import("opusscript");
const rate = 48_000, frameSize = 960, preSkip = 312;
const samples = new Map<number, Promise<Int16Array>>();

function sample(pitch: number) {
  let pending = samples.get(pitch);
  if (!pending) {
    pending = readFile(join(process.cwd(), "public/discord/squd/samples", `${pitch}.pcm`)).then((bytes) => {
      if (bytes.length !== 129_600) throw new Error("Invalid clarinet sample");
      return Int16Array.from({ length: bytes.length / 2 }, (_, index) => bytes.readInt16LE(index * 2));
    }).catch((error) => { samples.delete(pitch); throw error; });
    samples.set(pitch, pending);
  }
  return pending;
}

function oggPage(packet: Buffer, sequence: number, granule: number, serial: number, flags = 0) {
  const segments = Array(Math.floor(packet.length / 255)).fill(255).concat(packet.length % 255);
  const page = Buffer.alloc(27 + segments.length + packet.length);
  page.write("OggS"); page[5] = flags;
  page.writeBigUInt64LE(BigInt(granule), 6); page.writeUInt32LE(serial, 14); page.writeUInt32LE(sequence, 18);
  page[26] = segments.length; page.set(segments, 27); page.set(packet, 27 + segments.length);
  let crc = 0;
  for (const byte of page) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc >>> 31) ? 0x04c11db7 : 0)) >>> 0;
  }
  page.writeUInt32LE(crc, 22);
  return page;
}

export function encodeClarinetOpus(pcm: Int16Array, serial: number): Buffer {
  const head = Buffer.alloc(19); head.write("OpusHead"); head[8] = 1; head[9] = 1;
  head.writeUInt16LE(preSkip, 10); head.writeUInt32LE(rate, 12);
  const vendor = Buffer.from("squd clarinet"), vendorLength = Buffer.alloc(4); vendorLength.writeUInt32LE(vendor.length);
  const tags = Buffer.concat([Buffer.from("OpusTags"), vendorLength, vendor, Buffer.alloc(4)]);
  const pages = [oggPage(head, 0, 0, serial, 2), oggPage(tags, 1, 0, serial)];
  const encoder = new OpusScript(rate, 1, OpusScript.Application.AUDIO);
  try {
    encoder.setBitrate(32_000);
    const frames = Math.ceil((pcm.length + preSkip) / frameSize);
    for (let frame = 0; frame < frames; frame++) {
      const input = Buffer.alloc(frameSize * 2);
      for (let offset = 0; offset < frameSize && frame * frameSize + offset < pcm.length; offset++) input.writeInt16LE(pcm[frame * frameSize + offset], offset * 2);
      const last = frame === frames - 1;
      pages.push(oggPage(encoder.encode(input, frameSize), frame + 2, last ? pcm.length + preSkip : (frame + 1) * frameSize, serial, last ? 4 : 0));
    }
  } finally { encoder.delete(); }
  return Buffer.concat(pages);
}

export async function renderClarinetScore(input: ClarinetScore, messageId: string): Promise<DiscordVoiceClip> {
  const score = parseClarinetScore(input);
  const seed = createHash("sha256").update(`squd-live-clarinet:${messageId}`).digest();
  let state = seed.readUInt32BE(0);
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const pitches = [...new Set(score.notes.flatMap((note) => note.pitch === null ? [] : [note.pitch, Math.min(100, note.pitch + 19)]))];
  const bank = new Map(await Promise.all(pitches.map(async (pitch) => [pitch, await sample(pitch)] as const)));
  const output: number[] = [];
  for (const [index, note] of score.notes.entries()) {
    const length = Math.round(note.beats * 60 / score.tempo_bpm * rate * (0.94 + random() * 0.1));
    if (note.pitch === null) { output.push(...Array(length).fill(0)); continue; }
    const body = bank.get(note.pitch)!, squeak = bank.get(Math.min(100, note.pitch + 19))!;
    const volume = 0.68 + random() * 0.3, cents = (random() - 0.5) * 38;
    const overblow = index % 5 === 3, wobble = 4.8 + random();
    let position = 0;
    for (let frame = 0; frame < length; frame++) {
      position += 2 ** ((cents + 17 * Math.sin(2 * Math.PI * wobble * frame / rate)) / 1200);
      const low = Math.floor(position), fraction = position - low;
      const normal = (body[low] ?? 0) * (1 - fraction) + (body[low + 1] ?? 0) * fraction;
      const squeakMix = overblow ? Math.max(0, Math.min(1, (frame / rate - 0.045) / 0.01, (0.125 - frame / rate) / 0.01)) : 0;
      const envelope = Math.max(0, Math.min(1, frame / (rate * 0.004), (length - frame) / (rate * 0.025)));
      output.push((normal * (1 - squeakMix) + (squeak[frame] ?? 0) * squeakMix) * volume * envelope);
    }
    output.push(...Array(Math.round(rate * (0.02 + random() * 0.025))).fill(0));
  }
  output.push(...Array(rate / 10).fill(0));
  if (output.length > rate * 10) throw new Error("Clarinet performance is too long");
  const peak = output.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (!peak) throw new Error("Silent clarinet performance");
  const rms = Math.sqrt(output.reduce((sum, value) => sum + value * value, 0) / output.length);
  const gain = Math.min(0.78 * 32767 / peak, 0.16 * 32767 / rms);
  const pcm = Int16Array.from(output, (value) => Math.round(value * gain));
  const waveform = [];
  for (let start = 0; start < pcm.length; start += rate / 10) {
    const end = Math.min(pcm.length, start + rate / 10);
    let sum = 0; for (let index = start; index < end; index++) sum += pcm[index] ** 2;
    waveform.push(Math.min(255, Math.round(Math.sqrt(sum / (end - start)) / 40)));
  }
  return { bytes: encodeClarinetOpus(pcm, seed.readUInt32BE(4)), filename: `clarinet-live-${seed.subarray(0, 6).toString("hex")}.ogg`,
    contentType: "audio/ogg", duration: pcm.length / rate, waveform: Buffer.from(waveform).toString("base64") };
}

export async function createClarinetPerformance(score: ClarinetScore, messageId: string, fallbackSong?: string,
  render = renderClarinetScore): Promise<DiscordVoiceClip> {
  try { return await render(score, messageId); }
  catch (error) {
    if (fallbackSong) return loadSqudClarinet(messageId, fallbackSong);
    throw error;
  }
}
