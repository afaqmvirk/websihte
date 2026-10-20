import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discordMessagesWithImages, getDiscordImageUrls, MAX_DISCORD_INPUT_IMAGE_BYTES } from "./discord-bot-vision";

const channelId = "1560000000000000002";
function attachment(index = 1, overrides = {}) {
  const id = String(1560000000000000100n + BigInt(index));
  return { id, url: `https://cdn.discordapp.com/attachments/${channelId}/${id}/code.png?ex=abc&is=def&hm=signature`,
    content_type: "image/png", size: 1_024, width: 1_000, height: 800, ...overrides };
}

describe("Discord image input", () => {
  it("preserves signed upload URLs, supports PNG/JPEG/WebP, and caps duplicate uploads", () => {
    const png = attachment();
    const jpg = attachment(2, { url: attachment(2).url.replace(".png", ".jpg"), content_type: "image/jpeg" });
    const webp = attachment(3, { url: attachment(3).url.replace("cdn.discordapp.com", "media.discordapp.net").replace(".png", ".webp"), content_type: null });
    assert.deepEqual(getDiscordImageUrls([png, png, jpg, webp, attachment(4), attachment(5)], channelId),
      [png.url, jpg.url, webp.url, attachment(4).url]);
  });
  it("rejects external, cross-channel, malformed, oversized, animated and non-image attachments", () => {
    const base = attachment();
    const invalid = [
      { url: base.url.replace("cdn.discordapp.com", "cdn.discordapp.com.evil.example") },
      { url: base.url.replace(channelId, "1560000000000000003") },
      { url: base.url.replace(base.id, "1560000000000000999") },
      { url: base.url.replace("https:", "http:") }, { url: `https://user:pass@cdn.discordapp.com/attachments/${channelId}/${base.id}/code.png` },
      { url: base.url + "#fragment" }, { url: base.url.replace("/code.png", "/nested/code.png") },
      { url: "data:image/png;base64,abc" }, { url: "https://127.0.0.1/code.png" },
      { url: base.url.replace(".png", ".gif"), content_type: "image/gif" },
      { url: base.url.replace(".png", ".svg"), content_type: "image/svg+xml" },
      { content_type: "application/pdf" }, { size: MAX_DISCORD_INPUT_IMAGE_BYTES + 1 },
      { size: 0 }, { size: "1024" }, { width: null }, { width: "100" }, { height: 0 }, { id: "bad" },
    ].map((overrides) => ({ ...base, ...overrides }));
    assert.deepEqual(getDiscordImageUrls([null, {}, ...invalid.slice(0, 8)], channelId), []);
    for (const item of invalid) assert.deepEqual(getDiscordImageUrls([item], channelId), []);
    assert.deepEqual(getDiscordImageUrls(null, channelId), []);
  });
  it("bounds an entire model request, favours current images, and does not attach images to assistant turns", () => {
    const old = attachment(9).url;
    const current = Array.from({ length: 4 }, (_, index) => attachment(index + 1).url);
    const messages = discordMessagesWithImages([
      { role: "user", name: "participant_1", content: "old screenshot", images: [old, current[0]] },
      { role: "assistant", name: "overlord_bob", content: "earlier answer", images: [old] },
      { role: "user", name: "current_user", content: "compare these", images: current },
    ]);
    assert.equal(messages[0].content, "old screenshot");
    assert.equal(messages[1].content, "earlier answer");
    assert.deepEqual(messages[2].content, [{ type: "text", text: "compare these" },
      ...current.map((url) => ({ type: "image_url", image_url: { url, detail: "auto" } }))]);
    assert.ok(messages.every((message) => !Object.hasOwn(message, "images")));
  });
  it("deduplicates refreshed signatures and preserves plain text requests", () => {
    const url = attachment().url;
    const messages = discordMessagesWithImages([
      { role: "user", name: "current_user", content: "earlier", images: [url.replace("ex=abc", "ex=new")] },
      { role: "user", name: "current_user", content: "", images: [url] },
    ]);
    assert.equal(messages[0].content, "earlier");
    assert.ok(Array.isArray(messages[1].content));
    assert.deepEqual(messages[1].content[0], { type: "text", text: "[uploaded image]" });
    assert.deepEqual(discordMessagesWithImages([{ role: "user", name: "current_user", content: "hello" }]),
      [{ role: "user", name: "current_user", content: "hello" }]);
  });
});
