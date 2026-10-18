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

## sih-inator Discord bot

The mention bot runs on this site's Vercel Pro project. The protected cron route
`/api/discord/gateway` opens a ten-minute Discord Gateway connection every nine
minutes. Connections overlap during handover; private Supabase request claims
suppress duplicate model calls and replies across instances. The bot responds
only to direct user mentions in `DISCORD_GUILD_ID`, ignoring bots and global pings.
It requests only Guilds and GuildMessages Gateway intents. Enable the application's
Message Content setting in Discord so REST history includes unmentioned messages;
Server Members and Presence can stay disabled. History is fetched only after an
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

The default model is `gpt-6-luna`, called directly through the OpenAI API with
the server-only key. Questions are limited to 2,000 characters and 512 output
tokens. Defaults allow 10,000 requests per UTC day, 310,000 per UTC month, and one
per person every two seconds. Follow-ups wait in order until the previous reply
finishes and the cooldown expires, without a cooldown notice. A shared processing
claim keeps overlapping listeners from answering the same person out of order;
stale processing claims stop blocking new work after two minutes. Discord's typing
indicator is refreshed while a message waits for admission or its answer is prepared.
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
a reaction, Bob falls back to text. Reactions use the same queue and quotas as replies.
Bob can also use `send_gif` to reply with one of eight verified reaction GIFs,
alone or with a short caption. GIF links stay intact on their own line so Discord
can embed them; allow Embed Links in the channels where Bob should display GIFs.
The collection is fixed and needs no GIF API key or web search. GIFs use the same
reply delivery, duplicate protection, queue, and quotas as text.
The server rules are "be respectful of one another" and "treat others the way you
want to be treated". With Manage Messages permission, Bob can quietly delete the
current message mentioning him for clear disrespect, targeted harassment, or repeated
spam. He cannot target another message or moderate unmentioned chat. The delete tool
is unavailable without the channel permission; failed deletions get a short text
response. Bob rechecks the message before deleting and leaves it alone if it was
edited. Deletions carry a Discord audit-log reason and use the same queue and quotas.
Its public hackathon facts are in `app/lib/discord-bot-knowledge.ts`. Keep that
snapshot up to date when the website's event details change. Speech formatting
preserves literal code, email addresses, and case-sensitive links.

Each accepted question can include the latest 25 messages from the same channel
or Discord thread, plus the author's last 10 messages across server channels the
bot can access. The latter uses Discord's author-filtered guild search; overlaps
are included once. Messages are ordered oldest to newest, the final question is
the main request, and the prompt favours recent relevant messages over old ones.
Other-channel messages are labelled as background. Each history message is clipped
to 512 UTF-8 bytes; the complete context has a 48,000-byte ceiling including speaker
labels. Other bots, webhooks, application notifications, attachments, and other
authors' messages from other channels are excluded. If one history source fails,
the other still works; if both fail, the bot answers the current question alone.
Message text is not saved to the site database or logged.
The private quota table stores message,
server, and user IDs, timestamps, delivery status, and reply IDs. Metadata older
than two days is pruned on the next request; prompt and answer text are not stored
in the site database. A server-level monthly request count is retained separately
until the following month. Never commit bot tokens, cron secrets, or API keys.

Run `bun test app/lib/discord-bot.test.ts` for bot checks and
`bun test app/api/applications/route.test.ts` for the application flow.

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
