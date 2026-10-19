export type DiscordServerEmoji = { id: string; name: string; animated: boolean };
type EmojiCandidate = {
  id: string | null; name: string | null; animated?: boolean | null;
  available?: boolean | null; roleIds?: readonly string[];
};

export function selectDiscordServerEmojis(
  candidates: Iterable<EmojiCandidate>, botRoleIds: ReadonlySet<string>, question = "",
): DiscordServerEmoji[] {
  const requested = new Set([...question.matchAll(/<a?:\w{1,32}:(\d{17,20})>/g)].map((match) => match[1]));
  const usable = new Map<string, DiscordServerEmoji>();
  for (const emoji of candidates) {
    if (!emoji.id || !/^\d{17,20}$/.test(emoji.id) || !emoji.name || !/^\w{1,32}$/.test(emoji.name)
      || emoji.available === false || (emoji.roleIds?.length && !emoji.roleIds.some((id) => botRoleIds.has(id)))) continue;
    usable.set(emoji.id, { id: emoji.id, name: emoji.name, animated: emoji.animated === true });
  }
  // Keep the catalog bounded, but always prioritize the emoji the human supplied.
  return [...usable.values()].sort((a, b) => Number(requested.has(b.id)) - Number(requested.has(a.id))).slice(0, 100);
}

export function discordEmojiMarkup(emoji: DiscordServerEmoji) {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

export function discordEmojiReaction(emoji: DiscordServerEmoji) {
  return `${emoji.name}:${emoji.id}`;
}
