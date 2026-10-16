import { timingSafeEqual } from "node:crypto";
import { getApplicationStorageConfig } from "@/lib/application-storage";
import { getDiscordConversation, type DiscordConversationMessage } from "@/lib/discord-bot-context";
import { DISCORD_BOT_SYSTEM_PROMPT } from "@/lib/discord-bot-knowledge";

const SNOWFLAKE = /^\d{17,20}$/;
const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const DISCORD_API = "https://discord.com/api/v10";
const MAX_QUESTION_LENGTH = 2_000;
const userQueues = new Map<string, Promise<unknown>>();
const REACTION_EMOJI = ["💀", "😭", "😂", "🫡", "👀", "🤨", "🤔", "🔥", "👍", "❤️", "😴", "🙄", "🗿"];
type DiscordBotReply = { text: string; reaction?: string };

export function getDiscordBotConfig() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim() || "";
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "1483863305360511016";
  const model = process.env.DISCORD_BOT_MODEL?.trim() || "gpt-6-luna";
  const dailyLimit = Number(process.env.DISCORD_BOT_DAILY_LIMIT || 100);
  const monthlyLimit = Number(process.env.DISCORD_BOT_MONTHLY_LIMIT || 1_000);
  const cooldownSeconds = Number(process.env.DISCORD_BOT_COOLDOWN_SECONDS || 2);
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

