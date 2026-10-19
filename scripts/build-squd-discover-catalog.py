"""Build a small read-only FTS catalog from the pinned archive's own song metadata."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import unicodedata

root = Path(os.environ.get("SQUD_DISCOVER_INDEX", ".vercel/verification/squd-discover-index")).resolve()
source = json.loads((root / "source-verified.json").read_text(encoding="utf-8"))
summary = json.loads((root / "index-summary.json").read_text(encoding="utf-8"))
metadata = root / "metadata"
genres = json.loads((metadata / "._DATA_Genres_MIDIs_genres_data.jsonl").read_text(encoding="utf-8"))
by_hash = {}
for genre, artists in genres.items():
    for titles in artists.values():
        for hashes in titles.values():
            for md5 in hashes:
                by_hash.setdefault(md5.zfill(32), set()).add(genre)

path = root / f"catalog.build-{os.getpid()}.sqlite"
with path.open("xb"):
    pass
db = sqlite3.connect(path)
db.executescript("""
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
CREATE TABLE catalog (
    hash BLOB NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, genre TEXT NOT NULL,
    normalized_title TEXT NOT NULL, normalized_artist TEXT NOT NULL
);
""")

def normalize(text):
    text = unicodedata.normalize("NFKD", text).lower().replace("'", "").replace("’", "")
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^\w]+", " ", text, flags=re.UNICODE).strip().replace("_", " ")

def label(value):
    value = re.sub(r"[\x00-\x1f\x7f]", " ", str(value))
    return re.sub(r"\s+", " ", value).strip()[:180]

cached_prefix, valid_hashes, batch, rejected = None, set(), [], 0
with (metadata / "._DATA_Identified_MIDIs_identified_midis.jsonl").open(encoding="utf-8") as lines:
    for line in lines:
        row = json.loads(line)
        md5 = str(row.get("md5", "")).zfill(32)
        if not re.fullmatch(r"[0-9a-f]{32}", md5):
            rejected += 1
            continue
        prefix = md5[:2]
        if prefix != cached_prefix:
            index = (root / f"midis-{prefix}.bin").read_bytes()
            valid_hashes = {index[offset:offset + 16] for offset in range(0, len(index), 28)}
            cached_prefix = prefix
        binary = bytes.fromhex(md5)
        title, artist = label(row.get("title", "")), label(row.get("artist", ""))
        if binary not in valid_hashes or not title or not normalize(title):
            rejected += 1
            continue
        batch.append((binary, title, artist, ", ".join(sorted(by_hash.get(md5, set())))[:180], normalize(title), normalize(artist)))
        if len(batch) >= 2000:
            db.executemany("INSERT OR IGNORE INTO catalog VALUES (?,?,?,?,?,?)", batch)
            batch.clear()
    db.executemany("INSERT OR IGNORE INTO catalog VALUES (?,?,?,?,?,?)", batch)
db.commit()
db.executescript("""
CREATE VIRTUAL TABLE search USING fts5(normalized_title,normalized_artist,content='catalog',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2');
INSERT INTO search(search) VALUES ('rebuild');
CREATE INDEX catalog_title ON catalog(normalized_title);
VACUUM;
""")
named_files, names = db.execute("SELECT count(DISTINCT hash),count(*) FROM catalog").fetchone()
titles = db.execute("SELECT count(DISTINCT normalized_title) FROM catalog").fetchone()[0]
examples = {}
for query in ["never gonna give you up", "espresso", "apt", "birds of a feather", "anti hero", "despair", "believer", "megalovania"]:
    examples[query] = db.execute("SELECT title,artist FROM catalog WHERE normalized_title=? LIMIT 3", (query,)).fetchall()
db.close()
os.replace(path, root / "catalog.sqlite")
path = root / "catalog.sqlite"
archive = root / "catalog.sqlite.gz"
with path.open("rb") as original, archive.open("wb") as output:
    with gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed:
        shutil.copyfileobj(original, compressed, 1024 * 1024)
catalog = {
    "file": "catalog.sqlite.gz",
    "bytes": archive.stat().st_size,
    "sha256": hashlib.file_digest(archive.open("rb"), "sha256").hexdigest(),
    "decodedBytes": path.stat().st_size,
    "decodedSha256": hashlib.file_digest(path.open("rb"), "sha256").hexdigest(),
    "namedFiles": named_files, "nameRecords": names, "distinctTitles": titles,
}
report = {"indexedMidis": summary["midis"], "catalog": catalog, "rejectedMetadata": rejected, "examples": examples}
(root / "catalog-summary.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
