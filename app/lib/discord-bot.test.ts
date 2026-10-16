import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { generateDiscordBotReply, getDiscordBotConfig, handleDiscordMention, isDiscordCronAuthorized, type DiscordMention } from "./discord-bot";

const envNames = ["DISCORD_BOT_ENABLED", "DISCORD_BOT_TOKEN", "DISCORD_APPLICATION_ID", "DISCORD_GUILD_ID", "DISCORD_BOT_MODEL", "DISCORD_BOT_DAILY_LIMIT", "DISCORD_BOT_MONTHLY_LIMIT", "DISCORD_BOT_COOLDOWN_SECONDS", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "CRON_SECRET"];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const botId = "1560000000000000001";
const modelUrl = "https://api.openai.com/v1/chat/completions";
let calls: { url: string; init?: RequestInit }[];
let seen: Set<string>;
let intercept: ((url: string, init?: RequestInit) => Response | null) | undefined;
const modelCalls = () => calls.filter(({ url }) => url === modelUrl);
const replies = () => calls.filter(({ url }) => url.startsWith("https://discord.com/api/v10/channels/"));
function config() { const value = getDiscordBotConfig(); assert.ok(value); return value; }
function message(overrides: Partial<DiscordMention> = {}): DiscordMention {
  return { id: "1560000000000000002", guildId: "1483863305360511016", channelId: "1560000000000000003", authorId: "1560000000000000004", content: `<@${botId}> Give me a silly project idea`, authorIsBot: false, mentionedUserIds: [botId], ...overrides };
}
beforeEach(() => {
  envNames.forEach((name) => delete process.env[name]);
  Object.assign(process.env, {
    DISCORD_BOT_ENABLED: "true", DISCORD_BOT_TOKEN: "synthetic-bot-token".repeat(4), DISCORD_APPLICATION_ID: botId,
    SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test-only",
    OPENAI_API_KEY: "synthetic-openai-api-key", CRON_SECRET: "synthetic-cron-secret".repeat(3),
  });
  calls = []; seen = new Set(); intercept = undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    const overridden = intercept?.(url, init); if (overridden) return overridden;
    if (url === modelUrl) return Response.json({ choices: [{ message: { content: "Build a toaster that reviews your code." } }] });
    if (url.endsWith("/rpc/claim_discord_bot_request")) {
      const id = JSON.parse(String(init?.body)).p_message_id;
      if (seen.has(id)) return Response.json("duplicate");
      seen.add(id); return Response.json("accepted");
    }
    if (url.startsWith("https://discord.com/api/v10/channels/")) return Response.json({ id: "1560000000000000005" });
    assert.ok(url.startsWith("https://test.supabase.co/rest/v1/discord_bot_requests?message_id=eq."));
    assert.equal(init?.method, "PATCH"); return new Response(null, { status: 204 });
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  envNames.forEach((name) => { if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name]; });
});

