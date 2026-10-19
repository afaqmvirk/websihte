import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DiscordGeneratedImage } from "@/lib/discord-bot-image";

export const KRAB_MONEY_PHOTOS = [
  "money-1.jpg", "money-2.jpg", "money-3.jpg", "money-4.jpg",
  "money-5.jpg", "money-6.jpg", "money-7.jpg",
] as const;

export function getKrabMoneyPhoto(messageId: string) {
  const digest = createHash("sha256").update(`krab-photo:${messageId}`).digest();
  return digest.readUInt32BE(0) % 5 === 0
    ? KRAB_MONEY_PHOTOS[digest.readUInt32BE(4) % KRAB_MONEY_PHOTOS.length] : null;
}

export async function generateKrabAnswer(messageId: string): Promise<{ text: string; image?: DiscordGeneratedImage }> {
  const photo = getKrabMoneyPhoto(messageId);
  if (photo) {
    try {
      const bytes = await readFile(join(process.cwd(), "public/discord/krab", photo));
      if (bytes.length >= 4 && bytes.length <= 4_000_000 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { text: "", image: { bytes, filename: `krab-${photo}`, contentType: "image/jpeg" } };
      }
    } catch {
      // Keep the usual money reply if a bundled photo cannot be read.
    }
  }
  return { text: generateKrabReply(messageId) };
}

export function generateKrabReply(messageId: string) {
  // The same message always gets the same reply. Counts 1..32 have weights 32..1.
  const digest = createHash("sha256").update(messageId).digest();
  let ticket = digest.readUInt32BE(0) % 528; // 32 + 31 + ... + 1
  for (let count = 1; count < 32; count++) {
    const weight = 33 - count;
    if (ticket < weight) return Array(count).fill("money").join(" ");
    ticket -= weight;
  }
  return Array(32).fill("money").join(" ");
}
