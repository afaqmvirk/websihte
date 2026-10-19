import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export type DiscoverCatalogManifest = {
  url: string; bytes: number; sha256: string; decodedBytes: number; decodedSha256: string;
  namedFiles: number; nameRecords: number; distinctTitles: number;
};
export type CatalogRow = { hash: string; title: string; artist: string; genre: string };
type Statement = { all(...values: string[]): CatalogRow[]; finalize?(): void };
type Database = { prepare(sql: string): Statement; exec(sql: string): unknown; close(force?: boolean): unknown };
const nativeRequire = createRequire(import.meta.url);

export function openSongCatalog(path: string) {
  // Bun runs the repository's tests; deployed functions use Node's built-in SQLite.
  // Turbopack rewrites dynamic require expressions; load Node built-ins directly.
  const sqlite = (process.versions.bun ? Reflect.apply(nativeRequire, undefined, ["bun:sqlite"])
    : process.getBuiltinModule("node:sqlite")) as { Database?: new(path: string, options: object) => Database;
    DatabaseSync?: new(path: string, options: object) => Database };
  const db = process.versions.bun ? new sqlite.Database!(path, { readonly: true, create: false })
    : new sqlite.DatabaseSync!(path, { readOnly: true, allowExtension: false });
  db.exec("PRAGMA query_only=ON; PRAGMA cache_size=-4096; PRAGMA mmap_size=0;");
  const exact = db.prepare("SELECT lower(hex(hash)) AS hash,title,artist,genre FROM catalog WHERE normalized_title=? ORDER BY length(artist),length(title) LIMIT 40");
  const match = db.prepare("SELECT lower(hex(c.hash)) AS hash,c.title,c.artist,c.genre FROM search JOIN catalog c ON c.rowid=search.rowid WHERE search MATCH ? ORDER BY bm25(search) LIMIT 100");
  return {
    search(terms: string[], title: string) {
      const words = [...new Set(terms.filter((word) => /^[\p{L}\p{N}]{2,40}$/u.test(word)))].slice(0, 8);
      const direct = title ? exact.all(title.slice(0, 180)) : [];
      if (!words.length) return direct;
      const found = match.all(words.map((word) => `"${word}"`).join(" OR "));
      const rows = new Map<string, CatalogRow>();
      for (const row of [...direct, ...found]) if (/^[a-f0-9]{32}$/.test(row.hash)) rows.set(row.hash, row);
      return [...rows.values()];
    },
    close() { exact.finalize?.(); match.finalize?.(); db.close(); },
  };
}

export async function loadSongCatalog(manifest: DiscoverCatalogManifest, options: {
  fetcher?: typeof fetch; directory?: string;
} = {}) {
  if (!/^[a-f0-9]{64}$/.test(manifest.decodedSha256) || manifest.bytes < 1 || manifest.bytes > 80 * 1024 * 1024
    || manifest.decodedBytes < 1 || manifest.decodedBytes > 192 * 1024 * 1024) throw new Error("Catalog exceeds cache bounds");
  const path = join(options.directory ?? tmpdir(), `squd-discover-${manifest.decodedSha256}.sqlite`);
  let valid = false;
  try {
    const bytes = await readFile(path);
    valid = bytes.length === manifest.decodedBytes && createHash("sha256").update(bytes).digest("hex") === manifest.decodedSha256;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (!valid) {
    const response = await (options.fetcher ?? fetch)(manifest.url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("Song catalog unavailable"); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > manifest.bytes) { await reader.cancel(); throw new Error("Song catalog exceeds expected size"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const compressed = Buffer.concat(chunks, length);
    if (length !== manifest.bytes || createHash("sha256").update(compressed).digest("hex") !== manifest.sha256) throw new Error("Song catalog checksum mismatch");
    const bytes = gunzipSync(compressed, { maxOutputLength: manifest.decodedBytes });
    if (bytes.length !== manifest.decodedBytes || createHash("sha256").update(bytes).digest("hex") !== manifest.decodedSha256) throw new Error("Decoded catalog checksum mismatch");
    const temporary = `${path}.${randomUUID()}.part`;
    await writeFile(temporary, bytes, { flag: "wx" });
    try { await rename(temporary, path); }
    finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }
  return openSongCatalog(path);
}
