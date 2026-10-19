import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { writeMidi } from "midi-file";
import curated from "./discord-bot-clarinet-library.json";
import discover from "./discord-bot-clarinet-discover.json";
import metadata from "../../public/discord/squd/library.json";
import modernSources from "../../scripts/squd-modern-sources.json";
import { CLARINET_LIBRARY_COUNT, createClarinetLibrary, getClarinetLibraryScore, searchClarinetLibrary } from "./discord-bot-clarinet-library";
import { renderClarinetScore } from "./discord-bot-clarinet-render";
const OpusScript = createRequire(import.meta.url)("opusscript") as typeof import("opusscript");
const hash = "1234567890abcdef1234567890abcdef";
const rows = [
  { hash, title: "Never Gonna Give You Up", artist: "Rick Astley", genre: "Pop" },
  { hash: "2".repeat(32), title: "Never Gonna Give You Up", artist: "Rick Astley", genre: "Pop" },
  { hash: "3".repeat(32), title: "Take On Me", artist: "A-ha", genre: "Pop" },
  { hash: "4".repeat(32), title: "Dancing Queen", artist: "ABBA", genre: "Pop" },
  { hash: "5".repeat(32), title: "Queen", artist: "Other Artist", genre: "Rock" },
  { hash: "6".repeat(32), title: "Bohemian Rhapsody", artist: "G4 12", genre: "Pop" },
  { hash: "7".repeat(32), title: "Bohemian Rhapsody", artist: "Queen 3 (1)", genre: "Rock" },
  { hash: "8".repeat(32), title: "By The Way", artist: "Red Hot Chili Peppers", genre: "Rock" },
  { hash: "9".repeat(32), title: "Stand By Me", artist: "Ben E. King", genre: "Pop" },
];
const midi = Buffer.from(writeMidi({ header: { format: 0, numTracks: 1, ticksPerBeat: 480 }, tracks: [[
  ...[60, 62, 64, 65].flatMap((noteNumber) => [
    { deltaTime: 0, type: "noteOn" as const, channel: 0, noteNumber, velocity: 100 },
    { deltaTime: 480, type: "noteOff" as const, channel: 0, noteNumber, velocity: 0 },
  ]), { deltaTime: 0, type: "endOfTrack" },
]] }));
const archive = { has: async (id: string) => id === hash, midi: async () => midi };
const fixture = () => createClarinetLibrary(async () => ({ search: () => rows }), archive);

