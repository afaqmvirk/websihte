import { Client, Events, GatewayIntentBits, Options } from "discord.js";
import { handleDiscordMention, type DiscordBotConfig } from "@/lib/discord-bot";

export async function runDiscordGateway(config: DiscordBotConfig, durationMs = 600_000) {
  const client = new Client({
    // Direct mentions need no privileged Gateway intent. History is fetched on demand
    // over REST using the app's Message Content setting, rather than caching all messages.
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    makeCache: Options.cacheWithLimits({ MessageManager: 0 }),
    allowedMentions: { parse: [], repliedUser: false },
  });
  const pending = new Set<Promise<unknown>>();
  client.once(Events.ClientReady, (ready) => {
    console.info("Discord bot connected", { botId: ready.user.id, guildId: config.guildId });
  });
  client.on(Events.Error, () => console.error("Discord Gateway connection error"));
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || message.guildId !== config.guildId
      || !message.mentions.users.has(config.applicationId)) return;
    const work = handleDiscordMention({
      id: message.id, guildId: message.guildId, channelId: message.channelId,
      authorId: message.author.id, content: message.content, authorIsBot: message.author.bot,
      mentionedUserIds: [...message.mentions.users.keys()],
    }, config);
    pending.add(work);
    void work.finally(() => pending.delete(work));
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
