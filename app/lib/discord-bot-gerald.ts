import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DiscordVoiceClip } from "@/lib/discord-bot-clarinet";
import deepMeow from "../../public/discord/gerald/deep-meow.json";

export function shouldGeraldDeepMeow(messageId: string) {
  const ticket = createHash("sha256").update(`gerald-deep-meow:${messageId}`).digest().readUInt32BE(0);
  return ticket % 5 === 0;
}

export async function generateGeraldAnswer(messageId: string): Promise<{ text: string; voice?: DiscordVoiceClip }> {
  if (shouldGeraldDeepMeow(messageId)) {
    try {
      const bytes = await readFile(join(process.cwd(), "public/discord/gerald", deepMeow.file));
      if (bytes.length >= 32 && bytes.length <= 500_000 && bytes.subarray(0, 4).toString() === "OggS"
        && bytes.includes(Buffer.from("OpusHead"))) {
        return { text: "", voice: { bytes, filename: deepMeow.file, contentType: "audio/ogg",
          duration: deepMeow.duration, waveform: deepMeow.waveform } };
      }
    } catch {
      // An unavailable clip keeps Gerald's usual text reply.
    }
  }
  return { text: generateGeraldReply(messageId) };
}

export function generateGeraldReply(messageId: string) {
  // Random-looking per message, but repeatable across retries and overlapping listeners.
  const digest = createHash("sha512").update(`gerald:${messageId}`).digest();
  let ticket = digest.readUInt32BE(0) % 528;
  let count = 1;
  for (; count < 32; count++) {
    const weight = 33 - count;
    if (ticket < weight) break;
    ticket -= weight;
  }
  const sounds = ["meow", "miau", "mrow"];
  return Array.from({ length: count }, (_, index) => sounds[digest[index + 4] % sounds.length]).join(" ");
}
