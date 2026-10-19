import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import library from "./discord-bot-clarinet-library.json";
import catalog from "../../public/discord/squd/library.json";
import modernSources from "../../scripts/squd-modern-sources.json";
import { CLARINET_LIBRARY_COUNT, getClarinetLibraryScore, searchClarinetLibrary, selectClarinetLibrarySongs } from "./discord-bot-clarinet-library";
import { renderClarinetScore } from "./discord-bot-clarinet-render";
const OpusScript = createRequire(import.meta.url)("opusscript") as typeof import("opusscript");

describe("Squd scored melody library", () => {
  it("contains 1028 distinct bounded melodies with separate source attribution", () => {
    assert.equal(CLARINET_LIBRARY_COUNT, 1028);
    assert.equal(new Set(library.entries.map(({ song }) => song)).size, 1028);
    const wiki = library.sources.find((source) => "license" in source);
    assert.equal(wiki?.license, "CC-BY-NC-4.0");
    assert.equal(wiki?.revision, "ebb5a7b65dc0760467916c3287960bc89c6faa23");
    assert.deepEqual(catalog.sources, library.sources);
    assert.deepEqual(catalog.entries, library.entries.map(({ score, ...entry }) => { void score; return entry; }));
    for (const [prefix, count] of [["wikimt_", 1000], ["os_", 18], ["core_", 10]] as const) {
      assert.equal(library.entries.filter(({ song }) => song.startsWith(prefix)).length, count);
    }
    for (const entry of library.entries) {
      const score = getClarinetLibraryScore(entry.song);
      assert.ok(score.notes.length >= 4 && score.notes.length <= 24);
      assert.ok(score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm <= 7);
      assert.ok(!Object.keys(entry).some((key) => !["artists", "genre", "score", "song", "title", "aliases"].includes(key)));
      assert.notEqual(score.notes[0].pitch, null);
    }
    assert.throws(() => getClarinetLibraryScore("../../arbitrary.mid"));
  });
  it("retrieves every exact title as the first result", () => {
    for (const { title, song } of library.entries) assert.equal(searchClarinetLibrary(`play ${title}`)[0]?.song, song, title);
  });
  it("recognizes punctuation compact titles small typos partial titles and band aliases", () => {
    for (const [query, expected] of [["takeonme", "Take On Me"], ["bohemian rapsody", "Bohemian Rhapsody"],
      ["play dancing quen", "Dancing Queen"], ["careless", "Careless Whisper"]]) {
      assert.equal(searchClarinetLibrary(query)[0]?.title, expected);
    }
    for (const [query, title] of [["abba", "Dancing Queen"], ["queen", "Bohemian Rhapsody"], ["beatles", "All You Need Is Love"]]) {
      assert.ok(searchClarinetLibrary(query).some((entry) => entry.title === title));
    }
  });
  it("recognizes all imported modern titles and familiar meme aliases", () => {
    for (const row of modernSources.entries) {
      for (const name of [row.title, ...row.aliases]) {
        assert.equal(searchClarinetLibrary(`play ${name}`)[0]?.song, `os_${row.id}`, name);
      }
    }
    for (const [query, song] of [["happy bday", "happy_birthday"], ["weezer lick", "weezer_buddy_holly"],
      ["spongebob opening theme nose flute", "spongebob_nose_flute"]]) {
      assert.equal(searchClarinetLibrary(`play ${query}`)[0]?.song, `core_${song}`, query);
    }
  });
  it("does not replace an unknown title with repeated keywords or an old song", () => {
    for (const query of ["play never gonna give you up", "play let it be", "play an unreleased song called zqxv"]) {
      assert.deepEqual(selectClarinetLibrarySongs(query, ["play Dancing Queen"]), [], query);
    }
    assert.equal(selectClarinetLibrarySongs("play it again", ["play Dancing Queen"])[0]?.title, "Dancing Queen");
    assert.equal(selectClarinetLibrarySongs("play Take On Me", ["play Dancing Queen"])[0]?.title, "Take On Me");
  });
  it("bounds candidates and supplies familiar choices for an unspecified random tune", () => {
    for (const query of ["love", "beatles", "something random"]) assert.ok(selectClarinetLibrarySongs(query).length <= 8);
    assert.equal(selectClarinetLibrarySongs("play something random").length, 8);
    assert.deepEqual(searchClarinetLibrary(""), []);
    assert.deepEqual(searchClarinetLibrary("abba", 0), []);
    assert.ok(searchClarinetLibrary("abba", 500).length <= 8);
  });
  it("renders three actual scored openings through the native voice encoder", async () => {
    for (const title of ["Take On Me", "Bohemian Rhapsody", "Careless Whisper"]) {
      const entry = searchClarinetLibrary(title)[0];
      const clip = await renderClarinetScore(getClarinetLibraryScore(entry.song), "1560000000000000002");
      assert.ok(clip.duration > 1 && clip.duration < 10);
      assert.equal(Buffer.from(clip.bytes).subarray(0, 4).toString(), "OggS");
      assert.ok(Buffer.from(clip.waveform, "base64").some((value) => value > 0));
    }
  });
  it("renders every modern import as decodable short clarinet audio", async () => {
    for (const row of modernSources.entries) {
      const clip = await renderClarinetScore(getClarinetLibraryScore(`os_${row.id}`), "1560000000000000002");
      assert.ok(clip.duration > 1 && clip.duration <= 10, row.title);
      const bytes = Buffer.from(clip.bytes), decoder = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
      let samples = 0, nonzero = false;
      try {
        for (let offset = 0; offset < bytes.length;) {
          assert.equal(bytes.subarray(offset, offset + 4).toString(), "OggS");
          const segments = bytes[offset + 26];
          let length = 0;
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
