import { expect, test } from "bun:test";
import type { PortalRsvp } from "@/lib/portal";
import { uploadAfterConsent } from "./guardian-file-input";

const rsvp: PortalRsvp = { is_local: true, travel_plan: null, updated_at: "2026-10-25T12:00:00Z", cancelled_at: null, is_adult: false };
const saved = { rsvp, message: "RSVP saved.", emailSent: true };
const file = new File(["%PDF-fixture"], "signed-parent.pdf", { type: "application/pdf" });

test("a chosen parent form uploads only after an under-18 RSVP was saved", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++; expect(String(input)).toBe("/api/portal/guardian/upload");
    expect(init?.method).toBe("POST");
    const uploaded = (init?.body as FormData).get("file") as File;
    expect(uploaded.name).toBe(file.name);
    expect(await uploaded.text()).toBe(await file.text());
    return Response.json({ rsvp: { ...rsvp, guardian_upload_status: "pending" }, message: "Signed form uploaded. An organizer will review it before check-in." });
  };
  try {
    expect((await uploadAfterConsent(saved, null)).rsvp).toBe(rsvp);
    await uploadAfterConsent({ ...saved, rsvp: { ...rsvp, is_adult: true } }, file);
    expect(calls).toBe(0);
    const result = await uploadAfterConsent(saved, file);
    expect(calls).toBe(1);
    expect(result.rsvp.guardian_upload_status).toBe("pending");
    expect(result.message).toContain("An organizer will review");
  } finally { globalThis.fetch = original; }
});

test("upload failure keeps the saved RSVP and offers a file retry instead of repeating RSVP", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ message: "We couldn't upload your form." }, { status: 502 });
  try {
    const result = await uploadAfterConsent(saved, file);
    expect(result.rsvp).toBe(rsvp);
    expect(result.message).toContain("RSVP and required agreements saved.");
    expect(result.message).toContain("upload box below to try again");
  } finally { globalThis.fetch = original; }
});
