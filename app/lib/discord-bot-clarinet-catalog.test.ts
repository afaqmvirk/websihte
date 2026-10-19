import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { loadSongCatalog, openSongCatalog, type DiscoverCatalogManifest } from "./discord-bot-clarinet-catalog";

const nativeRequire = createRequire(import.meta.url);
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "squd-catalog-test-")), path = join(directory, "source.sqlite");
  const moduleName = process.versions.bun ? "bun:sqlite" : "node:sqlite", sqlite = nativeRequire(moduleName);
  const db = process.versions.bun ? new sqlite.Database(path) : new sqlite.DatabaseSync(path);
  db.exec("CREATE TABLE catalog(hash BLOB,title TEXT,artist TEXT,genre TEXT,normalized_title TEXT,normalized_artist TEXT); CREATE VIRTUAL TABLE search USING fts5(normalized_title,normalized_artist,content='catalog',content_rowid='rowid');");
  const insert = db.prepare("INSERT INTO catalog VALUES(?,?,?,?,?,?)");
  for (const [index, title, artist] of [[1, "Never Gonna Give You Up", "Rick Astley"], [2, "Take On Me", "A-ha"], [3, "Believer", "Imagine Dragons"]] as const) {
    insert.run(Buffer.from(index.toString(16).padStart(32, "0"), "hex"), title, artist, "Pop", title.toLowerCase(), artist.toLowerCase());
  }
  db.exec("INSERT INTO search(search) VALUES('rebuild');"); insert.finalize?.(); db.close();
  const bytes = await readFile(path), compressed = gzipSync(bytes);
  const manifest: DiscoverCatalogManifest = { url: "https://example.test/catalog.sqlite.gz", bytes: compressed.length,
    sha256: createHash("sha256").update(compressed).digest("hex"), decodedBytes: bytes.length,
    decodedSha256: createHash("sha256").update(bytes).digest("hex"), namedFiles: 3, nameRecords: 3, distinctTitles: 3 };
  return { directory, path, compressed, manifest };
}

describe("read-only title catalog", () => {
  it("retrieves exact titles and FTS artists with parameterized bounded queries", async () => {
    const f = await fixture(), catalog = openSongCatalog(f.path);
    try {
      assert.equal(catalog.search(["never", "gonna"], "never gonna give you up")[0].artist, "Rick Astley");
      assert.equal(catalog.search(["dragons"], "")[0].title, "Believer");
      assert.deepEqual(catalog.search(['" OR 1=1; DROP TABLE catalog;--'], "'; DROP TABLE catalog;--"), []);
      assert.equal(catalog.search(["believer"], "").length, 1);
    } finally { catalog.close(); await rm(f.directory, { recursive: true, force: true }); }
  });
  it("verifies a cold download then reuses the verified ephemeral cache", async () => {
    const f = await fixture(); let calls = 0;
    const fetcher: typeof fetch = async (url) => { assert.equal(String(url), f.manifest.url); calls++; return new Response(f.compressed); };
    try {
      const cold = await loadSongCatalog(f.manifest, { directory: f.directory, fetcher });
      assert.equal(cold.search(["believer"], "")[0].artist, "Imagine Dragons"); cold.close();
      const warm = await loadSongCatalog(f.manifest, { directory: f.directory, fetcher }); warm.close();
      assert.equal(calls, 1);
      await writeFile(join(f.directory, `squd-discover-${f.manifest.decodedSha256}.sqlite`), "corrupted cache");
      const repaired = await loadSongCatalog(f.manifest, { directory: f.directory, fetcher }); repaired.close();
      assert.equal(calls, 2);
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });
  it("rejects unavailable truncated oversized or altered catalogs", async () => {
    const f = await fixture();
    try {
      for (const response of [new Response(null, { status: 503 }), new Response(f.compressed.subarray(0, 10)),
        new Response(Buffer.concat([f.compressed, Buffer.alloc(1)])), new Response(Buffer.alloc(f.compressed.length))]) {
        await assert.rejects(loadSongCatalog(f.manifest, { directory: f.directory, fetcher: async () => response }));
      }
      await assert.rejects(loadSongCatalog({ ...f.manifest, decodedBytes: 300 * 1024 * 1024 }));
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });
});
