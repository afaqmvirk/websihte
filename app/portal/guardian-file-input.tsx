"use client";
import { useEffect, useRef } from "react";
import type { PortalRsvp } from "@/lib/portal";
import styles from "./portal.module.css";

export default function GuardianFileInput({ id, file, onChange, disabled }: {
  id: string; file: File | null; onChange: (file: File | null) => void; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!file && input.current) input.current.value = ""; }, [file]);
  return <label className={styles.uploadBox} htmlFor={id}>
    <strong>signed parent / guardian form</strong>
    <span className={styles.uploadFilename}>{file ? file.name : "click to choose a file"}</span>
    <small id={`${id}-hint`}>PDF, JPG or PNG · up to 4 MB</small>
    <input ref={input} id={id} type="file" aria-label="signed parent / guardian form" aria-describedby={`${id}-hint`}
      accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" disabled={disabled}
      onChange={event => onChange(event.target.files?.[0] || null)} />
  </label>;
}

export async function uploadGuardianFile(file: File): Promise<{ rsvp: PortalRsvp; message: string }> {
  if (!file.size || file.size > 4_000_000) throw new Error("Choose a signed PDF, JPG or PNG up to 4 MB.");
  const form = new FormData(); form.set("file", file);
  const response = await fetch("/api/portal/guardian/upload", { method: "POST", body: form, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "We couldn't upload your parent/guardian form.");
  return result;
}

export async function uploadAfterConsent(saved: { rsvp: PortalRsvp; message: string; emailSent?: boolean }, file: File | null) {
  if (!file || saved.rsvp.is_adult !== false) return saved;
  try {
    const uploaded = await uploadGuardianFile(file);
    return { ...saved, rsvp: uploaded.rsvp, message: `${saved.emailSent === false ? "RSVP saved, but we couldn't send the confirmation email." : "RSVP and required agreements saved."} ${uploaded.message}` };
  } catch (error) {
    // Saving the RSVP succeeded. A separate file failure must not hide that fact
    // or make the attendee submit their RSVP again.
    return { ...saved, message: `RSVP and required agreements saved. ${error instanceof Error ? error.message : "We couldn't upload your parent/guardian form."} Please use the upload box below to try again.` };
  }
}
