import { createHash } from "node:crypto";

export const MAX_IMAGE_PROMPT_LENGTH = 800;
const MAX_IMAGE_BYTES = 4_000_000;

export type DiscordGeneratedImage = { bytes: Uint8Array; filename: string; contentType: string };

export function getDiscordImageConfig() {
  if (process.env.DISCORD_BOT_IMAGES_ENABLED === "false" || !process.env.OPENAI_API_KEY?.trim()) return null;
  const dailyLimit = Number(process.env.DISCORD_BOT_IMAGE_DAILY_LIMIT || 25);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) return null;
  return { dailyLimit };
}

export async function generateDiscordImage(prompt: string, userId: string): Promise<DiscordGeneratedImage> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || !getDiscordImageConfig() || !prompt.trim() || prompt.length > MAX_IMAGE_PROMPT_LENGTH) {
    throw new Error("Image generation is unavailable");
  }
  // A landscape draft at the minimum pixel count costs less than the square default.
  // The model cannot request more images or higher settings.
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2.5-flare", prompt: prompt.trim(), n: 1, quality: "low",
      size: "1024x640", output_format: "jpeg", output_compression: 60, moderation: "auto",
      safety_identifier: createHash("sha256").update(`discord:${userId}`).digest("hex"),
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Image generation returned status ${response.status}`);
  const result = await response.json() as { data?: { b64_json?: unknown }[] };
  const encoded = result.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4
    || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Image generation returned invalid image data");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 4 || bytes.length > MAX_IMAGE_BYTES
    || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error("Image generation did not return a JPEG");
  }
  return { bytes, filename: "overlord-drawing.jpg", contentType: "image/jpeg" };
}
