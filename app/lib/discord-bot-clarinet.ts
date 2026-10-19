import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import catalog from "../../public/discord/squd/catalog.json";

export type DiscordVoiceClip = { bytes: Uint8Array; filename: string; contentType: string; duration: number; waveform: string };

export const SQUD_CLARINET_SONGS = [...new Set(catalog.map((clip) => clip.song))];

export function getSqudClarinet(messageId: string, song: string | null = null) {
  const choices = song === null ? catalog : catalog.filter((clip) => clip.song === song);
  if (!choices.length) throw new Error("Unknown clarinet song");
  const ticket = createHash("sha256").update(`squd-clarinet:${messageId}`).digest().readUInt32BE(0);
  return choices[ticket % choices.length];
}

export async function loadSqudClarinet(messageId: string, song: string | null = null): Promise<DiscordVoiceClip> {
  const clip = getSqudClarinet(messageId, song);
  const bytes = await readFile(join(process.cwd(), "public/discord/squd", clip.file));
  if (bytes.length < 32 || bytes.length > 500_000 || bytes.subarray(0, 4).toString() !== "OggS"
    || !bytes.includes(Buffer.from("OpusHead"))) throw new Error("Clarinet clip is unavailable");
  return { bytes, filename: clip.file, contentType: "audio/ogg", duration: clip.duration, waveform: clip.waveform };
}
