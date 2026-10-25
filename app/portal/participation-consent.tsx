"use client";
import { useState, type FormEvent } from "react";
import { hasParticipantConsent, type PortalRsvp } from "@/lib/portal";
import { PARENT_FORM_DOWNLOAD } from "@/lib/participant-documents";
import ConsentFields, { consentPayload, emptyConsent } from "./consent-fields";
import styles from "./portal.module.css";
import GuardianFileInput, { uploadAfterConsent, uploadGuardianFile } from "./guardian-file-input";

export default function ParticipationConsent({ rsvp, onSaved }: { rsvp: PortalRsvp; onSaved: (rsvp: PortalRsvp, message: string) => void }) {
  const complete = hasParticipantConsent(rsvp);
  const [editing, setEditing] = useState(false);
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
      onSaved(saved.rsvp, saved.message); setFile(null); setEditing(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function parentRequest(upload: boolean) {
    setBusy(true); setMessage("");
    try {
      let result;
      if (upload) {
        if (!file) throw new Error("Choose a signed PDF, JPG or PNG up to 4 MB.");
        result = await uploadGuardianFile(file);
      } else {
        const response = await fetch("/api/portal/rsvp", { cache: "no-store" });
        result = await response.json();
        if (!response.ok) throw new Error(result.message || "Please try again.");
      }
      if (result.rsvp) onSaved(result.rsvp, result.message || (result.rsvp.guardian_completed_at ? "Parent/guardian form approved." : "Parent/guardian form status refreshed."));
      if (upload) setFile(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <section className={styles.consentStatus} aria-label="participation forms">
    <h3>participation forms</h3>
    {!complete || editing ? <>
      {!complete && <p className={styles.rsvpDeadline}>Complete these required forms before check-in. You can complete them even after the RSVP deadline.</p>}
      <form onSubmit={submit} className={styles.rsvpForm}>
        <ConsentFields value={value} onChange={setValue} disabled={busy} prefix="saved-consent">
          <GuardianFileInput id="saved-consent-guardian-file" file={file} onChange={setFile} disabled={busy} />
        </ConsentFields>
        <button className={styles.primaryButton} disabled={busy}>{busy ? "saving…" : "save participation forms"}</button>
        {complete && <button className={styles.textButton} type="button" disabled={busy} onClick={() => setEditing(false)}>cancel</button>}
      </form>
    </> : <>
      <p className={styles.rsvpDeadline}>Code of Conduct and liability waiver accepted.</p>
      <dl className={styles.savedAnswers}>
        <div><dt>18 or older on November 15</dt><dd>{rsvp.is_adult ? "yes" : "no"}</dd></div>
        {rsvp.is_adult === false && <div><dt>parent / guardian consent</dt><dd>{rsvp.guardian_upload_status === "approved" ? "approved" : rsvp.guardian_upload_status === "pending" ? "uploaded — awaiting organizer review" : rsvp.guardian_upload_status === "rejected" ? "replacement needed" : "signed form required before check-in"}</dd></div>}
        <div><dt>photo/video permission</dt><dd>{!rsvp.media_consent ? "declined" : rsvp.is_adult ? "opted in" : !rsvp.guardian_completed_at ? "awaiting parent permission" : rsvp.guardian_media_consent ? "opted in" : "declined by parent / guardian"}</dd></div>
      </dl>
      {rsvp.is_adult === false && <div className={styles.guardianUpload}>
        <p>Download the form, have your parent or legal guardian read and sign it, then upload the signed PDF or a clear photo of the completed signature page. An organizer must approve it before check-in. You can upload even after the RSVP deadline.</p>
        <a className={`${styles.secondaryButton} ${styles.downloadLink}`} href={PARENT_FORM_DOWNLOAD} download>download parent / guardian form</a>
        {rsvp.guardian_uploaded_at && <p><a className={styles.downloadLink} href="/api/portal/guardian/file">download your uploaded copy</a> · {rsvp.guardian_filename}</p>}
        {rsvp.guardian_review_note && <p className={styles.error}>Organizer feedback: {rsvp.guardian_review_note}</p>}
        <GuardianFileInput id="guardian-file" file={file} onChange={setFile} disabled={busy} />
        {rsvp.guardian_uploaded_at && <p className={styles.rsvpPolicy}>A replacement needs a fresh organizer review.</p>}
        <div className={styles.rsvpActions}>
          <button type="button" className={styles.primaryButton} disabled={busy || !file} onClick={() => void parentRequest(true)}>{busy ? "please wait…" : "upload signed form"}</button>
          <button type="button" className={styles.textButton} disabled={busy} onClick={() => void parentRequest(false)}>refresh review status</button>
        </div>
      </div>}
      <button type="button" className={styles.textButton} disabled={busy} onClick={() => { setValue({ ...emptyConsent, isAdult: rsvp.is_adult ? "yes" : "no" }); setEditing(true); }}>update participation forms</button>
    </>}
    {message && <p className={styles.rsvpDeadline} role="status">{message}</p>}
  </section>;
}
