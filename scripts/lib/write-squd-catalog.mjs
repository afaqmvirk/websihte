import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeSqudCatalog(root) {
  const archive = JSON.parse(await readFile(join(root, "app/lib/discord-bot-clarinet-discover.json"), "utf8"));
  const curated = JSON.parse(await readFile(join(root, "app/lib/discord-bot-clarinet-library.json"), "utf8"));
  const metadata = { indexedMidiFiles: archive.midiCount, namedMidiFiles: archive.catalog.namedFiles,
    titleLabels: archive.catalog.distinctTitles, curatedReferences: curated.entries.length,
    search: "https://www.stupideas.com/api/discord/clarinet-library?q=never%20gonna%20give%20you%20up",
    description: "Searchable title labels are a subset of the full archive. MIDI file counts include multiple arrangements, versions and unnamed files. Playback requires a matching playable score; unknown or unavailable scores are refused.",
    sources: [{ id: "discover", source: "https://huggingface.co/datasets/projectlosangeles/Discover-MIDI-Dataset",
      revision: "0eaecb5b1c1be02751f4dca97bb9b25e8408e498", license: "CC-BY-NC-SA-4.0",
      sourceArchive: archive.source, index: archive.pack, catalog: archive.catalog,
      notice: "https://www.stupideas.com/discord/squd/Discover-MIDI-NOTICE.md" }, ...curated.sources],
    entries: curated.entries.map(({ score, passages, ...entry }) => { void score; void passages; return entry; }) };
  await writeFile(join(root, "public/discord/squd/library.json"), JSON.stringify(metadata, null, 2) + "\n");
}
