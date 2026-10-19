import { createHash } from "node:crypto";

export function generateGeraldReply(messageId: string) {
  // Random-looking per message, but repeatable across retries and overlapping listeners.
  const digest = createHash("sha512").update(`gerald:${messageId}`).digest();
  let ticket = digest.readUInt32BE(0) % 528;
  let count = 1;
  for (; count < 32; count++) {
    const weight = 33 - count;
    if (ticket < weight) break;
    ticket -= weight;
  }
  const sounds = ["meow", "miau", "mrow"];
  return Array.from({ length: count }, (_, index) => sounds[digest[index + 4] % sounds.length]).join(" ");
}
