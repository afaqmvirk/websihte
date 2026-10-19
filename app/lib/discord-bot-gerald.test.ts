import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateGeraldReply } from "./discord-bot-gerald";
import { getKrabMoneyPhoto, KRAB_MONEY_PHOTOS } from "./discord-bot-krab";

describe("fixed overlord replies", () => {
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
