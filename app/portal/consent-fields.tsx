"use client";
import { documentHref, PARENT_FORM_DOWNLOAD } from "@/lib/participant-documents";
import styles from "./portal.module.css";

export type ConsentValues = { isAdult: "yes" | "no" | ""; signature: string; codeAccepted: boolean; waiverAccepted: boolean; mediaConsent: boolean };
export const emptyConsent: ConsentValues = { isAdult: "", signature: "", codeAccepted: false, waiverAccepted: false, mediaConsent: false };
export const consentPayload = (value: ConsentValues) => ({ ...value, isAdult: value.isAdult === "" ? null : value.isAdult === "yes" });

export default function ConsentFields({ value, onChange, disabled, prefix }: {
  value: ConsentValues; onChange: (value: ConsentValues) => void; disabled: boolean; prefix: string;
}) {
  const update = (change: Partial<ConsentValues>) => onChange({ ...value, ...change });
  return <fieldset className={styles.agreementFields} disabled={disabled}>
    <legend>required participation forms</legend>
    <fieldset>
      <legend>Are you 18 or older?</legend>
      <p className={styles.travelNote}>Answer for the event date: November 15, 2026.</p>
      <div className={styles.radioOptions}>
        <label className={styles.radioOption}><input type="radio" name={`${prefix}-adult`} required checked={value.isAdult === "yes"} onChange={() => update({ isAdult: "yes" })} />yes</label>
        <label className={styles.radioOption}><input type="radio" name={`${prefix}-adult`} required checked={value.isAdult === "no"} onChange={() => update({ isAdult: "no" })} />no</label>
      </div>
    </fieldset>
    {value.isAdult === "no" && <p className={styles.rsvpDeadline}><a href={PARENT_FORM_DOWNLOAD} download>Download the parent/guardian consent form</a>, have your parent or legal guardian sign it, then upload the signed copy here after saving your RSVP. An organizer must approve it before check-in.</p>}
    <label className={styles.agreementChoice}><input type="checkbox" required checked={value.codeAccepted} onChange={event => update({ codeAccepted: event.target.checked })} /><span>I have read and agree to the <a href={documentHref("code-of-conduct")} target="_blank" rel="noreferrer">SIH Code of Conduct and Event Policy</a>.</span></label>
    <label className={styles.agreementChoice}><input type="checkbox" required checked={value.waiverAccepted} onChange={event => update({ waiverAccepted: event.target.checked })} /><span>I have read and accept the <a href={documentHref("liability-waiver")} target="_blank" rel="noreferrer">SIH Liability Release Waiver</a> and agree to sign electronically.{value.isAdult === "no" ? " I am providing the minor participant acknowledgment; my parent or guardian must also complete their form." : " I understand that the adult release affects my legal rights, including claims for negligence."}</span></label>
    <label className={styles.fieldLabel} htmlFor={`${prefix}-signature`}>type your full legal name as your electronic signature</label>
    <input id={`${prefix}-signature`} type="text" required minLength={2} maxLength={160} value={value.signature} onChange={event => update({ signature: event.target.value })} autoComplete="name" />
    <label className={styles.agreementChoice}><input type="checkbox" checked={value.mediaConsent} onChange={event => update({ mediaConsent: event.target.checked })} /><span>I agree to the <a href={documentHref("media-release")} target="_blank" rel="noreferrer">optional photo/video authorization</a>. Declining will not affect participation.{value.isAdult === "no" ? " My parent or guardian must also authorize this for it to take effect." : ""}</span></label>
  </fieldset>;
}
