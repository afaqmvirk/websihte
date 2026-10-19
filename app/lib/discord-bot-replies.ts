export const MAX_DISCORD_REPLY_LENGTH = 1_900;
export const MAX_DISCORD_REPLY_MESSAGES = 5;

function wrapText(text: string, limit: number, preserveWhitespace = false) {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let end = remaining.lastIndexOf("\n", limit);
    if (end < 1) end = remaining.lastIndexOf(" ", limit);
    if (end < 1) end = limit;
    // Do not divide a Unicode surrogate pair between Discord messages.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    const part = remaining.slice(0, end);
    parts.push(preserveWhitespace ? part : part.trimEnd());
    remaining = remaining.slice(end);
    if (preserveWhitespace) remaining = remaining.replace(/^\n/, "");
    else remaining = remaining.trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function splitToken(token: string) {
  if (token.length <= MAX_DISCORD_REPLY_LENGTH) return [token];
  if (token.startsWith("```") && token.endsWith("```")) {
    const opening = token.match(/^```[^\n]{0,64}\n/)?.[0];
    const prefix = opening || "```\n";
    const code = token.slice(opening?.length ?? 3, -3).replace(/\n$/, "");
    return wrapText(code, MAX_DISCORD_REPLY_LENGTH - prefix.length - 4, true)
      .map((part) => `${prefix}${part}\n\`\`\``);
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return wrapText(token.slice(1, -1), MAX_DISCORD_REPLY_LENGTH - 2, true).map((part) => `\`${part}\``);
  }
  return wrapText(token, MAX_DISCORD_REPLY_LENGTH);
}

export function splitDiscordReply(text: string) {
  const messages: string[] = [];
  let current = "";
  function flush() {
    if (current.trim() && messages.length < MAX_DISCORD_REPLY_MESSAGES) messages.push(current.trim());
    current = "";
  }
  // Treat code, links, custom emojis, and words as units; only ordinary line breaks start a
  // new message. Keep remaining short lines together once the fifth is reached.
  const tokens = text.replace(/\r\n?/g, "\n")
    .match(/```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|<a?:\w{1,32}:\d{17,20}>|\n|[^\S\n]+|[^\s`<]+|[<`]/g) ?? [];
  for (const token of tokens) {
    if (messages.length === MAX_DISCORD_REPLY_MESSAGES) break;
    if (token === "\n") {
      if (messages.length < MAX_DISCORD_REPLY_MESSAGES - 1) flush();
      else if (current) current += "\n";
    } else if (/^\s+$/.test(token)) {
      if (current) current += token.slice(0, MAX_DISCORD_REPLY_LENGTH - current.length);
    } else {
      for (const part of splitToken(token)) {
        if (current.length + part.length > MAX_DISCORD_REPLY_LENGTH) flush();
        if (messages.length === MAX_DISCORD_REPLY_MESSAGES) break;
        current += part;
      }
    }
  }
  flush();
  return messages;
}
