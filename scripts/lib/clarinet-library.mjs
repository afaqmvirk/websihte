import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { writeSqudCatalog } from "./write-squd-catalog.mjs";
export { compileClarinetExcerpt, compileClarinetPassage } from "../../app/lib/discord-bot-clarinet-compile.mjs";

// Both ABC and Online Sequencer imports use this same bounded quarter-note format.
export async function writeClarinetCollection(root, source, imported) {
  const path = join(root, "app/lib/discord-bot-clarinet-library.json");
  const previous = JSON.parse(await readFile(path, "utf8"));
  const oldSources = previous.sources ?? [{ id: "wikimt", source: previous.source,
    revision: previous.revision, sha256: previous.sha256, license: previous.license }];
  const start = previous.entries.findIndex((entry) => entry.song.startsWith(`${source.id}_`));
  const entries = previous.entries.filter((entry) => !entry.song.startsWith(`${source.id}_`));
  entries.splice(start < 0 ? entries.length : start, 0, ...imported);
  const sources = [...oldSources.filter((entry) => entry.id !== source.id), source].sort((a, b) => a.id.localeCompare(b.id));
  const metadata = { count: entries.length, sources };
  await writeFile(path, JSON.stringify({ ...metadata, entries }) + "\n");
  await writeSqudCatalog(root);
}