describe("sih-inator mention bot", () => {
  it("requires correct cron authentication and valid bot configuration", () => {
    const url = "https://www.stupideas.com/api/discord/gateway";
    assert.equal(isDiscordCronAuthorized(new Request(url)), false);
    assert.equal(isDiscordCronAuthorized(new Request(url, { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(isDiscordCronAuthorized(new Request(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })), true);
    process.env.DISCORD_BOT_ENABLED = "false"; assert.equal(getDiscordBotConfig(), null);
    process.env.DISCORD_BOT_ENABLED = "true";
    process.env.DISCORD_BOT_DAILY_LIMIT = "1000000"; assert.equal(getDiscordBotConfig(), null);
    process.env.DISCORD_BOT_DAILY_LIMIT = "100";
    process.env.DISCORD_BOT_MONTHLY_LIMIT = "1001"; assert.equal(getDiscordBotConfig(), null);
    process.env.DISCORD_BOT_MONTHLY_LIMIT = "1000";
    delete process.env.OPENAI_API_KEY; assert.equal(getDiscordBotConfig(), null);
  });
  it("ignores bots, unmentioned messages, global pings, and other servers", async () => {
    for (const entry of [message({ authorIsBot: true }), message({ mentionedUserIds: [] }), message({ content: "@everyone hello", mentionedUserIds: [] }), message({ guildId: "1560000000000000099" })]) assert.equal(await handleDiscordMention(entry, config()), "ignored");
    assert.equal(calls.length, 0);
  });
  it("sends only the explicit question to the small model and replies without pings", async () => {
    assert.equal(await handleDiscordMention(message(), config()), "answered");
    const request = JSON.parse(String(modelCalls()[0].init?.body));
    assert.equal(request.model, "gpt-6-luna"); assert.equal(request.reasoning_effort, "none");
    assert.equal(request.max_completion_tokens, 512); assert.equal(request.store, false);
    assert.equal(request.messages.length, 2); assert.equal(request.messages[1].content, "Give me a silly project idea");
    assert.equal(new Headers(modelCalls()[0].init?.headers).get("Authorization"), "Bearer synthetic-openai-api-key");
    assert.equal(JSON.parse(String(calls[0].init?.body)).p_monthly_limit, 1000);
    const reply = JSON.parse(String(replies()[0].init?.body));
    assert.deepEqual(reply.allowed_mentions, { parse: [], replied_user: false });
    assert.equal(reply.message_reference.message_id, message().id);
    assert.equal(reply.nonce, message().id); assert.equal(reply.enforce_nonce, true);
    assert.equal(JSON.parse(String(calls.at(-1)?.init?.body)).status, "answered");
  });
  it("suppresses duplicate messages from overlapping Gateway listeners", async () => {
    const results = await Promise.all([handleDiscordMention(message(), config()), handleDiscordMention(message(), config())]);
    assert.ok(results.includes("answered")); assert.ok(results.includes("duplicate"));
    assert.equal(modelCalls().length, 1); assert.equal(replies().length, 1);
  });
  it("enforces personal cooldowns and daily and monthly quotas before model calls", async () => {
    intercept = (url) => url.includes("/rpc/") ? Response.json("cooldown") : null;
    assert.equal(await handleDiscordMention(message(), config()), "cooldown"); assert.equal(replies().length, 0);
    intercept = (url) => url.includes("/rpc/") ? Response.json("daily_limit") : null;
    assert.equal(await handleDiscordMention(message(), config()), "daily_limit");
    assert.match(JSON.parse(String(replies()[0].init?.body)).content, /daily brain budget/); assert.equal(modelCalls().length, 0);
    intercept = (url) => url.includes("/rpc/") ? Response.json("monthly_limit") : null;
    assert.equal(await handleDiscordMention(message(), config()), "monthly_limit");
    assert.match(JSON.parse(String(replies()[1].init?.body)).content, /monthly brain budget/); assert.equal(modelCalls().length, 0);
  });
  it("does not spend model tokens on empty or oversized questions", async () => {
    await handleDiscordMention(message({ content: `<@!${botId}>` }), config());
    await handleDiscordMention(message({ id: "1560000000000000006", content: `<@${botId}> ${"x".repeat(2001)}` }), config());
    assert.equal(modelCalls().length, 0); assert.equal(replies().length, 2);
  });
  it("fails closed when shared quota storage is unavailable or returns an unknown result", async () => {
    intercept = (url) => url.includes("/rpc/") ? Response.json({}, { status: 503 }) : null;
    assert.equal(await handleDiscordMention(message(), config()), "failed");
    intercept = (url) => url.includes("/rpc/") ? Response.json("unexpected") : null;
    assert.equal(await handleDiscordMention(message(), config()), "failed");
    assert.equal(modelCalls().length, 0); assert.equal(replies().length, 0);
  });
  it("shows a generic error and records failure when the model is unavailable", async () => {
    intercept = (url) => url === modelUrl ? Response.json({}, { status: 503 }) : null;
    assert.equal(await handleDiscordMention(message(), config()), "failed");
    const reply = JSON.parse(String(replies()[0].init?.body));
    assert.match(reply.content, /tiny brain is taking a break/); assert.doesNotMatch(reply.content, /synthetic|token|503/);
    assert.equal(JSON.parse(String(calls.at(-1)?.init?.body)).status, "failed");
  });
  it("respects Discord rate limits and reuses the nonce when retrying", async () => {
    intercept = (url) => url.startsWith("https://discord.com/api/v10/channels/") && replies().length === 1 ? Response.json({ retry_after: 0.001 }, { status: 429 }) : null;
    assert.equal(await handleDiscordMention(message(), config()), "answered");
    assert.equal(replies().length, 2); assert.equal(replies()[0].init?.body, replies()[1].init?.body);
  });
  it("bounds output length and preserves success if delivery tracking fails", async () => {
    intercept = (url) => url === modelUrl ? Response.json({ choices: [{ message: { content: "x".repeat(3000) } }] }) : null;
    assert.equal((await generateDiscordBotReply("Test", config().model)).length, 1900);
    intercept = (url) => url.includes("/discord_bot_requests?") ? Response.json({}, { status: 403 }) : null;
    assert.equal(await handleDiscordMention(message(), config()), "answered");
    assert.equal(replies().length, 1);
  });
});
