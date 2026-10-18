const SNOWFLAKE = /^\d{17,20}$/;
const PAGE_SIZE = 20;
export const MAX_MEMBER_QUERY_LENGTH = 100;

export type DiscordServerMember = {
  id: string; username: string; displayName: string; nickname: string | null; bot: boolean;
};
export type DiscordMemberSearch = {
  members: DiscordServerMember[]; next_after: string | null; truncated: boolean; error?: string;
};
type DirectoryConfig = { token: string; guildId: string; applicationId: string };

export function validDiscordMemberQuery(query: unknown, after: unknown): query is string {
  return typeof query === "string" && query.length <= MAX_MEMBER_QUERY_LENGTH
    && !/[\x00-\x1f\x7f]/.test(query)
    && (after === null || (typeof after === "string" && SNOWFLAKE.test(after) && !query.trim()));
}

function memberName(value: unknown) {
  return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 64) : "";
}

export async function findDiscordServerMembers(config: DirectoryConfig, query: string, after: string | null): Promise<DiscordMemberSearch> {
  if (!validDiscordMemberQuery(query, after) || !SNOWFLAKE.test(config.guildId)) throw new Error("Invalid member search");
  const prefix = query.trim();
  const url = new URL(`https://discord.com/api/v10/guilds/${config.guildId}/members${prefix ? "/search" : ""}`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (prefix) url.searchParams.set("query", prefix);
  else if (after) url.searchParams.set("after", after);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bot ${config.token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Member search unavailable");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid member search response");
    const members = new Map<string, DiscordServerMember>();
    let highestId: string | null = null;
    for (const entry of data.slice(0, PAGE_SIZE)) {
      if (!entry || typeof entry !== "object" || !entry.user || typeof entry.user !== "object") continue;
      const { id, username, global_name, bot } = entry.user;
      if (typeof id !== "string" || !SNOWFLAKE.test(id) || !memberName(username)) continue;
      if (!highestId || BigInt(id) > BigInt(highestId)) highestId = id;
      if (id === config.applicationId) continue;
      members.set(id, { id, username: memberName(username), displayName: memberName(global_name) || memberName(username),
        nickname: memberName(entry.nick) || null, bot: bot === true });
    }
    return { members: [...members.values()], next_after: !prefix && data.length >= PAGE_SIZE ? highestId : null,
      truncated: data.length >= PAGE_SIZE };
  } catch {
    // Return no unverified IDs or Discord error bodies, credentials, or private profile fields.
    return { members: [], next_after: null, truncated: false,
      error: "Member lookup is unavailable. Ask for a direct mention instead; do not guess an ID or claim a person is absent." };
  }
}