async function recordReply(messageId: string, replyId: string | null, config: DiscordBotConfig, answered = !!replyId) {
  try {
    const response = await fetch(`${config.storage.url}/rest/v1/discord_bot_requests?message_id=eq.${messageId}`, {
      method: "PATCH", headers: { apikey: config.storage.key, "Content-Type": "application/json" },
      body: JSON.stringify({ status: answered ? "answered" : "failed", reply_message_id: replyId }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error("Could not track Discord bot reply", { status: response.status });
  } catch {
    console.error("Could not track Discord bot reply");
  }
}

function formatReply(text: string) {
  // Keep literal links, email addresses, and code usable while formatting speech.
  return text.split(/(```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/gi)
    .map((part, index) => index % 2 ? part : part.toLowerCase()
      .replace(/['’]/g, "").replace(/\p{Pd}/gu, " ").replace(/\p{P}/gu, ""))
    .join("").trim();
}

export async function generateDiscordBotReply(question: string, model: string, history: DiscordConversationMessage[] = []): Promise<DiscordBotReply> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OpenAI authentication is unavailable");
  const response = await fetch(OPENAI_API, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, reasoning_effort: "none", max_completion_tokens: 512, store: false,
      tools: [{
        type: "function",
        function: {
          name: "react_to_message", strict: true,
          description: "React to the current user's Discord message with one emoji, optionally with a short spoken reply. For simple acknowledgment or banter, a reaction alone can be the entire answer.",
          parameters: {
            type: "object", additionalProperties: false,
            properties: {
              emoji: { type: "string", enum: REACTION_EMOJI },
              reply: { type: ["string", "null"], description: "Optional short reply in Bob's voice, or null if the reaction is enough." },
            },
            required: ["emoji", "reply"],
          },
        },
      }],
      tool_choice: "auto", parallel_tool_calls: false,
      messages: [
        { role: "system", content: `${DISCORD_BOT_SYSTEM_PROMPT}\n\ntoday in ottawa: ${new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}.` },
        ...history,
        { role: "user", name: "current_user", content: question },
      ],
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenAI returned status ${response.status}`);
  const result = await response.json() as { choices?: { message?: {
    content?: string | null;
    tool_calls?: { type?: string; function?: { name?: string; arguments?: string } }[];
  } }[] };
  const answer = result.choices?.[0]?.message;
  let content = answer?.content || "";
  let reaction: string | undefined;
  const call = answer?.tool_calls?.[0];
  if (call) {
    if (call.type !== "function" || call.function?.name !== "react_to_message") throw new Error("Unknown bot action");
    const args = JSON.parse(call.function.arguments || "null") as { emoji?: unknown; reply?: unknown } | null;
    if (!args || typeof args.emoji !== "string" || !REACTION_EMOJI.includes(args.emoji)
      || (args.reply !== null && typeof args.reply !== "string")) throw new Error("Invalid bot reaction");
    reaction = args.emoji;
    content = typeof args.reply === "string" ? args.reply : "";
  }
  const text = formatReply(content).slice(0, 1_900).trimEnd();
  if (!text && !reaction) throw new Error("OpenAI returned no answer");
  return { text, reaction };
}

async function postReaction(message: DiscordMention, emoji: string, config: DiscordBotConfig) {
  try {
    const response = await fetch(`${DISCORD_API}/channels/${message.channelId}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: "PUT", headers: { Authorization: `Bot ${config.token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    // Fall back to text if Discord cannot add the reaction.
    return false;
  }
}

async function postReply(message: DiscordMention, content: string, config: DiscordBotConfig) {
  const body = JSON.stringify({
    content: formatReply(content), allowed_mentions: { parse: [], replied_user: false },
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

function startTyping(message: DiscordMention, config: DiscordBotConfig) {
  const controller = new AbortController();
  let sending = false;
  async function send() {
    if (sending || controller.signal.aborted) return;
    sending = true;
    try {
      await fetch(`${DISCORD_API}/channels/${message.channelId}/typing`, {
        method: "POST", headers: { Authorization: `Bot ${config.token}` },
        cache: "no-store", redirect: "error",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3_000)]),
      });
    } catch {
      // Typing is best effort and must never prevent a reply.
    } finally {
      sending = false;
    }
  }
  void send();
  // Discord expires typing after ten seconds, so refresh while waiting or answering.
  const timer = setInterval(() => { void send(); }, 8_000);
  return () => { clearInterval(timer); controller.abort(); };
}

async function answerMention(message: DiscordMention, question: string, config: DiscordBotConfig, queued: boolean) {
  let claimed = false;
  let stopTyping: (() => void) | undefined;
  try {
    let claim = await claimMention(message, config);
    if (claim === "duplicate") return claim;
    stopTyping = startTyping(message, config);
    while (claim === "cooldown") {
      queued = true;
      // The shared claim also waits for this user's previous answer across listeners.
      await new Promise((resolve) => setTimeout(resolve, Math.min(config.cooldownSeconds * 1_000, 2_000)));
      claim = await claimMention(message, config);
    }
    if (claim === "duplicate") return claim;
    if (claim === "daily_limit") {
      await postReply(message, "uhhhh iunno bobs daily brain budget is gone try tomorrow utc", config);
      return claim;
    }
    if (claim === "monthly_limit") {
      await postReply(message, "uhhhh iunno bobs monthly brain budget is gone ask an organizer or try next month utc", config);
      return claim;
    }
    if (claim !== "accepted") throw new Error("Unrecognized bot admission result");
    claimed = true;
    let answer: DiscordBotReply;
    if (!question) answer = { text: "uhhhh iunno" };
    else if (question.length > MAX_QUESTION_LENGTH) answer = { text: "why dont you do that im not wasting my precious tokens keep it under 2000 characters" };
    else answer = await generateDiscordBotReply(question, config.model, await getDiscordConversation(message, config, queued));
    const reacted = answer.reaction ? await postReaction(message, answer.reaction, config) : false;
    const text = answer.text || (reacted ? "" : "uhhhh iunno");
    const replyId = text ? await postReply(message, text, config) : null;
    const answered = !!replyId || reacted;
    await recordReply(message.id, replyId, config, answered);
    return answered ? "answered" : "failed";
  } catch {
    console.error("Discord bot could not complete a mention", { messageId: message.id });
    if (claimed) {
      await postReply(message, "uhhhh iunno brain not working try again in a bit", config);
      await recordReply(message.id, null, config);
    }
    return "failed";
  } finally {
    stopTyping?.();
  }
}

export async function handleDiscordMention(message: DiscordMention, config: DiscordBotConfig) {
  const question = questionFromMention(message, config);
  if (question === null) return "ignored";
  // Preserve each person's message order without holding up other people.
  const key = `${message.guildId}:${message.authorId}`;
  const previous = userQueues.get(key);
  const work = (previous ?? Promise.resolve()).catch(() => {})
    .then(() => answerMention(message, question, config, !!previous));
  userQueues.set(key, work);
  try {
    return await work;
  } finally {
    if (userQueues.get(key) === work) userQueues.delete(key);
  }
}
