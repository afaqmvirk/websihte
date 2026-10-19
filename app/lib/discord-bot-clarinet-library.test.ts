import assert from "node:assert/strict";
import { describe, it } from "node:test";
import library from "./discord-bot-clarinet-library.json";
import catalog from "../../public/discord/squd/library.json";
import { CLARINET_LIBRARY_COUNT, getClarinetLibraryScore, searchClarinetLibrary, selectClarinetLibrarySongs } from "./discord-bot-clarinet-library";
import { renderClarinetScore } from "./discord-bot-clarinet-render";

describe("Squd scored melody library", () => {
  it("contains 1000 distinct bounded melodies and an attributed title catalog", () => {
    assert.equal(CLARINET_LIBRARY_COUNT, 1000);
    assert.equal(new Set(library.entries.map(({ song }) => song)).size, 1000);
    assert.equal(library.license, "CC-BY-NC-4.0");
    assert.equal(library.revision, "ebb5a7b65dc0760467916c3287960bc89c6faa23");
    assert.deepEqual(catalog.entries, library.entries.map(({ song, title, artists, genre }) => ({ song, title, artists, genre })));
    for (const entry of library.entries) {
      const score = getClarinetLibraryScore(entry.song);
      assert.ok(score.notes.length >= 4 && score.notes.length <= 24);
      assert.ok(score.notes.reduce((sum, note) => sum + note.beats, 0) * 60 / score.tempo_bpm <= 7);
      assert.deepEqual(Object.keys(entry).sort(), ["artists", "genre", "score", "song", "title"]);
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
  it("does not replace an unknown title with repeated keywords or an old song", () => {
    for (const query of ["play never gonna give you up", "play let it be", "play megalovania"]) {
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
});
