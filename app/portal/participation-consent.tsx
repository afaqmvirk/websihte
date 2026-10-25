"use client";
import { useState, type FormEvent } from "react";
import { hasParticipantConsent, type PortalRsvp } from "@/lib/portal";
import { PARENT_FORM_DOWNLOAD } from "@/lib/participant-documents";
import ConsentFields, { consentPayload, emptyConsent } from "./consent-fields";
import styles from "./portal.module.css";
import GuardianFileInput, { uploadAfterConsent, uploadGuardianFile } from "./guardian-file-input";

export default function ParticipationConsent({ rsvp, onSaved }: { rsvp: PortalRsvp; onSaved: (rsvp: PortalRsvp, message: string) => void }) {
  const complete = hasParticipantConsent(rsvp);
  const parentFormNeeded = rsvp.is_adult === false && !rsvp.guardian_completed_at
    && (rsvp.guardian_upload_status === "rejected" || (!rsvp.guardian_uploaded_at
      && rsvp.guardian_upload_status !== "pending" && rsvp.guardian_upload_status !== "approved"));
  const [value, setValue] = useState({ ...emptyConsent, isAdult: typeof rsvp.is_adult === "boolean" ? rsvp.is_adult ? "yes" as const : "no" as const : "" as const });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/portal/rsvp/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consentPayload(value)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "We couldn't save these forms.");
      const saved = await uploadAfterConsent(result, file);
      onSaved(saved.rsvp, saved.message); setFile(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function uploadParentForm() {
    setBusy(true); setMessage("");
    try {
      if (!file) throw new Error("Choose a signed PDF, JPG or PNG up to 4 MB.");
      const result = await uploadGuardianFile(file);
      onSaved(result.rsvp, result.message); setFile(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (complete && !parentFormNeeded) return null;
  return <section className={styles.consentStatus} aria-label={complete ? "parent / guardian form" : "required participation forms"}>
    <h3>{complete ? "parent / guardian form" : "complete required forms"}</h3>
    {!complete ? <>
      <p className={styles.rsvpDeadline}>Complete these required forms before check-in. You can complete them even after the RSVP deadline.</p>
      <form onSubmit={submit} className={styles.rsvpForm}>
        <ConsentFields value={value} onChange={setValue} disabled={busy} prefix="saved-consent">
          <GuardianFileInput id="saved-consent-guardian-file" file={file} onChange={setFile} disabled={busy} />
        </ConsentFields>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "saving…" : "save participation forms"}</button>
      </form>
    </> : <div className={styles.guardianUpload}>
        {rsvp.guardian_upload_status === "rejected" && <p>Parent / guardian form: replacement needed.</p>}
        <p>Download the form, have your parent or legal guardian read and sign it, then upload the signed PDF or a clear photo of the completed signature page. An organizer must approve it before check-in. You can upload even after the RSVP deadline.</p>
        <a className={`${styles.secondaryButton} ${styles.downloadLink}`} href={PARENT_FORM_DOWNLOAD} download>download parent / guardian form</a>
        {rsvp.guardian_uploaded_at && <p><a className={styles.downloadLink} href="/api/portal/guardian/file">download your uploaded copy</a> · {rsvp.guardian_filename}</p>}
        {rsvp.guardian_review_note && <p className={styles.error}>Organizer feedback: {rsvp.guardian_review_note}</p>}
        <GuardianFileInput id="guardian-file" file={file} onChange={setFile} disabled={busy} />
        {rsvp.guardian_uploaded_at && <p className={styles.rsvpPolicy}>A replacement needs a fresh organizer review.</p>}
        <div className={styles.rsvpActions}>
          <button type="button" className={styles.primaryButton} disabled={busy || !file} onClick={() => void uploadParentForm()}>{busy ? "please wait…" : "upload signed form"}</button>
        </div>
      </div>}
    {message && <p className={styles.rsvpDeadline} role="status">{message}</p>}
  </section>;
}
