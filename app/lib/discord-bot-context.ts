import type { DiscordBotPersona } from "@/lib/discord-bot-knowledge";
import { getDiscordImageUrls, MAX_DISCORD_INPUT_IMAGES } from "@/lib/discord-bot-vision";

const SNOWFLAKE = /^\d{17,20}$/;
const MAX_CONTEXT_BYTES = 48_000;
const MAX_MESSAGE_BYTES = 512;

export type DiscordConversationMessage = {
  role: "user" | "assistant";
  name: string;
  content: string;
  images?: string[];
};

type Mention = {
  id: string; channelId: string; authorId: string; authorIsBot?: boolean;
  referencedMessageId?: string; attachments?: unknown;
};
type BotContextIdentity = {
  persona?: DiscordBotPersona;
  peers?: { applicationId: string; persona: DiscordBotPersona; name: string }[];
};
type HistoryMessage = {
  id: string; channel_id: string; timestamp: string; content: string;
  author: { id: string; bot?: boolean }; type: number; webhook_id?: string;
  message_reference?: { message_id?: string };
  nonce?: string | number;
  attachments?: unknown;
};

function clipUtf8(text: string, maxBytes: number) {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  if (maxBytes < 4) return "";
  let result = "", used = 0;
  for (const character of text) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (used + bytes > maxBytes - 3) break;
    result += character; used += bytes;
  }
  return `${result}…`;
}

export function selectDiscordConversation(
  channelData: unknown, userData: unknown, message: Mention, botId: string, now = Date.now(), identity: BotContextIdentity = {},
): DiscordConversationMessage[] {
  const bots = new Map([
    [botId, `overlord ${identity.persona ?? "bob"}`],
    ...(identity.peers ?? []).map((peer) => [peer.applicationId, peer.name] as [string, string]),
  ]);
  const eligible = (data: unknown) => (Array.isArray(data) ? data : []).filter((item): item is HistoryMessage => {
    if (!item || typeof item !== "object") return false;
    const entry = item as HistoryMessage;
    const created = Date.parse(entry.timestamp);
    // Continuations use their stable nonce to identify the question without a reply header.
    const replyTo = entry.message_reference?.message_id
      ?? (typeof entry.nonce === "string" ? /^(\d{17,20}):[1-9]\d*$/.exec(entry.nonce)?.[1] : undefined);
    // A fast follow-up may arrive before Bob finishes answering the prior question.
    const completesEarlierQuestion = entry.author?.id === botId
      && typeof replyTo === "string" && SNOWFLAKE.test(replyTo) && BigInt(replyTo) < BigInt(message.id);
    return typeof entry.id === "string" && SNOWFLAKE.test(entry.id)
      && (BigInt(entry.id) < BigInt(message.id) || completesEarlierQuestion)
      && typeof entry.channel_id === "string" && SNOWFLAKE.test(entry.channel_id)
      && typeof entry.content === "string" && (!!entry.content.trim()
        || (!message.authorIsBot && !entry.author?.bot && entry.channel_id === message.channelId
          && getDiscordImageUrls(entry.attachments, message.channelId).length > 0))
      && !!entry.author && typeof entry.author.id === "string" && SNOWFLAKE.test(entry.author.id)
      && (!entry.author.bot || bots.has(entry.author.id)) && !entry.webhook_id
      && (entry.type === 0 || entry.type === 19) && Number.isFinite(created) && created <= now;
  }).sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
  const channel = eligible(channelData).filter((item) => item.channel_id === message.channelId);
  const referenced = channel.find((item) => item.id === message.referencedMessageId);
  // A directly replied-to image can be older than the channel window. Keep 25 total.
  const recent = referenced ? [referenced, ...channel.filter((item) => item.id !== referenced.id)].slice(0, 25) : channel.slice(0, 25);
  const previousUser = eligible(userData).filter((item) => !item.author.bot && item.author.id === message.authorId).slice(0, 10);
  // Prefer the direct channel response over search-index copies of the same message.
  const priority = new Map([
    ...previousUser,
    ...recent,
  ].map((item) => [item.id, item]));
  const participants = new Map<string, string>();
  const selected: { id: string; message: DiscordConversationMessage }[] = [];
  let remaining = MAX_CONTEXT_BYTES - 2;
  let remainingImages = MAX_DISCORD_INPUT_IMAGES - getDiscordImageUrls(message.attachments, message.channelId).length;
  const imageContext = new Map<string, string[]>();
  for (const entry of recent) {
    if (message.authorIsBot || entry.author.bot) continue;
    const images = getDiscordImageUrls(entry.attachments, message.channelId).slice(0, remainingImages);
    if (images.length) imageContext.set(entry.id, images);
    remainingImages -= images.length;
  }
  for (const entry of priority.values()) {
    const role = entry.author.id === botId ? "assistant" : "user";
    const botName = bots.get(entry.author.id);
    let name = botName ? botName.replaceAll(" ", "_") : "current_user";
    if (!botName && entry.author.id !== message.authorId) {
      if (!participants.has(entry.author.id)) participants.set(entry.author.id, `participant_${participants.size + 1}`);
      name = participants.get(entry.author.id)!;
    }
    const images = imageContext.get(entry.id) ?? [];
    const media = images.length ? { images } : {};
    const overhead = Buffer.byteLength(JSON.stringify({ role, name, content: "", ...media }), "utf8") + 1;
    if (remaining < overhead + 16) continue;
    const prefix = entry.channel_id === message.channelId ? "" : "[earlier message from another server channel]\n";
    const content = clipUtf8(prefix + (entry.content.trim() || "[uploaded image]")
      .replace(/<@!?(\d{17,20})>/g, (mention, id: string) => bots.get(id) ?? mention)
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim(),
    // JSON escaping can at most double the content bytes after control filtering.
    Math.min(MAX_MESSAGE_BYTES, Math.floor((remaining - overhead) / 2)));
    if (!content) continue;
    selected.push({ id: entry.id, message: { role, name, content, ...media } });
    remaining -= Buffer.byteLength(JSON.stringify({ role, name, content, ...media }), "utf8") + 1;
  }
  return selected.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1).map((item) => item.message);
}

