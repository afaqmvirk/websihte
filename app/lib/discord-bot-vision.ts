export const MAX_DISCORD_INPUT_IMAGES = 4;
export const MAX_DISCORD_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;

export type DiscordImageAttachment = {
  id: string; url: string; size: number; content_type?: string | null;
  width?: number | null; height?: number | null;
};

export function getDiscordImageUrls(attachments: unknown, channelId: string): string[] {
  if (!Array.isArray(attachments)) return [];
  const urls = new Set<string>();
  for (const attachment of attachments.slice(0, 10)) {
    if (!attachment || typeof attachment !== "object") continue;
    const { id, url, size, content_type: contentType, width, height } = attachment;
    if (typeof id !== "string" || !/^\d{17,20}$/.test(id)
      || typeof url !== "string" || url.length > 2_048
      || !Number.isInteger(size) || size < 1 || size > MAX_DISCORD_INPUT_IMAGE_BYTES
      || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1
      || (contentType != null && (typeof contentType !== "string" || !/^image\/(?:png|jpeg|webp)$/i.test(contentType)))) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash
        || !["cdn.discordapp.com", "media.discordapp.net"].includes(parsed.hostname)
        || !parsed.pathname.startsWith(`/attachments/${channelId}/${id}/`)
        || !/^\/attachments\/\d{17,20}\/\d{17,20}\/[^/]+\.(?:png|jpe?g|webp)$/i.test(parsed.pathname)) continue;
      // Keep Discord's signed query intact; never download arbitrary user URLs.
      urls.add(url);
      if (urls.size === MAX_DISCORD_INPUT_IMAGES) break;
    } catch { /* Malformed attachments are optional context. */ }
  }
  return [...urls];
}

type VisionMessage = { role: "user" | "assistant"; name: string; content: string; images?: string[] };

export function discordMessagesWithImages(messages: VisionMessage[]) {
  const seen = new Set<string>();
  // Give the current question first choice, then the newest channel images.
  return messages.toReversed().map(({ images, ...message }) => {
    const selected = message.role === "user" ? (images ?? []).filter((url) => {
      // Query signatures may differ for the same Discord attachment.
      const key = url.split("?")[0];
      if (seen.size === MAX_DISCORD_INPUT_IMAGES || seen.has(key)) return false;
      seen.add(key);
      return true;
    }) : [];
    return {
      ...message,
      content: selected.length ? [
        { type: "text" as const, text: message.content || "[uploaded image]" },
        ...selected.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "auto" as const } })),
      ] : message.content,
    };
  }).reverse();
}
