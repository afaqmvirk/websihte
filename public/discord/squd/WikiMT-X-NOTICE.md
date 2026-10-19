# WikiMT-X melody excerpts

Source: https://huggingface.co/datasets/sander-wood/wikimt-x

Dataset authors: Shangda Wu, Zhancheng Guo, Ruibin Yuan, Junyan Jiang,
Seungheon Doh, Gus Xia, Juhan Nam, Xiaobing Li, Feng Yu, and Maosong Sun.

Reference: *CLaMP 3: Universal Music Information Retrieval Across Unaligned
Modalities and Unseen Languages* (2025), https://arxiv.org/abs/2502.10362.

Dataset license: Creative Commons Attribution-NonCommercial 4.0 International
(CC BY-NC 4.0). The full terms are in `WikiMT-X-LICENSE.txt` alongside this notice:
https://creativecommons.org/licenses/by-nc/4.0/.
This data is for noncommercial use. Rights in the original compositions remain
with their respective holders; the dataset license does not transfer those rights.

Pinned dataset revision: `ebb5a7b65dc0760467916c3287960bc89c6faa23`.
Source JSONL SHA-256: `128b4385e232ec4f1239e68daea1adcf911ba8b37ed1dff58d6476171920e6aa`.

Changes for Squd: extract the first melodic voice, remove leading silence and
lyrics, keep a short opening excerpt, shorten long holds, transpose by octaves
into a bounded clarinet register, and store pitches and quarter-note durations.
No original recording, full lead sheet, lyric, or generated caption is distributed
here. The clarinet renderer adds deliberately uneven timing, pitch wobble, and
squeaks. This adaptation does not imply endorsement by the dataset authors or
songwriters. Individual song titles, credited artists/composers, genres, and source
identifiers are retained in `library.json`.

One upstream metadata correction: "Do You Know the Way to San Jose" credits Burt
Bacharach and Hal David, checked against https://www.haldavid.com/catalog.htm.

The code in `scripts/import-squd-melodies.mjs` rebuilds the excerpts from the pinned
source. `abcjs` 6.7.2 (https://github.com/paulrosen/abcjs) is used only during import;
its license is included in the installed development package.
