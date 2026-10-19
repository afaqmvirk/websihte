import library from "./discord-bot-clarinet-library.json";
import { parseClarinetScore } from "./discord-bot-clarinet-score";

export const CLARINET_LIBRARY_COUNT = library.entries.length;
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const ignored = new Set("a an the i me my you your can could would will please pls plz play do give make perform sing song songs tune tunes music clarinet on of for to by from version rendition squd hey it that again same one something anything random some".split(" "));
const words = (value: string) => normalize(value).split(" ").filter((word) => word && !ignored.has(word));
const artistAliases = [
  [/john lennon|paul mccartney|george harrison/i, "beatles"],
  [/freddie mercury|freddy mercury|brian may|roger taylor|john deacon/i, "queen"],
  [/benny andersson|benny anderson|bjorn ulvaeus|bjorn valaeus/i, "abba"],
] as const;
const entries = library.entries.map((entry) => {
  const artist = normalize(entry.artists.join(" "));
  const aliases = artistAliases.filter(([pattern]) => pattern.test(artist)).map(([, alias]) => alias);
  return { entry, title: normalize(entry.title), titleWords: [...new Set(words(entry.title))],
    artists: [...entry.artists.map(normalize), ...aliases.map(normalize)] };
});
const byId = new Map(library.entries.map((entry) => [entry.song, entry]));
const titleFrequency = new Map<string, number>();
for (const { titleWords } of entries) for (const word of titleWords) titleFrequency.set(word, (titleFrequency.get(word) ?? 0) + 1);

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
  return edits + (a.length - left) + (b.length - right) <= 1;
}

export function searchClarinetLibrary(query: string, limit = 8) {
  const normalized = normalize(query.slice(0, 2_000)), tokens = words(normalized);
  if (!normalized || !Number.isInteger(limit) || limit < 1) return [];
  const phrase = ` ${normalized} `;
  const ranked = entries.map(({ entry, title, titleWords, artists }) => {
    const exact = phrase.includes(` ${title} `);
    const compact = title.replaceAll(" ", "");
    const joined = compact.length >= 6 && tokens.some((token) => token === compact);
    const matched = titleWords.filter((word) => tokens.some((token) => almostEqual(token, word))).length;
    const coverage = matched / Math.max(1, titleWords.length);
    const queryCoverage = tokens.filter((token) => titleWords.some((word) => almostEqual(token, word))).length / Math.max(1, tokens.length);
    const uniquePartial = tokens.length === 1 && tokens[0].length >= 4
      && titleWords.includes(tokens[0]) && titleFrequency.get(tokens[0]) === 1;
    const titleScore = (coverage === 1 && queryCoverage >= 0.6) || uniquePartial ? coverage * 35 + matched : 0;
    const artistScore = artists.some((artist) => phrase.includes(` ${artist} `)) ? 25 : 0;
    return { entry, score: (exact || joined ? 100 + title.length : 0) + titleScore + artistScore };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.entry.song.localeCompare(b.entry.song));
  return ranked.slice(0, Math.min(8, limit)).map(({ entry }) => entry);
}

const popular = ["Take On Me", "Bohemian Rhapsody", "Dancing Queen", "Here Comes the Sun",
  "Hey Jude", "Careless Whisper", "Dream a Little Dream of Me", "Over the Rainbow"];

export function selectClarinetLibrarySongs(question: string, history: string[] = []) {
  const current = searchClarinetLibrary(question);
  if (current.length) return current;
  if (/\b(?:random|anything|something)\b/i.test(question)) {
    return popular.flatMap((title) => searchClarinetLibrary(title, 1));
  }
  // Follow-ups can refer to a named tune in recent conversation without repeating its title.
  if (!words(question).length && /\b(?:again|that|it|same)\b/i.test(question)) {
    for (const text of history.slice(-3).reverse()) {
      const matches = searchClarinetLibrary(text);
      if (matches.length) return matches;
    }
  }
  return [];
}

export function getClarinetLibraryScore(song: string) {
  const entry = byId.get(song);
  if (!entry) throw new Error("Unknown clarinet library song");
  return parseClarinetScore(entry.score);
}
