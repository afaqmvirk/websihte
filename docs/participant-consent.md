# Ottawa participation forms

The RSVP asks **Are you 18 or older?**, explicitly answered for November 15, 2026.
Everyone accepts the English SIH Code of Conduct and liability waiver and types
their full legal name. Media permission is separate, optional, and off by default.
The organizer identified in the forms is **Stupid Ideas Hackathon Community**.
The adapted legal wording should receive Ontario legal review before reliance.

Under-18 attendees download `/forms/sih-ottawa-2026-parent-guardian-consent.pdf`,
have a parent or legal guardian sign it, and upload the signed PDF/JPG/PNG in the
portal (4 MB maximum). There is no guardian-link email or email-verification flow.
The five-page downloadable pack includes the signature page and all referenced
terms. Its nine fields are fillable; printing and signing is also supported.

Uploads stay in the private `participant-consents` bucket. Authenticated server
routes check the accepted attendee's identity or current approved-organizer
session on every read. File types are checked from bytes, paths are random, and
the exact file hash, document version, upload time, and organizer decision are
retained. The applicant profile in the separate `sih-organizer` app lets an
organizer view the current file and explicitly approve it or request a replacement.
Feedback is visible to the attendee. A decision cannot replace another completed
decision; a fresh upload requires a fresh review and retains prior records.

Neither uploading nor approving a form checks someone in. The scanner still
requires its separate Check in action, which checks the required agreements and
parent approval inside the database transaction. Missing forms reveal the person
with `consent_required`. Existing RSVPs are not backfilled as having agreed.
Required forms and uploads can be completed after the RSVP deadline on an active
RSVP. This cannot change travel, create/reactivate an RSVP, or prevent cancellation.

Document version `ottawa-2026-2026-10-24` is archived in
`participant_document_versions` with its SHA-256 digest, parent declarations, and
downloadable PDF digest. Material revisions need a fresh version and acceptance;
do not silently replace the archived terms. Participant acceptance history and
signed uploads are private. Minor media permission takes effect only if both the
attendee and parent opt in.

To rebuild the blank parent pack, run `bun scripts/build-parent-form.ts <python>`
with ReportLab installed. Render and inspect every page, inspect both AcroForm
fields and page widgets, and update the archived digest/version as appropriate.
Never commit filled forms, real applicant information, or private signed files.

Validation: `supabase/tests/participant-consent.sql` uses synthetic records and
rolls back every write. It checks adult/minor/legacy cases, required agreements,
late completion, ownership, pending/rejected/approved uploads, stale decisions,
name changes, cancellation, check-in, private permissions, and document hashes.
