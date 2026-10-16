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
const DELETE_REASONS = {
  disrespect: "be respectful of one another",
  harassment: "treat others the way you want to be treated",
  spam: "repeated spam disrupts other people",
};
type DeleteReason = keyof typeof DELETE_REASONS;
type DiscordBotReply = { text: string; reaction?: string; deleteReason?: DeleteReason };

export function getDiscordBotConfig() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim() || "";
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || "1483863305360511016";
  const model = process.env.DISCORD_BOT_MODEL?.trim() || "gpt-6-luna";
  const dailyLimit = Number(process.env.DISCORD_BOT_DAILY_LIMIT || 10_000);
  const monthlyLimit = Number(process.env.DISCORD_BOT_MONTHLY_LIMIT || 310_000);
  const cooldownSeconds = Number(process.env.DISCORD_BOT_COOLDOWN_SECONDS || 2);
  const storage = getApplicationStorageConfig();
  if (process.env.DISCORD_BOT_ENABLED !== "true" || !token || token.length < 40 || /\s/.test(token)
    || !SNOWFLAKE.test(applicationId) || !SNOWFLAKE.test(guildId)
    || !process.env.OPENAI_API_KEY?.trim() || !/^[\w.-]+$/.test(model)
    || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10_000
    || !Number.isInteger(monthlyLimit) || monthlyLimit < 1 || monthlyLimit > 310_000
    || !Number.isInteger(cooldownSeconds) || cooldownSeconds < 1 || cooldownSeconds > 3_600
    || !storage) return null;
  return { token, applicationId, guildId, model, dailyLimit, monthlyLimit, cooldownSeconds, storage };
}

export type DiscordBotConfig = NonNullable<ReturnType<typeof getDiscordBotConfig>>;
export type DiscordMention = {
  id: string; guildId: string | null; channelId: string; authorId: string;
  content: string; authorIsBot: boolean; mentionedUserIds: string[];
  canDelete?: boolean;
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

export async function generateDiscordBotReply(question: string, model: string, history: DiscordConversationMessage[] = [], canDelete = false): Promise<DiscordBotReply> {
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
      }, ...(canDelete ? [{
        type: "function",
        function: {
          name: "delete_current_message", strict: true,
          description: "Quietly delete only the current human message mentioning Bob for clear disrespect, targeted harassment, or repeated spam. Ordinary questions, criticism, harmless banter, and urgent requests for personal help must stay. No other message can be targeted.",
          parameters: {
            type: "object", additionalProperties: false,
            properties: { reason: { type: "string", enum: Object.keys(DELETE_REASONS) } },
            required: ["reason"],
          },
        },
      }] : [])],
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
  let deleteReason: DeleteReason | undefined;
  const call = answer?.tool_calls?.[0];
  if (call) {
    if (call.type !== "function" || !call.function) throw new Error("Unknown bot action");
    const args = JSON.parse(call.function.arguments || "null") as Record<string, unknown> | null;
    if (call.function.name === "react_to_message") {
      if (!args || typeof args.emoji !== "string" || !REACTION_EMOJI.includes(args.emoji)
        || (args.reply !== null && typeof args.reply !== "string")) throw new Error("Invalid bot reaction");
      reaction = args.emoji;
      content = typeof args.reply === "string" ? args.reply : "";
    } else if (call.function.name === "delete_current_message" && canDelete) {
      if (!args || Object.keys(args).length !== 1 || typeof args.reason !== "string"
        || !Object.hasOwn(DELETE_REASONS, args.reason)) throw new Error("Invalid bot deletion");
      deleteReason = args.reason as DeleteReason;
      content = "";
    } else throw new Error("Unknown bot action");
  }
  const text = formatReply(content).slice(0, 1_900).trimEnd();
  if (!text && !reaction && !deleteReason) throw new Error("OpenAI returned no answer");
  return { text, reaction, deleteReason };
}

async function deleteMention(message: DiscordMention, reason: DeleteReason, config: DiscordBotConfig) {
  if (!message.canDelete) return false;
  try {
    const url = `${DISCORD_API}/channels/${message.channelId}/messages/${message.id}`;
    const current = await fetch(url, {
      headers: { Authorization: `Bot ${config.token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (current.status === 404) {
      const error = await current.json().catch(() => null) as { code?: number } | null;
      return error?.code === 10008;
    }
    if (!current.ok) return false;
    const target = await current.json() as { id?: string; content?: string; author?: { id?: string; bot?: boolean } };
    if (target.id !== message.id || target.author?.id !== message.authorId || target.author.bot
      || target.content !== message.content) return false;
    const response = await fetch(url, {
      method: "DELETE", headers: {
        Authorization: `Bot ${config.token}`,
        "X-Audit-Log-Reason": encodeURIComponent(`sih-inator moderation: ${DELETE_REASONS[reason]}`),
      },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return true;
    if (response.status === 404) {
      const error = await response.json().catch(() => null) as { code?: number } | null;
      return error?.code === 10008; // The current message has already been removed.
    }
  } catch {
    // Never claim a deletion succeeded when Discord could not confirm it.
  }
  return false;
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
    else answer = await generateDiscordBotReply(question, config.model, await getDiscordConversation(message, config, queued), message.canDelete === true);
    if (answer.deleteReason) {
      if (await deleteMention(message, answer.deleteReason, config)) {
        await recordReply(message.id, null, config, true);
        return "answered";
      }
      answer = { text: "cant remove that here bro" };
    }
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
