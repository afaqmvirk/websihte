# Online Sequencer melody excerpts

Source: https://onlinesequencer.net/.
Collection and individual arrangement credits, source URLs, pinned sequence
checksums, selected melody instruments, hook start positions, and title aliases
are retained in `online-sequencer-sources.json` beside this notice.

The source arrangements are community contributions. Credit for each arrangement
belongs to its named Online Sequencer contributor; the original compositions
remain the work of their credited artists and writers. No blanket license over
those compositions or arrangements is asserted here. These short instrumental
excerpts do not imply endorsement by the artists, arrangers, or Online Sequencer.

Changes for Squd: select one melody instrument and eight varied scored sections,
remove accompaniment and leading silence, collapse simultaneous chord tones to
the upper melody, convert sixteenth-note sequence steps to quarter-note beats,
shorten long holds, transpose by octaves into concert MIDI 55–82, and retain at
most 128 notes/rests and fifteen seconds per section. Playback targets 10–15
seconds and short hooks finish naturally. A message-ID seed selects a section
without another network or model request. The shared clarinet renderer adds
uneven timing, pitch wobble, and gentler brief squeaks capped at MIDI 86.
Full arrangements, original recordings,
lyrics, downloaded site JavaScript, and source sequence files are not distributed.

Build-time import uses the same note events and timebase as Online Sequencer's
MIDI export. Rebuild with `node scripts/import-squd-modern.mjs`; source files are
cached locally under the ignored `.vercel/verification/squd-modern` directory and
checked against pinned SHA-256 values. Playback uses the existing local catalog,
Luna selection call, instrument samples, and Opus renderer. It performs no runtime
Online Sequencer request and uses no additional paid API or subscription.