describe("Squd whole-archive melody library", () => {
  it("indexes the full source while reporting the named subset accurately", async () => {
    assert.equal(CLARINET_LIBRARY_COUNT, 6_747_346);
    assert.equal(discover.shards.length, 256);
    assert.equal(discover.catalog.namedFiles, 586_297);
    assert.equal(metadata.indexedMidiFiles, CLARINET_LIBRARY_COUNT);
    assert.equal(metadata.titleLabels, discover.catalog.distinctTitles);
    assert.equal(metadata.entries.length, 28);
    assert.equal(curated.entries.length, 28);
    for (const entry of curated.entries) {
      const score = await getClarinetLibraryScore(entry.song);
      assert.ok(score.notes.length >= 4 && score.notes.length <= 24);
      assert.ok(score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm <= 7);
    }
    await assert.rejects(getClarinetLibraryScore("../../arbitrary.mid"));
  });
  it("keeps every modern hook and original alias available without a remote dependency", async () => {
    for (const row of modernSources.entries) for (const name of [row.title, ...row.aliases]) {
      assert.equal((await searchClarinetLibrary(`play ${name}`))[0]?.song, `os_${row.id}`, name);
    }
    for (const [query, song] of [["happy bday", "happy_birthday"], ["weezer lick", "weezer_buddy_holly"],
      ["spongebob opening theme nose flute", "spongebob_nose_flute"]]) {
      assert.equal((await searchClarinetLibrary(`play ${query}`))[0]?.song, `core_${song}`, query);
    }
  });
  it("finds actual catalog labels, deduplicates versions and recognizes rickroll", async () => {
    const library = fixture();
    assert.equal((await library.search("play Never Gonna Give You Up"))[0]?.song, `discover_${hash}`);
    assert.equal((await library.search("rickroll"))[0]?.song, `discover_${hash}`);
    assert.equal((await library.search("play never gonna give you up")).length, 1);
    assert.equal((await library.search("takeonme"))[0]?.title, "Take On Me");
    assert.equal((await library.search("play dancing quen"))[0]?.title, "Dancing Queen");
    assert.equal((await library.search("abba"))[0]?.title, "Dancing Queen");
    assert.deepEqual((await library.search("play Bohemian Rhapsody by Queen"))[0]?.artists, ["Queen 3 (1)"]);
    assert.equal((await library.search("play By The Way"))[0]?.title, "By The Way");
    assert.equal((await library.search("play Stand By Me"))[0]?.title, "Stand By Me");
    assert.deepEqual(await library.search("play Never Gonna Give You Up by zqxv"), []);
  });
  it("refuses unknown titles and prevents artist or conversation history substitution", async () => {
    const library = fixture();
    for (const query of ["play an unreleased song called zqxv", "play zqxv by ABBA", "play zqxv by Queen", "play random zqxv"]) {
      assert.deepEqual(await library.select(query, ["play Dancing Queen"]), [], query);
    }
    assert.equal((await library.select("play it again", ["play Dancing Queen"]))[0]?.title, "Dancing Queen");
    assert.equal((await library.select("play Take On Me", ["play Dancing Queen"]))[0]?.title, "Take On Me");
    assert.equal((await library.select("play something random")).length, 8);
    assert.deepEqual(await library.search(""), []);
    assert.deepEqual(await library.search("abba", 0), []);
    assert.ok((await library.search("abba", 500)).length <= 8);
  });
  it("looks up unnamed files by validated ID and extracts real MIDI notes on demand", async () => {
    let calls = 0;
    const library = createClarinetLibrary(async () => ({ search: () => rows }), { ...archive, midi: async () => { calls++; return midi; } });
    assert.equal((await library.search(`play ${hash}`))[0]?.song, `discover_${hash}`);
    assert.deepEqual(await library.search("0".repeat(32)), []);
    const score = await library.score(`discover_${hash}`);
    assert.deepEqual(score.notes.map((note) => note.pitch), [60, 62, 64, 65]);
    assert.deepEqual(await library.score(`discover_${hash}`), score);
    assert.equal(calls, 1);
    const broken = createClarinetLibrary(async () => ({ search: () => [] }), { ...archive, midi: async () => { throw new Error("unavailable"); } });
    await assert.rejects(broken.score(`discover_${hash}`), /unavailable/);
  });
  it("renders every retained modern score through the existing native voice encoder", async () => {
    for (const row of modernSources.entries) {
      const clip = await renderClarinetScore(await getClarinetLibraryScore(`os_${row.id}`), "1560000000000000002");
      assert.ok(clip.duration > 1 && clip.duration <= 10, row.title);
      const bytes = Buffer.from(clip.bytes), decoder = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
      let samples = 0, nonzero = false;
      try {
        for (let offset = 0; offset < bytes.length;) {
          assert.equal(bytes.subarray(offset, offset + 4).toString(), "OggS");
          const segments = bytes[offset + 26]; let length = 0;
          for (let index = 0; index < segments; index++) length += bytes[offset + 27 + index];
          const packet = bytes.subarray(offset + 27 + segments, offset + 27 + segments + length);
          if (!/^Opus(?:Head|Tags)$/.test(packet.subarray(0, 8).toString())) {
            const decoded = decoder.decode(packet); samples += decoded.length;
            nonzero ||= decoded.some((value) => value !== 0);
          }
          offset += 27 + segments + length;
        }
      } finally { decoder.delete(); }
      assert.ok(samples > 48_000 && nonzero, row.title);
    }
  });
});
