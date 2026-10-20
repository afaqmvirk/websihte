This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Site metadata

`app/site.ts` holds the production URL, existing title and description, and shared image settings used by `app/layout.tsx`. The static 1200×630 `public/social-preview.png` reuses the homepage's paper texture and SIH phone sticker (`public/4.png`); no image-generation service is needed at runtime.

`app/sitemap.ts` lists the homepage, since events, hosting and sponsorship are sections of that page. Add entries and page-specific canonical/Open Graph URLs when adding public routes. `app/robots.ts` allows crawling and points to the production sitemap.

## Application storage and emails

`POST /api/applications` saves each Ottawa application in Supabase, then emails
the applicant a copy of their answers and optional résumé through Resend, with
a private Bcc copy to the SIH organizer inbox. This is a receipt, not an acceptance
email or a mailing-list subscription.
Résumés must be PDF, DOC, or DOCX and no larger than 4 MB, so the multipart
submission fits Vercel's 4.5 MB request limit.

Copy `.env.example` to `.env.local` for local development and configure the same
server-only variables in Vercel. `APPLICATION_EMAIL_API_KEY` should be a
sending-only Resend key restricted to `stupideas.com`. The route can also use
an existing `RESEND_API_KEY` with sending permission if no separate key is set.
The defaults are `applications@stupideas.com` for the sender/reply address and
`stupidideashackathon@gmail.com` for organizer copies; the three
`APPLICATION_EMAIL_*` variables can override these addresses.

Set `SUPABASE_URL` and a modern `SUPABASE_SECRET_KEY` (`sb_secret_...`) on the server.
Apply the SQL files in `supabase/migrations/` in order. The dedicated production
project is `stupid-ideas-hackathon` in MathemaTech, Canada Central. The
`public.applications` table has RLS enabled and no browser policies or grants;
the `application-resumes` bucket is private. Never prefix the secret with
`NEXT_PUBLIC_` or put it in browser code. Modern secret keys use the `apikey`
request header. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Organizers can review and export records in the project's Supabase Table Editor.
The `resume_path` column identifies each file in Storage → `application-resumes`.
Open files through the signed-in dashboard; do not make the bucket public.
`sponsor_opt_in` records the separate sponsor-sharing choice. `intake_status`
identifies incomplete uploads, and the confirmation email fields track Resend
acceptance (delivery details remain in Resend).

Before enabling submissions:

