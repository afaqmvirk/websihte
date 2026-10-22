"use client";

import { useRef, useState, type FormEvent } from "react";
import { TRAVEL_PLAN_LIMIT, type PortalRsvp } from "@/lib/portal";
import styles from "./portal.module.css";

export default function RsvpForm({ initialRsvp }: { initialRsvp: PortalRsvp | null }) {
  const [saved, setSaved] = useState(initialRsvp);
  const [editing, setEditing] = useState(!initialRsvp);
  const [local, setLocal] = useState<"yes" | "no" | "">(initialRsvp ? initialRsvp.is_local ? "yes" : "no" : "");
  const [travelPlan, setTravelPlan] = useState(initialRsvp?.travel_plan || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savedHeading = useRef<HTMLHeadingElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSaving(true);
    try {
      const response = await fetch("/api/portal/rsvp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocal: local === "yes", travelPlan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't save your RSVP. Please try again.");
      setSaved(data.rsvp); setEditing(false);
      requestAnimationFrame(() => savedHeading.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't save your RSVP. Your answers are still here; please try again."); }
    finally { setSaving(false); }
  }

  return (
    <section id="rsvp" className={styles.rsvpCard} aria-labelledby="rsvp-heading">
      {saved && !editing ? (
        <div className={styles.savedRsvp}>
          <h2 id="rsvp-heading" tabIndex={-1} ref={savedHeading}>RSVP saved</h2>
          <dl className={styles.savedAnswers}>
            <div><dt>local to ottawa</dt><dd>{saved.is_local ? "yes" : "no"}</dd></div>
            {!saved.is_local && <div><dt>arrival plan</dt><dd>{saved.travel_plan}</dd></div>}
          </dl>
          <button className={styles.secondaryButton} onClick={() => { setEditing(true); setError(""); }}>edit RSVP</button>
        </div>
      ) : (
        <form onSubmit={submit} className={styles.rsvpForm} aria-busy={saving}>
          <h2 id="rsvp-heading">RSVP</h2>
          <fieldset disabled={saving}>
            <legend>are you local to ottawa?</legend>
            <div className={styles.radioOptions}>
              <label className={styles.radioOption}>
                <input type="radio" name="isLocal" value="yes" required checked={local === "yes"} onChange={() => setLocal("yes")} />
                <span>yes</span>
              </label>
              <label className={styles.radioOption}>
                <input type="radio" name="isLocal" value="no" required checked={local === "no"} onChange={() => setLocal("no")} />
                <span>no</span>
              </label>
            </div>
          </fieldset>
          {local === "no" && (
            <div className={styles.travelField}>
              <label className={styles.fieldLabel} htmlFor="travel-plan">how do you intend to arrive?</label>
              <p id="travel-note" className={styles.travelNote}>No travel reimbursement. You may be eligible for the &ldquo;stupidest journey&rdquo; award.</p>
              <textarea id="travel-plan" name="travelPlan" rows={4} required maxLength={TRAVEL_PLAN_LIMIT} disabled={saving}
                aria-describedby="travel-note" value={travelPlan} onChange={(event) => setTravelPlan(event.target.value)} />
            </div>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primaryButton} type="submit" disabled={saving || !local}>
            {saving ? "saving…" : "save RSVP"}
          </button>
          {saved ? <button className={styles.textButton} type="button" disabled={saving} onClick={() => {
            setLocal(saved.is_local ? "yes" : "no"); setTravelPlan(saved.travel_plan || ""); setEditing(false); setError("");
          }}>cancel</button> : null}
        </form>
      )}
    </section>
  );
}