export async function getDiscordConversation(
  message: Mention, config: { token: string; applicationId: string; guildId: string } & BotContextIdentity,
  includeCompletedReplies = false,
  channelOnly = false,
): Promise<DiscordConversationMessage[]> {
  async function readHistory(url: string, allowIndexRetry = false): Promise<unknown> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bot ${config.token}` },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
      });
      const data = await response.json();
      if (response.status === 202 && allowIndexRetry && attempt === 0) {
        const retryAfter = Number(data?.retry_after ?? 1);
        if (Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 2) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(100, retryAfter * 1_000)));
          continue;
        }
      }
      if (!response.ok || response.status === 202) throw new Error("History unavailable");
      return data;
    }
    throw new Error("History unavailable");
  }
  const query = new URLSearchParams({
    author_id: message.authorId, max_id: message.id, limit: "10", sort_by: "timestamp", sort_order: "desc",
  });
  const results = await Promise.allSettled([
    readHistory(`https://discord.com/api/v10/channels/${message.channelId}/messages?${includeCompletedReplies ? "" : `before=${message.id}&`}limit=25`),
    message.authorIsBot || channelOnly ? Promise.resolve({ messages: [] })
      : readHistory(`https://discord.com/api/v10/guilds/${config.guildId}/messages/search?${query}`, true),
  ]);
  if (results.some((result) => result.status === "rejected")) {
    // History is optional; never log conversation text or credentials.
    console.warn("Some Discord conversation context was unavailable");
  }
  const channel = results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [];
  const reference = message.referencedMessageId;
  if (!message.authorIsBot && reference && SNOWFLAKE.test(reference) && BigInt(reference) < BigInt(message.id)
    && !channel.some((entry) => entry?.id === reference)) {
    try {
      const referenced = await readHistory(`https://discord.com/api/v10/channels/${message.channelId}/messages/${reference}`);
      // Normal history validation also checks the channel, author, timestamp and message type.
      if (referenced && typeof referenced === "object" && "id" in referenced && referenced.id === reference) channel.push(referenced);
    } catch { /* Deleted or inaccessible reply targets are optional context. */ }
  }
  const search = results[1].status === "fulfilled" ? results[1].value as { messages?: unknown[][] } : null;
  const user = Array.isArray(search?.messages) ? search.messages.flat() : [];
  return selectDiscordConversation(channel, user, message, config.applicationId, Date.now(), config);
}
