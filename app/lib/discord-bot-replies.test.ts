import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_DISCORD_REPLY_LENGTH, MAX_DISCORD_REPLY_MESSAGES, splitDiscordReply } from "./discord-bot-replies";

describe("Discord reply messages", () => {
  it("splits ordinary line breaks and ignores empty messages", () => {
    assert.deepEqual(splitDiscordReply("  first thought\r\n\r\nsecond thought\n  "), ["first thought", "second thought"]);
    assert.deepEqual(splitDiscordReply(" \n\t\n"), []);
  });
  it("wraps long lines at word boundaries without losing the words", () => {
    const text = "one short thought ".repeat(200).trim();
    const parts = splitDiscordReply(text);
    assert.ok(parts.length > 1);
    assert.ok(parts.every((part) => part.length <= MAX_DISCORD_REPLY_LENGTH));
    assert.equal(parts.join(" "), text);
  });
  it("does not split a link or inline code just to fill the preceding message", () => {
    const link = "https://example.com/Keep-This?Key=Value";
    const code = "`Keep This Code()`";
    assert.deepEqual(splitDiscordReply(`${"x".repeat(1_890)} ${link} ${code}`), ["x".repeat(1_890), `${link} ${code}`]);
  });
  it("keeps code-block line breaks inside one message", () => {
    const code = "```js\nconst Hello = 1;\n  console.log(Hello);\n```";
    assert.deepEqual(splitDiscordReply(`here you go\n${code}\nthat should do it`), ["here you go", code, "that should do it"]);
  });
  it("keeps custom emoji markup intact when wrapping adjacent text or emoji", () => {
    const emojis = "<:CatStare:1560000000000000111><a:HappyDance:1560000000000000112>";
    const parts = splitDiscordReply("x".repeat(1_890) + emojis);
    assert.deepEqual(parts, ["x".repeat(1_890), emojis]);
    assert.equal(splitDiscordReply("< less than <tag>").join(""), "< less than <tag>");
  });
  it("closes and reopens an oversized code block while preserving its language", () => {
    const code = "x".repeat(3_000);
    const parts = splitDiscordReply(`\`\`\`js\n${code}\n\`\`\``);
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.startsWith("```js\n") && part.endsWith("\n```") && part.length <= MAX_DISCORD_REPLY_LENGTH));
    assert.equal(parts.map((part) => part.slice(6, -4)).join(""), code);
  });
  it("does not break Unicode pairs when a word has no spaces", () => {
    const text = "a" + "🦀".repeat(1_200);
    const parts = splitDiscordReply(text);
    assert.equal(parts.join(""), text);
    assert.ok(parts.every((part) => part.isWellFormed() && part.length <= MAX_DISCORD_REPLY_LENGTH));
  });
  it("preserves indentation when splitting a large multiline code block", () => {
    const code = Array.from({ length: 60 }, () => "  ".repeat(5) + "const SomeName = SomeFunction();").join("\n");
    const parts = splitDiscordReply(`\`\`\`js\n${code}\n\`\`\``);
    assert.equal(parts.map((part) => part.slice(6, -4)).join("\n"), code);
    assert.ok(parts.every((part) => part.length <= MAX_DISCORD_REPLY_LENGTH));
  });
  it("keeps oversized inline code wrapped in backticks", () => {
    const parts = splitDiscordReply("`" + "X".repeat(3_000) + "`");
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.startsWith("`") && part.endsWith("`")));
    assert.equal(parts.map((part) => part.slice(1, -1)).join(""), "X".repeat(3_000));
  });
  it("keeps remaining short lines in the fifth message and bounds excessive output", () => {
    const lines = Array.from({ length: 12 }, (_, index) => `thought ${index + 1}`);
    const parts = splitDiscordReply(lines.join("\n"));
    assert.equal(parts.length, MAX_DISCORD_REPLY_MESSAGES);
    assert.equal(parts.join("\n"), lines.join("\n"));
    const huge = splitDiscordReply("x".repeat(20_000));
    assert.equal(huge.length, MAX_DISCORD_REPLY_MESSAGES);
    assert.ok(huge.every((part) => part.length === MAX_DISCORD_REPLY_LENGTH));
  });
});
