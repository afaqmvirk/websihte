import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateGeraldAnswer, generateGeraldReply, shouldGeraldDeepMeow } from "./discord-bot-gerald";
import { getKrabMoneyPhoto, KRAB_MONEY_PHOTOS } from "./discord-bot-krab";

describe("fixed overlord replies", () => {
  it("selects the deep meow repeatably for about one in five messages", () => {
    let voices = 0;
    for (let index = 0; index < 10_000; index++) {
      const id = String(1560000000000000000n + BigInt(index));
      const selected = shouldGeraldDeepMeow(id);
      assert.equal(shouldGeraldDeepMeow(id), selected);
      if (selected) voices++;
    }
    assert.ok(voices > 1_500 && voices < 2_500);
  });

  it("loads the downloaded meow with valid voice metadata and keeps ordinary text replies", async () => {
    const id = Array.from({ length: 100 }, (_, index) => String(1560000000000000000n + BigInt(index)))
      .find(shouldGeraldDeepMeow);
    assert.ok(id);
    const answer = await generateGeraldAnswer(id);
    assert.equal(answer.text, "");
    assert.ok(answer.voice);
    assert.equal(answer.voice.filename, "deep-meow.ogg");
    assert.equal(answer.voice.contentType, "audio/ogg");
    assert.ok(answer.voice.duration > 3 && answer.voice.duration < 4);
    const bytes = Buffer.from(answer.voice.bytes);
    assert.equal(bytes.subarray(0, 4).toString(), "OggS");
    assert.ok(bytes.includes(Buffer.from("OpusHead")));
    assert.deepEqual(bytes, await readFile("public/discord/gerald/deep-meow.ogg"));
    const waveform = Buffer.from(answer.voice.waveform, "base64");
    assert.ok(waveform.length > 10 && waveform.length <= 256);
    assert.ok(waveform.some((sample) => sample > 0));
    const textId = "1560000000000000002";
    assert.equal(shouldGeraldDeepMeow(textId), false);
    assert.deepEqual(await generateGeraldAnswer(textId), { text: generateGeraldReply(textId) });
  });

  it("falls back to text if the bundled meow is unavailable", async () => {
    const originalDirectory = process.cwd();
    const temporary = await mkdtemp(join(tmpdir(), "gerald-missing-clip-"));
    const id = Array.from({ length: 100 }, (_, index) => String(1560000000000000000n + BigInt(index)))
      .find(shouldGeraldDeepMeow);
    assert.ok(id);
    try {
      process.chdir(temporary);
      assert.deepEqual(await generateGeraldAnswer(id), { text: generateGeraldReply(id) });
    } finally {
      process.chdir(originalDirectory);
      await rmdir(temporary);
    }
  });

  it("gives Gerald varied, repeatable sequences containing only his three meows", () => {
    const lengths = Array(32).fill(0) as number[];
    const words = new Set<string>();
    const sequences = new Set<string>();
    for (let index = 0; index < 10_000; index++) {
      const id = String(1560000000000000000n + BigInt(index));
      const reply = generateGeraldReply(id);
      assert.equal(generateGeraldReply(id), reply);
      assert.match(reply, /^(?:meow|miau|mrow)(?: (?:meow|miau|mrow)){0,31}$/);
      const parts = reply.split(" ");
      lengths[parts.length - 1]++;
      parts.forEach((part) => words.add(part));
      sequences.add(reply);
    }
    assert.deepEqual([...words].sort(), ["meow", "miau", "mrow"]);
    assert.ok(sequences.size > 5_000);
    assert.ok(lengths.every((count) => count > 0));
    assert.ok(lengths.slice(0, 16).reduce((sum, count) => sum + count, 0) > 2 * lengths.slice(16).reduce((sum, count) => sum + count, 0));
  });

  it("selects all seven money photos occasionally and keeps most Krab replies as text", () => {
    const selected = new Set<string>();
    let images = 0;
    for (let index = 0; index < 10_000; index++) {
      const id = String(1560000000000000000n + BigInt(index));
      const photo = getKrabMoneyPhoto(id);
      assert.equal(getKrabMoneyPhoto(id), photo);
      if (photo) { selected.add(photo); images++; }
    }
    assert.equal(KRAB_MONEY_PHOTOS.length, 7);
    assert.deepEqual([...selected].sort(), [...KRAB_MONEY_PHOTOS].sort());
    assert.ok(images > 1_500 && images < 2_500);
  });
});
