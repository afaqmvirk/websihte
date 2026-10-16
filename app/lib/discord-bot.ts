import { timingSafeEqual } from "node:crypto";
import { getApplicationStorageConfig } from "@/lib/application-storage";
import { getDiscordConversation, type DiscordConversationMessage } from "@/lib/discord-bot-context";
import { DISCORD_BOT_SYSTEM_PROMPT } from "@/lib/discord-bot-knowledge";

const SNOWFLAKE = /^\d{17,20}$/;
const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const DISCORD_API = "https://discord.com/api/v10";
const MAX_QUESTION_LENGTH = 2_000;

export function getDiscordBotConfig() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim() || "";
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "1483863305360511016";
  const model = process.env.DISCORD_BOT_MODEL?.trim() || "gpt-6-luna";
  const dailyLimit = Number(process.env.DISCORD_BOT_DAILY_LIMIT || 100);
  const monthlyLimit = Number(process.env.DISCORD_BOT_MONTHLY_LIMIT || 1_000);
  const cooldownSeconds = Number(process.env.DISCORD_BOT_COOLDOWN_SECONDS || 15);
  const storage = getApplicationStorageConfig();
  if (process.env.DISCORD_BOT_ENABLED !== "true" || !token || token.length < 40 || /\s/.test(token)
    || !SNOWFLAKE.test(applicationId) || !SNOWFLAKE.test(guildId)
    || !process.env.OPENAI_API_KEY?.trim() || !/^[\w.-]+$/.test(model)
    || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1_000
    || !Number.isInteger(monthlyLimit) || monthlyLimit < 1 || monthlyLimit > 1_000
    || !Number.isInteger(cooldownSeconds) || cooldownSeconds < 1 || cooldownSeconds > 3_600
    || !storage) return null;
  return { token, applicationId, guildId, model, dailyLimit, monthlyLimit, cooldownSeconds, storage };
}

export type DiscordBotConfig = NonNullable<ReturnType<typeof getDiscordBotConfig>>;
export type DiscordMention = {
  id: string; guildId: string | null; channelId: string; authorId: string;
  content: string; authorIsBot: boolean; mentionedUserIds: string[];
};

export function isDiscordCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function questionFromMention(message: DiscordMention, config: DiscordBotConfig) {
  if (message.authorIsBot || message.guildId !== config.guildId
    || !message.mentionedUserIds.includes(config.applicationId)
    || ![message.id, message.channelId, message.authorId].every((id) => SNOWFLAKE.test(id))) return null;
  return message.content.replace(new RegExp(`<@!?${config.applicationId}>`, "g"), "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
}

async function claimMention(message: DiscordMention, config: DiscordBotConfig) {
  const response = await fetch(`${config.storage.url}/rest/v1/rpc/claim_discord_bot_request`, {
    method: "POST",
    headers: { apikey: config.storage.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_message_id: message.id, p_guild_id: message.guildId, p_user_id: message.authorId,
      p_daily_limit: config.dailyLimit, p_cooldown_seconds: config.cooldownSeconds,
      p_monthly_limit: config.monthlyLimit,
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Discord bot rate limit storage failed");
  return await response.json() as "accepted" | "duplicate" | "cooldown" | "daily_limit" | "monthly_limit";
}

async function recordReply(messageId: string, replyId: string | null, config: DiscordBotConfig) {
  try {
    const response = await fetch(`${config.storage.url}/rest/v1/discord_bot_requests?message_id=eq.${messageId}`, {
      method: "PATCH", headers: { apikey: config.storage.key, "Content-Type": "application/json" },
      body: JSON.stringify({ status: replyId ? "answered" : "failed", reply_message_id: replyId }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error("Could not track Discord bot reply", { status: response.status });
  } catch {
    console.error("Could not track Discord bot reply");
  }
}

function lowercaseReply(text: string) {
  // Lowercase speech without breaking case-sensitive URLs or executable code.
  return text.split(/(```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+)/gi)
    .map((part, index) => index % 2 ? part : part.toLowerCase()).join("");
}

export async function generateDiscordBotReply(question: string, model: string, history: DiscordConversationMessage[] = []) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OpenAI authentication is unavailable");
  const response = await fetch(OPENAI_API, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, reasoning_effort: "none", max_completion_tokens: 512, store: false,
      messages: [
        { role: "system", content: `${DISCORD_BOT_SYSTEM_PROMPT}\n\ntoday in ottawa: ${new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}.` },
        ...history,
        { role: "user", name: "current_user", content: question },
      ],
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenAI returned status ${response.status}`);
  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = lowercaseReply(result.choices?.[0]?.message?.content?.trim() || "");
  if (!text) throw new Error("OpenAI returned no answer");
  return text.length <= 1_900 ? text : `${text.slice(0, 1_899)}…`;
}

async function postReply(message: DiscordMention, content: string, config: DiscordBotConfig) {
  const body = JSON.stringify({
    content: lowercaseReply(content), allowed_mentions: { parse: [], replied_user: false },
    message_reference: { message_id: message.id, fail_if_not_exists: false },
    nonce: message.id, enforce_nonce: true,
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    let delay = 300 * (attempt + 1);
    try {
      const response = await fetch(`${DISCORD_API}/channels/${message.channelId}/messages`, {
        method: "POST", headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" },
        body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => null) as { id?: string; retry_after?: number } | null;
      if (response.ok && result?.id) return result.id;
      if (response.status !== 429 && response.status < 500) return null;
      if (response.status === 429) {
        const retryAfter = Number(result?.retry_after ?? 1);
        if (!Number.isFinite(retryAfter) || retryAfter < 0 || retryAfter > 3) return null;
        delay = Math.ceil(retryAfter * 1_000);
      }
    } catch {
      // Never log errors that might contain bot credentials or message text.
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

export async function handleDiscordMention(message: DiscordMention, config: DiscordBotConfig) {
  const question = questionFromMention(message, config);
  if (question === null) return "ignored";
  let claimed = false;
  try {
    const claim = await claimMention(message, config);
    if (claim === "duplicate" || claim === "cooldown") return claim;
    if (claim === "daily_limit") {
      await postReply(message, "uhhhh iunno. bob's daily brain budget is gone. try tomorrow (utc).", config);
      return claim;
    }
    if (claim === "monthly_limit") {
      await postReply(message, "uhhhh iunno. bob's monthly brain budget is gone. ask an organizer or try next month (utc).", config);
      return claim;
    }
    if (claim !== "accepted") throw new Error("Unrecognized bot admission result");
    claimed = true;
    let answer: string;
    if (!question) answer = "uhhhh iunno";
    else if (question.length > MAX_QUESTION_LENGTH) answer = "uhhhh iunno. keep it under 2,000 characters, mortal.";
    else answer = await generateDiscordBotReply(question, config.model, await getDiscordConversation(message, config));
    const replyId = await postReply(message, answer, config);
    await recordReply(message.id, replyId, config);
    return replyId ? "answered" : "failed";
  } catch {
    console.error("Discord bot could not complete a mention", { messageId: message.id });
    if (claimed) {
      await postReply(message, "uhhhh iunno. brain not working. try again in a bit.", config);
      await recordReply(message.id, null, config);
    }
    return "failed";
  }
}
