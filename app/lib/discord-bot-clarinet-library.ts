import curated from "./discord-bot-clarinet-library.json";
import discover from "./discord-bot-clarinet-discover.json";
import { createDiscoverArchive, type DiscoverArchiveManifest } from "./discord-bot-clarinet-archive";
import { loadSongCatalog, type CatalogRow } from "./discord-bot-clarinet-catalog";
import { clarinetScoreFromMidi } from "./discord-bot-clarinet-midi";
import { clarinetPassageIndex } from "./discord-bot-clarinet-compile.mjs";
import { parseClarinetScore } from "./discord-bot-clarinet-score";

export const CLARINET_LIBRARY_COUNT = discover.midiCount;
export const CLARINET_NAMED_FILES = discover.catalog.namedFiles;
export const CLARINET_TITLE_COUNT = discover.catalog.distinctTitles;
export type ClarinetLibraryEntry = { song: string; title: string; artists: string[]; genre: string; aliases?: string[] };
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const ignored = new Set("a an the i me my you your can could would will please pls plz play do give make perform sing song songs tune tunes music clarinet on of for to by from version rendition squd hey it that again same one something anything random some".split(" "));
const words = (value: string) => normalize(value).split(" ").filter((word) => word && !ignored.has(word));
// Source artist labels often append arrangement numbers, e.g. "Queen 3 (1)".
const artistKey = (value: string) => normalize(value).replace(/(?:\s+\d+)+$/, "");
const requestedTitle = (query: string) => query.replace(/^(?:(?:hey |please |can you |could you |squd |play |perform |sing |do )+)/, "")
  .replace(/ (?:for me|for us|please|pls|plz)$/, "");
const byId = new Map(curated.entries.map((entry) => [entry.song, entry]));
const popular = ["APT.", "Espresso", "Megalovania", "Nyan Cat", "Crab Rave", "weezer lick", "happy bday", "spongebob nose flute"];
const artistAliases = [
  [/john lennon|paul mccartney|george harrison/i, "beatles"],
  [/freddie mercury|freddy mercury|brian may|roger taylor|john deacon/i, "queen"],
  [/benny andersson|benny anderson|bjorn ulvaeus|bjorn valaeus/i, "abba"],
] as const;
const normalizeQuery = (query: string) => normalize(query.slice(0, 2000).replace(/<@!?\d+>/g, ""))
  .replace(/\brick ?roll(?:ed|ing)?\b/g, "never gonna give you up rick astley");

function entryArtists(entry: ClarinetLibraryEntry) {
  const artists = [...new Set(entry.artists.flatMap((artist) => [normalize(artist), artistKey(artist)]))].filter(Boolean);
  for (const [pattern, alias] of artistAliases) if (artists.some((artist) => pattern.test(artist))) artists.push(alias);
  return artists;
}

function artistOnlyRequest(query: string, artists: string[]) {
  const tokens = words(query);
  return tokens.length > 0 && artists.some((artist) => tokens.every((token) => artist.split(" ").includes(token)));
}

function almostEqual(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let left = 0, right = 0, edits = 0;
  while (left < a.length && right < b.length) {
    if (a[left] === b[right]) { left++; right++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) left++;
    if (b.length >= a.length) right++;
  }
  return edits + a.length - left + b.length - right <= 1;
}

