import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CONSENT_VERSION, parseConsent } from "./participant-documents";
import { guardianFileType } from "./guardian-upload";
import { POST as upload } from "../api/portal/guardian/upload/route";
import { GET as download } from "../api/portal/guardian/file/route";
import { hasParticipantConsent } from "./portal";
import ParticipationConsent from "../portal/participation-consent";

test("age and required agreements need explicit answers; optional media is independent", () => {
  const valid = { isAdult: false, signature: "Test Person", codeAccepted: true, waiverAccepted: true, mediaConsent: false };
  expect(parseConsent(valid)).toEqual(valid);
  for (const invalid of [{ ...valid, isAdult: "no" }, { ...valid, isAdult: null }, { ...valid, codeAccepted: false }, { ...valid, waiverAccepted: "true" }, { ...valid, signature: " " }, { ...valid, mediaConsent: undefined }]) expect(parseConsent(invalid)).toBeNull();
});
test("file types come from bytes, not an attacker-controlled filename or MIME", () => {
  expect(guardianFileType(Buffer.from("<html>fake.pdf</html>"))).toBeNull();
  expect(guardianFileType(Buffer.from("%PDF-1.7\n"))?.mime).toBe("application/pdf");
  expect(guardianFileType(Buffer.from([137,80,78,71,13,10,26,10]))?.mime).toBe("image/png");
  expect(guardianFileType(Buffer.from([255,216,255,0]))?.mime).toBe("image/jpeg");
});
test("saved minor portal offers download/upload and shows review feedback without parent email controls", () => {
  const rsvp = { is_local: true, travel_plan: null, updated_at: new Date().toISOString(), cancelled_at: null, is_adult: false, consent_version: CONSENT_VERSION, signature_name: "Fixture Minor", code_accepted_at: "2026-10-24T12:00:00Z", liability_accepted_at: "2026-10-24T12:00:00Z", media_consent: false, guardian_upload_status: "rejected" as const, guardian_review_note: "Please add a signature." };
  expect(hasParticipantConsent(rsvp)).toBeTruthy();
  const html = renderToStaticMarkup(createElement(ParticipationConsent, { rsvp, onSaved: () => {} }));
  expect(html).toContain("download parent / guardian form");
  expect(html).toContain("upload signed form");
  expect(html).toContain("replacement needed");
  expect(html).toContain("Please add a signature.");
  expect(html).not.toContain("resend parent-form email");
});
test("parent upload and private download deny unverified visitors; foreign upload origins fail first", async () => {
  const response = await upload(new Request("https://my.stupideas.com/api/portal/guardian/upload", { method: "POST", headers: { Origin: "https://attacker.invalid" } }));
  expect(response.status).toBe(403);
  const saved = process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SECRET_KEY;
  try {
    expect((await upload(new Request("https://my.stupideas.com/api/portal/guardian/upload", { method: "POST", headers: { Origin: "https://my.stupideas.com" } }))).status).toBe(401);
    expect((await download()).status).toBe(401);
  } finally { if (saved !== undefined) process.env.SUPABASE_SECRET_KEY = saved; }
});
