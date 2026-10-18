import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { findDiscordServerMembers } from "./discord-bot-members";

const originalFetch = globalThis.fetch;
const config = { token: "synthetic-directory-token".repeat(3), guildId: "1560000000000000001", applicationId: "1560000000000000002" };
let calls: { url: URL; init?: RequestInit }[];
let data: unknown;
beforeEach(() => {
  calls = [];
  data = [{ user: { id: "1560000000000000003", username: "alice", global_name: "Alice", email: "private@example.test" },
    nick: "Al", roles: ["private-role"], joined_at: "private" }];
  globalThis.fetch = async (url, init) => { calls.push({ url: new URL(String(url)), init }); return Response.json(data); };
});
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Discord server member lookup", () => {
  it("uses the configured server and returns only bounded name and ID fields", async () => {
    const result = await findDiscordServerMembers(config, " ali & after=999 ", null);
    assert.deepEqual(result, { members: [{ id: "1560000000000000003", username: "alice", displayName: "Alice", nickname: "Al", bot: false }], next_after: null, truncated: false });
    assert.equal(calls[0].url.pathname, `/api/v10/guilds/${config.guildId}/members/search`);
    assert.equal(calls[0].url.searchParams.get("query"), "ali & after=999");
    assert.equal(calls[0].url.searchParams.get("after"), null);
    assert.equal(calls[0].url.searchParams.get("limit"), "20");
    assert.equal(new Headers(calls[0].init?.headers).get("Authorization"), `Bot ${config.token}`);
    assert.equal(calls[0].init?.redirect, "error"); assert.equal(calls[0].init?.cache, "no-store");
  });
  it("lists one page, exposes a cursor, and bounds oversized responses", async () => {
    data = Array.from({ length: 30 }, (_, index) => ({ user: { id: String(1560000000000000100n + BigInt(index)), username: `member${index}` } }));
    const first = await findDiscordServerMembers(config, "", null);
    assert.equal(first.members.length, 20); assert.equal(first.truncated, true);
    assert.equal(first.next_after, "1560000000000000119");
    assert.equal(calls[0].url.pathname, `/api/v10/guilds/${config.guildId}/members`);
    await findDiscordServerMembers(config, "", first.next_after);
    assert.equal(calls[1].url.searchParams.get("after"), first.next_after);
    assert.equal(calls[1].url.searchParams.get("query"), null);
    assert.equal((await findDiscordServerMembers(config, "member", null)).next_after, null);
  });
  it("excludes Bob, malformed members, and duplicate IDs while preserving distinct name matches", async () => {
    data = [null, {}, { user: { id: "bad", username: "fake" } }, { user: { id: config.applicationId, username: "bob" } },
      { user: { id: "1560000000000000003", username: "alice", global_name: null }, nick: null },
      { user: { id: "1560000000000000003", username: "alice" } },
      { user: { id: "1560000000000000004", username: "alice2", global_name: "Alice\u0000", bot: true }, nick: "A".repeat(100) }];
    const result = await findDiscordServerMembers(config, "alice", null);
    assert.equal(result.members.length, 2);
    assert.equal(result.members[0].displayName, "alice"); assert.equal(result.members[0].nickname, null);
    assert.equal(result.members[1].displayName, "Alice"); assert.equal(result.members[1].nickname?.length, 64);
    assert.equal(result.members[1].bot, true);
  });
  it("rejects malformed queries and arbitrary cursors before any request", async () => {
    for (const [query, after] of [["x".repeat(101), null], ["a\n", null], ["alice", "1560000000000000003"], ["", "../../other-server"], ["", undefined]]) {
      await assert.rejects(findDiscordServerMembers(config, query as string, after as string | null));
    }
    await assert.rejects(findDiscordServerMembers({ ...config, guildId: "../other-server" }, "alice", null));
    assert.equal(calls.length, 0);
  });
  it("returns no identities on permission, rate-limit, network, or malformed-response failures", async () => {
    for (const status of [403, 429, 503]) {
      globalThis.fetch = async () => Response.json({ token: "must never escape" }, { status });
      const result = await findDiscordServerMembers(config, "alice", null);
      assert.deepEqual(result.members, []); assert.ok(result.error); assert.doesNotMatch(JSON.stringify(result), /must never escape/);
    }
    globalThis.fetch = async () => { throw new Error("must never escape"); };
    assert.ok((await findDiscordServerMembers(config, "alice", null)).error);
    globalThis.fetch = async () => Response.json({ members: [] });
    assert.ok((await findDiscordServerMembers(config, "alice", null)).error);
  });
});