function rank(entries: ClarinetLibraryEntry[], query: string, limit: number) {
  const requested = requestedTitle(query), by = requested.lastIndexOf(" by "), phrase = ` ${query} `;
  const ranked = entries.map((entry) => {
    const names = [entry.title, ...(entry.aliases ?? [])];
    const wholeTitle = names.some((name) => normalize(name) === requested);
    const artistRequested = by > 0 && !wholeTitle ? words(requested.slice(by + 4)) : [];
    const titleQuery = artistRequested.length ? requested.slice(0, by) : requested;
    const tokens = words(titleQuery), titlePhrase = ` ${titleQuery} `;
    const titleScore = Math.max(...names.map((name) => {
      const title = normalize(name), titleWords = [...new Set(words(name))];
      if (!title) return 0;
      const exact = titlePhrase.includes(` ${title} `);
      const joined = title.replaceAll(" ", "");
      const compact = joined.length >= 6 && tokens.includes(joined);
      const matched = titleWords.filter((word) => tokens.some((token) => almostEqual(token, word))).length;
      const coverage = matched / Math.max(1, titleWords.length);
      const queryCoverage = tokens.filter((token) => titleWords.some((word) => almostEqual(token, word))).length / Math.max(1, tokens.length);
      const fuzzy = coverage === 1 && queryCoverage >= 0.6 || tokens.length === 1 && matched > 0 && tokens[0].length >= 4;
      return ((exact && queryCoverage >= 0.6) || compact ? 100 + Math.min(80, title.length) : 0) + (fuzzy ? coverage * 35 + matched : 0);
    }));
    const artists = entryArtists(entry);
    const artistHit = artists.some((artist) => phrase.includes(` ${artist} `));
    // Artist names can broaden an artist-only request, but cannot rescue an unknown title.
    const artistOnly = artistOnlyRequest(query, artists);
    const versionLabel = entry.artists.some((artist) => /\s+\d+(?:\s*\(\d+\))?$/.test(artist));
    const wrongArtist = artistRequested.length > 0 && !artists.some((artist) => artistRequested.every((token) => artist.split(" ").some((word) => almostEqual(token, word))));
    return { entry, score: wrongArtist ? 0 : titleScore + (artistHit && (titleScore > 0 || artistOnly) ? 25 : 0), versionLabel };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || Number(a.versionLabel) - Number(b.versionLabel)
    || a.entry.song.localeCompare(b.entry.song));
  const seen = new Set<string>();
  return ranked.filter(({ entry }) => {
    const key = `${normalize(entry.title)}:${entry.artists.map(artistKey).join("|")}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, Math.min(8, limit)).map(({ entry: { song, title, artists, genre, aliases } }) => ({ song, title, artists, genre,
    ...(aliases ? { aliases } : {}) }));
}

type SongCatalog = { search(terms: string[], title: string): CatalogRow[] };
type Archive = Pick<ReturnType<typeof createDiscoverArchive>, "has" | "midi">;

export function createClarinetLibrary(catalog: () => Promise<SongCatalog>, archive: Archive) {
  const midiFiles = new Map<string, Uint8Array>();
  const pendingMidi = new Map<string, Promise<Uint8Array>>();
  let cachedBytes = 0;
  async function sourceMidi(song: string) {
    const hit = midiFiles.get(song);
    if (hit) { midiFiles.delete(song); midiFiles.set(song, hit); return hit; }
    const existing = pendingMidi.get(song);
    if (existing) return existing;
    if (pendingMidi.size >= 32) throw new Error("MIDI cache is busy");
    const request = archive.midi(song.slice(9)).then((source) => {
      // Detach the small MIDI from its decompressed archive block before retaining it.
      const bytes = Uint8Array.from(source);
      cachedBytes += bytes.byteLength; midiFiles.set(song, bytes);
      while (midiFiles.size > 128 || cachedBytes > 16 * 1024 * 1024) {
        const oldest = midiFiles.keys().next().value!;
        cachedBytes -= midiFiles.get(oldest)!.byteLength; midiFiles.delete(oldest);
      }
      return bytes;
    });
    pendingMidi.set(song, request);
    try { return await request; } finally { pendingMidi.delete(song); }
  }
  async function search(query: string, limit = 8): Promise<ClarinetLibraryEntry[]> {
    const normalized = normalizeQuery(query);
    if (!normalized || !Number.isInteger(limit) || limit < 1) return [];
    const direct = rank(curated.entries, normalized, limit);
    // Keep the existing exact hooks available even if the archive host is temporarily down.
    if (direct.some((entry) => [entry.title, ...(entry.aliases ?? [])].some((name) => ` ${normalized} `.includes(` ${normalize(name)} `)))) return direct;
    const id = normalized.match(/\b[a-f0-9]{32}\b/)?.[0];
    if (id) return await archive.has(id) ? [{ song: `discover_${id}`, title: `MIDI ${id}`, artists: [], genre: "" }] : [];
    const tokens = words(normalized);
    if (!tokens.length) return direct;
    const rows = (await catalog()).search(tokens, requestedTitle(normalized));
    return rank([...curated.entries, ...rows.map((row) => ({ song: `discover_${row.hash}`,
      title: row.title.slice(0, 180), artists: row.artist ? [row.artist.slice(0, 180)] : [], genre: row.genre.slice(0, 100) }))], normalized, limit);
  }
  return {
    search,
    async select(question: string, history: string[] = [], performanceSeed?: string) {
      function choose(query: string, matches: ClarinetLibraryEntry[]) {
        if (performanceSeed === undefined) return matches;
        const normalized = normalizeQuery(query), title = requestedTitle(normalized);
        // An exact title always keeps its normal matches, even if an artist shares that name.
        if (matches.some((entry) => [entry.title, ...(entry.aliases ?? [])].some((name) => normalize(name) === title))) return matches;
        const choices = matches.filter((entry) => artistOnlyRequest(normalized, entryArtists(entry)));
        // Choose on the server so the model cannot keep preferring the same artist's hit.
        return choices.length ? [choices[clarinetPassageIndex(`artist:${normalized}:${performanceSeed}`, choices.length)]] : matches;
      }
      const current = await search(question);
      if (current.length) return choose(question, current);
      if (!words(question).length && /\b(?:random|anything|something)\b/i.test(question)) {
        return (await Promise.all(popular.map((title) => search(title, 1)))).flat().slice(0, 8);
      }
      if (!words(question).length && /\b(?:again|that|it|same)\b/i.test(question)) {
        for (const text of history.slice(-3).reverse()) {
          const matches = await search(text); if (matches.length) return choose(text, matches);
        }
      }
      return [];
    },
    async score(song: string, performanceSeed?: string) {
      const local = byId.get(song);
      if (local) return parseClarinetScore(performanceSeed === undefined ? local.score
        : local.passages[clarinetPassageIndex(`${song}:${performanceSeed}`, local.passages.length)]);
      if (!/^discover_[a-f0-9]{32}$/.test(song)) throw new Error("Unknown clarinet library song");
      const bytes = await sourceMidi(song);
      return clarinetScoreFromMidi(bytes, performanceSeed === undefined ? undefined : `${song}:${performanceSeed}`);
    },
  };
}

let catalogPromise: ReturnType<typeof loadSongCatalog> | undefined, retryAfter = 0;
const library = createClarinetLibrary(() => {
  if (Date.now() < retryAfter) return Promise.reject(new Error("Song catalog temporarily unavailable"));
  return catalogPromise ??= loadSongCatalog(discover.catalog).catch((error) => {
    catalogPromise = undefined; retryAfter = Date.now() + 60_000; throw error;
  });
}, createDiscoverArchive(discover as DiscoverArchiveManifest));
export const searchClarinetLibrary = library.search;
export const selectClarinetLibrarySongs = library.select;
export const getClarinetLibraryScore = library.score;