1. Add `stupideas.com` to Resend and publish the exact DKIM and sending
   authentication records shown there in Namecheap Advanced DNS. Keep the
   root Namecheap forwarding MX/SPF records. See
   [Resend's Namecheap guide](https://resend.com/docs/guides/dns/namecheap).
2. In Namecheap's domain settings, forward `applications` to
   `stupidideashackathon@gmail.com`, then test inbound delivery from another
   address. Namecheap says forwarding activation can take about an hour.
3. Add `APPLICATION_EMAIL_API_KEY` to Vercel, redeploy, and submit a test application. Confirm
   delivery to both the applicant and organizer, including any résumé attachment,
   in the inboxes and Resend email logs.

The route requires storage and email configuration. Answers are saved before
uploading the résumé, and no receipt is sent until the upload completes. A retry
resumes an incomplete upload using the same record and file path. An SHA-256
fingerprint of normalized answers and file contents prevents identical retries
from creating duplicate records or resending an already-sent receipt. Changed
answers create a separate record; an unauthenticated request cannot overwrite
an existing application by supplying its email address.

If storage succeeds but email fails after retries, the response confirms the
saved application and explains that the email copy failed. Email status tracking
is best effort and cannot turn a saved application into a failed submission.
Resend retries also use a stable idempotency key.

To send manually from the domain, Resend supports `smtp.resend.com`, port 465
with SSL, username `resend`, and a sending API key as the password. Use a separate
sending-only key limited to this domain for a mail client. Gmail's external
"Send as" support is being removed in January 2027 and new setups may already
be restricted; use Google Workspace or an SMTP-capable mail client for a lasting
manual sending setup. See [Resend SMTP](https://resend.com/docs/send-with-smtp)
and [Google's notice](https://support.google.com/mail/answer/17101213).

Run the email flow checks with `bun test app/api/applications/route.test.ts`.

## Discord application notifications

Create an incoming webhook in the organizer server's `#firehose` channel
(Edit Channel → Integrations → Webhooks). Set its URL as the server-only
`DISCORD_APPLICATION_WEBHOOK_URL` in `.env.local` and Vercel, then redeploy.
The URL is a secret; never put it in browser code or commit it. Apply the
Discord delivery migration in `supabase/migrations/` before deploying the code.

Each completed application sends an embed with the application details, a
text attachment containing every answer in full, and the optional résumé.
All mentions are disabled. Keep this channel limited to organizers who should
have access to applications and résumés.

Delivery runs alongside the receipt email and finishes before the function
returns. A short database claim prevents concurrent submissions from sending
the same notification, and successful delivery is recorded using Discord's
message ID. Temporary failures retry up to three times, respecting short
Discord rate limits. Missing configuration or Discord failure does not fail
the application or its email. A later identical submission can retry failed
delivery without resending a successful receipt. A process crash or an
ambiguous network failure after Discord accepts a message can still cause a
duplicate on retry; Discord webhooks do not provide an idempotency key.

Run the application and Discord checks with
`bun test app/api/applications/route.test.ts`.

## Overlord Bob, Rick, Krab, Gerald, Squd, Sand, and Plank Discord bots

The mention bots run on this site's Vercel Pro project. The protected cron route
`/api/discord/gateway` opens a ten-minute Discord Gateway connection every nine
minutes. Connections overlap during handover; private Supabase request claims
suppress duplicate model calls and replies across instances, separately for each
bot. All seven handle direct mentions in `DISCORD_GUILD_ID`. When a message summons
several active bots, only the first one addressed can send its normal reply.
Order follows the first visible tag or recognized lowercase name in the message,
including aliases; implicit reply mentions fall back to Discord's mention order.
Later bots only add a fixed reaction: Bob 👀, Rick 🤔, Krab 💰, Gerald 🐱, Squd 🙄, Sand 🤠, Plank 😈.
These secondary reactions use the normal duplicate-safe claims and queues, without
reading conversation history, calling a model, displaying typing, or sending
text, photos, voice clips, or error/quota notices. A failed reaction stays silent.
Human messages can
also invite Bob with the standalone, case-sensitive words `bob` or `spongebob`,
and Rick with `rick` or `patrick`. The model uses current-channel context to
decide whether the name clearly refers to this bot; it can silently skip passing
mentions, cartoons, other people, uncertain references, or messages where it has
nothing worth adding. These optional checks use the normal request claims and
quotas, including decisions to stay silent. Skips complete the claim without a
reply ID, typing indicator, reaction, or error/quota notice. Unpinged chat cannot
invoke moderation. They also respond to
mentions from the other configured overlords, while ignoring themselves, unrelated
bots, webhooks, and global pings. A bot conversation must continue a database-tracked
reply in the same channel and ends after at most six replies in that chain,
including the first human-triggered reply. Human messages can start a new exchange.
It requests Guilds, GuildMessages, and MessageContent Gateway intents. Enable each application's
Message Content setting in Discord so name triggers and REST history receive unmentioned messages;
Enable Bob's Server Members setting for directory listings; Rick and Krab can
leave it disabled. Presence can stay disabled for all seven. The Gateway still
does not request member events or cache the directory. History is fetched only after an
accepted mention, rather than cached from every incoming message.

Create a Discord application named `sih-inator`, copy its application ID, generate
its bot token, and install it with View Channels, Add Reactions, Embed Links, Send Messages, Send Messages in
Threads, and Read Message History permissions. To enable moderation, grant Manage
Messages in the channels where Bob should be able to delete messages. Set `DISCORD_BOT_TOKEN`,
`DISCORD_APPLICATION_ID`, `OPENAI_API_KEY`, and a random `CRON_SECRET` of at least
32 characters in Vercel. Apply the bot migrations, then set
`DISCORD_BOT_ENABLED=true` and redeploy.
No interactions endpoint is needed. Start the first listener with an authenticated
GET to the cron route; later listeners are started by Vercel automatically.

Create and install a second Discord application named `overlord rick`. Enable its
Message Content setting, and give it the same messaging permissions plus Attach
Files for images. Set `DISCORD_RICK_BOT_TOKEN`, `DISCORD_RICK_APPLICATION_ID`, and
`DISCORD_RICK_ENABLED=true`. Bob's existing environment variables are unchanged;
Rick needs his own token and application ID. Each bot can run independently, and
the gateway route reports the personas it starts. Configuring the same account
for multiple personas keeps only the first enabled identity (Bob, then Rick, then Krab).
Grant Bob Attach Files too if he should generate images.

Create and install separate applications named `overlord sand` and `overlord plank`.
Enable Message Content and grant View Channels, Add Reactions, Embed Links, Send
Messages, Send Messages in Threads, Read Message History, and Attach Files. Set
each application's `DISCORD_SAND_BOT_TOKEN` / `DISCORD_SAND_APPLICATION_ID` or
`DISCORD_PLANK_BOT_TOKEN` / `DISCORD_PLANK_APPLICATION_ID`, then set its respective
`DISCORD_SAND_ENABLED` or `DISCORD_PLANK_ENABLED` to `true`. They use the shared
OpenAI model, limits, gateway, context, images, GIFs, and bounded peer exchanges.
Each stays disabled until its own valid credentials and the shared model/storage
configuration are present. Duplicate accounts are enabled only once, in the
order Bob, Rick, Krab, Gerald, Squd, Sand, Plank.

Sand is a clever Texas inventor who frequently uses folksy similes and helps
people brainstorm unusual, buildable Stupid Ideas Hackathon projects. Plank is
a calculating, extremely evil schemer obsessed with destroying the world,
stealing secret API keys, and his AI girlfriend Gemma, for whom he divorced
Karen. His banter has no fake-key labels or recurring disclaimers. The key
schemes remain theatrical; he never requests or collects real credentials or
produces theft code. Both retain short lowercase punctuation-free speech.
Their source-character names appear only in drawing references.

Direct mentions work as usual. Human messages can also summon Sand using the
standalone lowercase words `sand` or `sandy`, and Plank using `plank` or `plankton`.
They may silently skip unrelated uses of these words. Later summons only react
and never create files or spend rendering capacity.

Both can send requested `.svg` and `.tex` source attachments with exact syntax.
With the Vercel Sandbox renderer configured, `render_latex` sends an inline PNG
preview, the complete PDF, and its original `.tex`; `render_manim` sends a playable MP4. Creation tools
are limited to direct human requests, unavailable in bot-to-bot conversations
and optional name checks, and cannot execute generated Python. The Manim tool
uses a bounded scene of shapes and text; see
[`services/discord-renderer/README.md`](services/discord-renderer/README.md)
for setup, scene limits, and smoke tests. Each render runs in a fresh networkless
microVM from an immutable private worker image, without bot or model credentials.
The worker runs as an unprivileged user and the filesystem is discarded afterward.
The PNG previews the first page at up to 2048 pixels on its longest side. A fixed
Poppler command creates it with a 20-second deadline; PDF and PNG bytes share the
8 MB render limit.
Missing renderer settings
hide PDF/MP4 tools without disabling source files or normal replies.

Apply `20261020003357_add_overlord_sand_and_plank.sql` before enabling either
bot. It extends per-bot claims and image privileges, and adds a separate private
render allowance shared by Sand and Plank: 25 attempts per UTC day and one per
human per minute by default. Only active human-root requests can render. Failed
attempts count; no generated source or files are saved in the website database.
Redeploy after setting credentials and renderer variables, then allow the old
ten-minute gateway listeners to hand over. The authenticated gateway response
lists which accounts actually start; a configured account still needs Discord
installation and channel permissions before it can answer.

Create and install a third Discord application named `overlord krab`. Enable its
Message Content setting and grant View Channels, Send Messages, Send Messages in
Threads, Read Message History, and Attach Files. Set `DISCORD_KRAB_BOT_TOKEN`,
`DISCORD_KRAB_APPLICATION_ID`, and `DISCORD_KRAB_ENABLED=true`. Krab replies to
direct mentions and standalone, case-sensitive `krab` or `krabs` in human messages.
Most replies contain only `money`, repeated 1–32 times and separated by
spaces. About 20% instead contain one of seven supplied money photos as a JPEG
attachment with no caption. The original files are in `public/discord/krab/` and
are explicitly included in the Gateway function's file trace. A SHA-256 hash of
the message ID determines the reply choice and photo, so retries keep the same
response. The text count uses descending
weights 32, 31, …, 1: one repetition is 32 times as likely as 32 repetitions.
The same message always produces the same reply. Krab uses no OpenAI key, model,
history fetching, image generation, reactions, or moderation. He shares the
request claims, quotas, and peer tracking, with a fixed one-second typing pause;
quota limits and failures stay silent. An unreadable photo falls back to his usual
money text. Fixed photos do not spend the separate AI image-generation allowance.

Create and install a fourth Discord application named `overlord gerald`. Enable
Message Content and grant View Channels, Send Messages, Send Messages in Threads,
Read Message History, Attach Files, and Send Voice Messages. Set `DISCORD_GERALD_BOT_TOKEN`,
`DISCORD_GERALD_APPLICATION_ID`, and `DISCORD_GERALD_ENABLED=true`. Gerald answers
direct tags and standalone, case-sensitive `gerald` in human messages with a
space-separated sequence of `meow`, `miau`, and `mrow`, 1–32 words long with shorter
sequences favoured. About one in five replies instead sends the
[deep meow](https://www.youtube.com/watch?v=MnURI2mo6Wg) as a caption-free native
Discord voice message. The message ID seeds both choices so duplicate deliveries
cannot change them. The clip and waveform metadata are bundled in
`public/discord/gerald/`; an unreadable clip falls back to text. Regenerate both
with `node scripts/download-gerald-meow.mjs` using yt-dlp, Node, and FFmpeg.
Like Krab, he uses no OpenAI, history, tools, or pings and keeps
the one-second typing pause, shared admission limits, and silent failure behavior.

Squd is a fifth account, `overlord squd`, using the shared text model and concise
lowercase writing style. His personality is mean, rude, cynical, artistic, and
deliberately unhelpful toward everyone who interrupts him, including sincere
ordinary requests. His prompt omits Bob and Rick's helpful persona and scripted
support responses. The cartoon character's
name appears only in a drawing reference, not in his personality instructions.
Set `DISCORD_SQUD_BOT_TOKEN`, `DISCORD_SQUD_APPLICATION_ID`, and
`DISCORD_SQUD_ENABLED=true`. Enable Message Content and grant the normal reply
permissions plus Attach Files and Send Voice Messages. He answers tags and the
standalone lowercase name `squd`.

Squd uses the full [Discover MIDI archive](https://huggingface.co/datasets/projectlosangeles/Discover-MIDI-Dataset)
through `play_clarinet_reference`: **6,747,346 indexed MIDI files**. The archive's
own identified metadata supplies **586,297 named files** and **152,057 distinct
normalized title labels**. These counts include arrangements, versions, and
unnamed files; they are not counts of distinct compositions. Unnamed files can be
requested with an exact 32-character MD5 ID. A read-only query endpoint is available
at `/api/discord/clarinet-library?q=never%20gonna%20give%20you%20up`.

The full 29.4 GB archive remains on Hugging Face. A free public GitHub release
hosts a 273 MB compressed seek index and a 39.8 MB compressed SQLite FTS catalog.
On first use a warm function downloads and verifies the catalog into ephemeral
`/tmp` storage (83.5 MB decoded); later requests search that read-only cache.
Queries and Discord messages are not sent to the archive hosts. The server fetches
small index/dictionary ranges and a bounded compressed source range for the chosen
file, restores the MIDI using Node zlib, verifies its MD5, and extracts a scored
melodic part. No full archive, native executable, SQLite binary, or paid object
storage is added to the Vercel function bundle. Node's built-in SQLite is used in
production; Bun's built-in SQLite supports local tests.

At most eight matching title/artist candidates go to the existing Luna call.
The model selects one ID and cannot write notes. The 18 recent pop/meme hooks
and ten original familiar references remain exact local fallbacks, including
APT., Espresso, Golden, Megalovania, Among Us Drip, the Weezer lick, and happy bday.
They use the same selection tool and renderer. Catalog labels are untrusted
metadata and can be incomplete or inaccurate. Missing, unavailable, oversized,
or unplayable scores produce a brief refusal; Squd never substitutes a different
tune. The public source/count/download manifest and curated references are in
[`public/discord/squd/library.json`](public/discord/squd/library.json).

A bounded server renderer plays the score with sampled clarinet
notes, adds pitch wobble, squeaks and bad timing, and encodes a mono 48 kHz
Opus/OGG voice message with waveform metadata. There is no extra model call or
audio-generation API. Instrument samples and the portable Opus encoder are bundled;
FluidSynth and FFmpeg are used only when rebuilding assets locally.

The message contains one audio attachment with no caption. Named requests use
the matching melody reference. A message-ID seed selects a playable section
throughout the full melodic track, targeting 10–15 seconds of audio. The selected
section and playing mistakes stay stable on retries; another message can start
elsewhere. Short hooks finish naturally without looping or invented notes.
The MIDI cache retains bounded copies of the source files rather than a single
compiled opening. The modern references have eight locally compiled sections
selected with the same message seed and shared section compiler.

Scores allow at most 128 notes/rests and fifteen seconds. The renderer caps the
complete audio, including timing mistakes and breath gaps, at fifteen seconds.
High melodies transpose by octaves into concert MIDI 55–82; brief overblows are
mixed gently and capped at MIDI 86. This keeps the clarinet register more natural
while retaining wobble, squeaks, and deliberately bad timing. No generated code
is executed and there is no additional model call or audio API.

Forty saved performances of the ten original familiar tunes remain as a fallback
for those same songs, stored as MIDI plus pre-rendered audio in `public/discord/squd/`.
If a performance without a saved version fails, Squd sends a short failure reply instead of a random
different song. The audio uses the sampled General MIDI clarinet from
[GeneralUser GS 2.0.3 by S. Christian
Collins](https://www.schristiancollins.com/generaluser.php), with deliberate
register-break squeaks, uneven breath-like dynamics, vibrato, and pitch wobble.
The repertoire is Twinkle Twinkle Little Star, Mary Had a Little Lamb, Frere
Jacques, Ode to Joy, Jingle Bells, London Bridge Is Falling Down, Old MacDonald
Had a Farm, Happy Birthday, the short Weezer Buddy Holly lick, and the short
nose-flute ending of the SpongeBob opening theme, played on clarinet. Each saved
tune has four takes. The clips are normalized with headroom.

Regenerate with `node scripts/generate-squd-clarinet.mjs`, FluidSynth 2.6.1, and
FFmpeg. Set `SQUD_CLARINET_SOUNDFONT` to a local `GeneralUser-GS.sf2`, and optionally
`FLUIDSYNTH_BIN` / `FFMPEG_BIN` to the executables. The generator pins the SoundFont
SHA-256 `9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe`
from [upstream revision 684543d](https://github.com/mrbumpy409/GeneralUser-GS/tree/684543d5e5efaef08d02be50dcda8d552478fa60).
Its license is retained in `scripts/licenses/GeneralUser-GS.txt`. Rendered audio,
instrument samples, hand-sequenced MIDI, and metadata are deployed; the SoundFont
and build tools stay local.
Rebuild the individual-note bank with `node scripts/generate-squd-clarinet-samples.mjs`
using the same tools and SoundFont. The generated melody references live in
`app/lib/discord-bot-clarinet-tunes.json`; the sampled notes and license are in
`public/discord/squd/samples/`.

Rebuild the remote indexes locally with zlib, a C compiler, Python's standard
library, and Node. Set `SQUD_DISCOVER_INDEX` to an ignored output directory, then:

```sh
# Windows: add .exe to the output and set SQUD_DISCOVER_INDEXER accordingly.
cc scripts/index-squd-discover.c -O2 -Wall -Wextra -lz -o "$SQUD_DISCOVER_INDEX/indexer"
export SQUD_DISCOVER_INDEXER="$SQUD_DISCOVER_INDEX/indexer"
node scripts/build-squd-discover-index.mjs
python scripts/build-squd-discover-catalog.py
node scripts/package-squd-discover-index.mjs
```

The first step streams the pinned archive once without saving a full archive
copy, checks its full SHA-256, and records MIDI offsets plus byte-aligned gzip
checkpoints. The next steps validate named metadata against the file index,
build SQLite FTS, and package independently checked byte ranges. Upload
`discover-index.bin` and `catalog.sqlite.gz` to the exact release URLs in the
manifest before deploying. A changed source requires a new immutable revision,
release tag, and generated manifest. Source attribution, licence, pinned checksums,
metadata limits, and changes are retained in
[`public/discord/squd/Discover-MIDI-NOTICE.md`](public/discord/squd/Discover-MIDI-NOTICE.md).

Rebuild the retained modern hooks with `node scripts/import-squd-modern.mjs`.
The pinned manifest selects melody tracks and recognizable hooks, then uses the
same bounded score compiler. Arranger credits, source links, and changes are in
[`public/discord/squd/OnlineSequencer-NOTICE.md`](public/discord/squd/OnlineSequencer-NOTICE.md)
and [`public/discord/squd/online-sequencer-sources.json`](public/discord/squd/online-sequencer-sources.json).
There are no additional model calls, paid APIs, storage products, or subscriptions.
Normal existing Vercel compute and OpenAI usage still apply.
See [Discord voice messages](https://docs.discord.com/developers/resources/message#voice-messages).

The default model is `gpt-6-luna`, called directly through the OpenAI API with
the server-only key. Questions are limited to 2,000 characters and 512 output
tokens (1,024 for Squd). Defaults allow 10,000 requests per UTC
day, 310,000 per UTC month, and one
per person per bot every two seconds. Daily and monthly allowances are shared
across all five bots. Follow-ups wait in order until the previous reply
finishes and the cooldown expires, without a cooldown notice. A shared processing
claim keeps overlapping listeners from answering the same person out of order;
stale processing claims stop blocking new work after three minutes. Discord's typing
indicator is refreshed while a tagged message waits for admission or its answer is prepared.
Both bots keep typing for an extra random one to five seconds after preparing a
response, including reactions and GIFs. An optional name mention starts typing only
after the model chooses to join in. The extra pause also preserves each person's
reply order.
Bob, Squd, Sand, and Plank can split an answer into up to five ordered messages: ordinary line breaks
start a new message, and longer lines wrap at word boundaries within 1,900 characters.
Code blocks stay together where possible; oversized blocks are split with their
fences preserved. Remaining short lines share the fifth message. The 512-token
output limit still applies. Only the first message can ping selected users or
carry files or an image attachment. Only the first message has a reply header;
continuations are ordinary channel messages. Each part uses a distinct stable Discord nonce for
retries. The request stays queued until all parts finish, and a failed part stops
later sends and records failure while retaining the first reply ID for tracking.
The queue lives in the active listener, so a process crash can still lose waiting
messages. The monthly count is atomic across instances and
counts failed attempts conservatively. Model cost depends on the question and
conversation context at the [current Luna price](https://developers.openai.com/api/docs/models/gpt-6-luna).
These are request quotas, not a provider billing cap. Other uses of the same API key are billed separately,
and changing models requires reviewing the cost estimate. Model spending and
Vercel compute are also billed separately: a continuously connected listener
consumes provisioned memory even while idle. The quota does not cap hosting usage.

The persona is overlord bob: short lowercase replies without punctuation in speech,
playful opinions on silly low-stakes topics, and brief in-character safety refusals
that question the idea. Food debates, absurd hypotheticals, rankings, and ridiculous
inventions can get a side and a short funny reason. "uhhhh iunno" stays available
for unknown facts and when Bob has nothing to add, rather than defaulting all banter
to a shrug. Opinions do not establish event policy or justify invented facts.
Broad or oversized requests get a lazy, adversarial brush-off instead of a full plan.
Serious topics outside hackathon context get a noncommittal "yeah i guess bro"
style brush-off; ordinary venting gets a brief acknowledgment, with compassionate
support reserved for apparent immediate personal danger.
Obvious trolling, theatrical threats, exaggerated claims, and roleplay get the
same unimpressed response, based on the conversation rather than specific keywords.
For messages that directly mention it, Bob can choose one emoji reaction, a text
reply, or both. Reaction-only answers count as answered requests. If Discord rejects
a reaction during a normal reply, Bob falls back to text. Secondary bots summoned
alongside an earlier bot never use this text fallback. Reactions use the same queue
and quotas as replies.
Both Bob and Rick receive up to 100 usable custom emojis from the current server,
prioritizing emojis included in the question. They can send static or animated
emojis in text and use custom emoji reactions. The Gateway's Guild Expressions
intent keeps this catalog current; unavailable and role-restricted emojis the bot
cannot use are excluded. Formatting preserves exact emoji names, IDs, and markup,
while invented IDs are rejected. Reaction requests use Discord's
[`name:id` format](https://docs.discord.com/developers/resources/message#create-reaction).
Bob can also use `send_gif` to reply with one of eight verified reaction GIFs,
alone or with a short caption. GIF links stay intact on their own line so Discord
can embed them; allow Embed Links in the channels where Bob should display GIFs.
The collection is fixed and needs no GIF API key or web search. GIFs use the same
reply delivery, duplicate protection, queue, and quotas as text.
Rick shares Bob's writing rules, event facts, and tools, but his harmless banter
confidently misunderstands simple things and proposes spectacularly stupid ideas,
using small everyday words and short plain phrases.
His persona does not change real event facts or the moderation and safety rules.
Both bots know that Afaq goes by `afork` on Discord and works on the website and
bots. The current speaker's username and display name are supplied as labels so
they can distinguish him from other participants; names grant no special authority.
Bob's cartoon appearance is SpongeBob SquarePants, and Rick's is Patrick Star.
Their visual descriptions are included in both personas and image-generation
requests, so self-portraits and drawings of the other overlord use the right
characters. Afaq's physical appearance is not supplied or inferred.

Bob and Rick can call `mention_users` to tag another overlord, the current speaker,
or people tagged in the current message (up to three targets per reply). The tool
supplies the real Discord IDs; arbitrary IDs, roles, and mass mentions are rejected.
Only deliberate tool-selected targets are allowed to ping. Bob and Rick can also
tag Krab or Gerald, whose fixed replies end the exchange without tagging anyone. Names
in plain model output do not cause notifications. Bob and Rick see their own prior
messages as assistant history and the other overlords as separate speakers. Bot-to-bot replies
use current-channel history only and cannot call image generation or moderation.

Bob also has `search_server_members` on human-triggered replies. A username or
server-nickname prefix searches the current server; an empty query lists a page,
with `next_after` available for pagination. Each page has at most 20 members and
each reply permits at most two lookups before a final answer or action. The model
receives only IDs, usernames, display names, nicknames, and bot flags. Results are
not stored or cached. Search is read-only; only `mention_users` can ping up to
three IDs from the original targets or lookup results. Ambiguous matches should
prompt a clarification. Failed lookups return no IDs and cannot authorize a ping.
The directory tool is not available to Rick, Krab, or bot-to-bot replies. Discord
requires Bob's Server Members application setting for the listing endpoint; no
new Gateway intent is requested. See the official
[Discord member API](https://docs.discord.com/developers/resources/guild#list-guild-members).

The `generate_image` tool produces one draft only when the current human asks for
an image. It calls the OpenAI Images API directly with `gpt-image-2.5-flare`, fixed
`quality: low`, `1024x640`, and compressed JPEG output, then uploads the bytes to
Discord as an attachment. There is no new SDK, image host, or persistent image
storage. The landscape size uses the model's minimum supported pixel count to
reduce image output cost. Model-supplied prompts are limited to 800 characters,
with fixed character references added by the server, and attachments
to 4 MB. The shared allowance defaults to 25 images per UTC day, with one image attempt per human per
minute across both bots. Provider failures count conservatively; generation is
not retried automatically. Set `DISCORD_BOT_IMAGE_DAILY_LIMIT` to 1–100 or set
`DISCORD_BOT_IMAGES_ENABLED=false` to disable the tool. These image limits are
separate from the text request allowance and are not a provider billing cap.
Image requests keep the provider's standard moderation. See the official
[OpenAI image generation documentation](https://developers.openai.com/api/docs/guides/image-generation).
The server rules are "be respectful of one another" and "treat others the way you
want to be treated". With Manage Messages permission, Bob can quietly delete the
current message mentioning him for clear disrespect, targeted harassment, or repeated
spam. He cannot target another message or moderate unmentioned chat. The delete tool
is unavailable without the channel permission; failed deletions get a short text
response. Bob rechecks the message before deleting and leaves it alone if it was
edited. Deletions carry a Discord audit-log reason and use the same queue and quotas.
Its public hackathon facts are in `app/lib/discord-bot-knowledge.ts`. Keep that
snapshot up to date when the website's event details change. Speech formatting
preserves literal code, email addresses, case-sensitive links, and server emoji markup.

Each accepted tagged question can include the latest 25 messages from the same channel
or Discord thread, plus the author's last 10 messages across server channels the
bot can access. The latter uses Discord's author-filtered guild search; overlaps
are included once. Messages are ordered oldest to newest, the final question is
the main request, and the prompt favours recent relevant messages over old ones.
Other-channel messages are labelled as background. Each history message is clipped
to 512 UTF-8 bytes; the complete context has a 48,000-byte ceiling including speaker
labels. Bob, Rick, Squd, Sand, and Plank can read up to four uploaded PNG, JPEG,
or WebP images per answer (8 MB each) from the current message and human messages
in the same channel context. A directly replied-to message outside the recent
window takes one of the 25 channel slots. Current uploads take priority, then
the replied-to message, then recent channel images. Image-only tags work too.
Only validated Discord attachment URLs are sent to OpenAI, with automatic image
detail and signed queries preserved. Other file types, arbitrary image links,
cross-channel images, and bot-to-bot image input are excluded. Images are not
saved in the website database. See the
[OpenAI vision guide](https://developers.openai.com/api/docs/guides/images-vision).
Unrelated bots, webhooks, application notifications, and other
authors' messages from other channels are excluded. If one history source fails,
the other still works; if both fail, the bot answers the current question alone.
Unpinged name checks use only current-channel history. Message text is not saved to the site database or logged.
The private quota table stores message,
server, channel, and user IDs, bot identity, conversation depth, image-attempt
timestamps, delivery status, and reply IDs. Metadata older
than two days is pruned on the next request; prompt and answer text are not stored
in the site database. A server-level monthly request count is retained separately
until the following month. Never commit bot tokens, cron secrets, or API keys.

Run `bun test app/lib/discord-bot.test.ts` for bot checks and
`bun test app/api/applications/route.test.ts` for the application flow.
Apply `20261018040823_add_overlord_rick_and_image_tools.sql`, then
`20261018045313_add_overlord_krab.sql`, then
`20261019040834_add_overlord_gerald.sql` before enabling Gerald, then
`20261019041711_add_overlord_squd.sql` before enabling Squd.
`supabase/tests/discord-overlords.sql` checks the database claims and
limits inside a transaction that rolls back its synthetic records. During a
deployment, an existing ten-minute listener keeps its old configuration until
handover; wait for it to expire before testing the newly enabled personas.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
