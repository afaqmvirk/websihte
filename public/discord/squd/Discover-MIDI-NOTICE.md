# Discover MIDI index and playback source

Source: [Discover MIDI Dataset](https://huggingface.co/datasets/projectlosangeles/Discover-MIDI-Dataset),
Project Los Angeles / Tegridy Code, Alex Lev, 2025.
Source revision: `0eaecb5b1c1be02751f4dca97bb9b25e8408e498`.
The publisher distributes this archive under
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/).
The derived song metadata, byte index, and compressed seek dictionaries retain
those terms. Composition and arrangement rights remain with their respective holders.
No endorsement or blanket licence over the underlying compositions is asserted.

The publisher credits Project Los Angeles / Tegridy Code; BreadAi's Sourdough MIDI
Dataset; Louis Bradshaw and Simon Colton's Aria-MIDI; and the Godzilla and Tegridy
MIDI collections. See the source dataset card for its complete bibliography,
upstream sources, and dataset documentation. Artist/title labels and available
arranger credits are retained as supplied, with control characters and excess
whitespace removed. These labels can contain errors or version suffixes.

Pinned source: `Discover-MIDI-Dataset-CC-BY-NC-SA.tar.gz`, 29,378,161,788 bytes.
SHA-256: `64fc6e1f0ab5bbd595d676549f3e315fd3d05f7f74d79f1c689f72c0e89d2357`.

Changes for Squd: stream and verify the complete archive; index 6,747,346 actual
MIDI files by their MD5, TAR offset, and length; add byte-aligned gzip seek points
and compressed 32 KiB dictionaries; build a read-only title/artist FTS catalog;
validate named records against actual archived files; normalize search labels;
and retrieve bounded byte ranges when a selected score is played. The catalog
contains 586,297 named files and 152,057 distinct normalized title labels. Counts
include different arrangements and versions; they do not mean distinct songs.
Unnamed files can be retrieved by their exact 32-character MD5 ID.

For playback, select a scored melodic part, omit drums/accompaniment, and choose
a message-seeded section from throughout that track. Target 10–15 seconds;
short melodies finish naturally. Move pitches by octaves into concert MIDI 55–82,
bound each score to 128 notes/rests and fifteen seconds, and use the existing
sampled clarinet renderer with deliberate mistakes and gentler brief overblows
capped at MIDI 86. Source MIDI is cached without fixing subsequent messages to
one opening. No lyrics, original audio, remote scripts, or model-generated notes
are used. Missing, unavailable, oversized, or unplayable scores are refused.

The public derived index and title catalog are available in the
[Squd archive release](https://github.com/afaqmvirk/websihte/releases/tag/squd-discover-0eaecb5-v1).
Their exact sizes and checksums are recorded in `library.json` beside this notice;
the seek manifest and reproducible build scripts are in that repository.
The full MIDI archive remains on its existing Hugging Face host.
