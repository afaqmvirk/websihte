import { createHash } from "node:crypto";

export function generateKrabReply(messageId: string) {
  // The same message always gets the same reply. Counts 1..32 have weights 32..1.
  const digest = createHash("sha256").update(messageId).digest();
  let ticket = digest.readUInt32BE(0) % 528; // 32 + 31 + ... + 1
  for (let count = 1; count < 32; count++) {
    const weight = 33 - count;
    if (ticket < weight) return Array(count).fill("money").join(" ");
    ticket -= weight;
  }
  return Array(32).fill("money").join(" ");
}
