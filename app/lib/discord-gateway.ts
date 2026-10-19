import { Client, Events, GatewayIntentBits, Options, PermissionFlagsBits } from "discord.js";
import { getDiscordMessageTrigger, handleDiscordMention, type DiscordBotConfig, type DiscordMention } from "@/lib/discord-bot";
import { selectDiscordServerEmojis } from "@/lib/discord-bot-emojis";

export async function runDiscordGateway(config: DiscordBotConfig, durationMs = 600_000) {
  const client = new Client({
    // Message Content is needed to spot unpinged names; messages are still not cached.
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildExpressions],
    makeCache: Options.cacheWithLimits({ MessageManager: 0 }),
    allowedMentions: { parse: [], repliedUser: false },
  });
  const pending = new Set<Promise<unknown>>();
  client.once(Events.ClientReady, (ready) => {
    console.info("Discord bot connected", { botId: ready.user.id, guildId: config.guildId });
  });
  client.on(Events.Error, () => console.error("Discord Gateway connection error"));
  client.on(Events.MessageCreate, (message) => {
    if (!message.inGuild()) return;
    const incoming: DiscordMention = {
      id: message.id, guildId: message.guildId, channelId: message.channelId,
      authorId: message.author.id, content: message.content, authorIsBot: message.author.bot,
      mentionedUserIds: [...message.mentions.users.keys()],
      mentionedUsers: [...message.mentions.users.values()].map((user) => ({ id: user.id, name: user.globalName || user.username })),
      authorName: message.member?.displayName || message.author.globalName || message.author.username,
      authorUsername: message.author.username,
      authorIsWebhook: !!message.webhookId, referencedMessageId: message.reference?.messageId,
    };
    if (!getDiscordMessageTrigger(incoming, config)) return;
    incoming.serverEmojis = selectDiscordServerEmojis(
      [...message.guild.emojis.cache.values()].map((emoji) => ({
        id: emoji.id, name: emoji.name, animated: emoji.animated, available: emoji.available,
        roleIds: [...emoji.roles.cache.keys()],
      })), new Set(message.guild.members.me?.roles.cache.keys()), message.content,
    );
    incoming.canDelete = message.channel.permissionsFor(message.client.user)?.has(PermissionFlagsBits.ManageMessages) ?? false;
    const work = handleDiscordMention(incoming, config);
    pending.add(work);
    void work.catch(() => console.error("Discord bot mention failed", { bot: config.persona }))
      .finally(() => pending.delete(work));
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lifetime = new Promise<void>((resolve) => { timer = setTimeout(resolve, durationMs); });
    await client.login(config.token);
    await lifetime;
  } catch {
    console.error("Discord bot listener stopped before its scheduled handover");
  } finally {
    if (timer) clearTimeout(timer);
    await client.destroy();
    await Promise.allSettled([...pending]);
  }
}
