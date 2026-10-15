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
