"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatRsvpDeadline, TRAVEL_PLAN_LIMIT, type PortalRsvp } from "@/lib/portal";
import styles from "./portal.module.css";

export default function RsvpForm({ initialRsvp, deadline, initiallyClosed }: {
  initialRsvp: PortalRsvp | null; deadline: string | null; initiallyClosed: boolean;
}) {
  const [saved, setSaved] = useState(initialRsvp);
  const [editing, setEditing] = useState(!initialRsvp);
  const [local, setLocal] = useState<"yes" | "no" | "">(initialRsvp ? initialRsvp.is_local ? "yes" : "no" : "");
  const [travelPlan, setTravelPlan] = useState(initialRsvp?.travel_plan || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(initiallyClosed);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  const keepRsvpButton = useRef<HTMLButtonElement>(null);
  const canRsvp = deadline !== null && !closed;

  useEffect(() => {
    if (!deadline || closed) return;
    const timeout = window.setTimeout(() => setClosed(true), Math.max(0, new Date(deadline).getTime() - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [deadline, closed]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSaving(true);
    try {
      const response = await fetch("/api/portal/rsvp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocal: local === "yes", travelPlan }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.reason === "closed") setClosed(true);
        throw new Error(data.message || "We couldn't save your RSVP. Please try again.");
      }
      setSaved(data.rsvp); setEditing(false);
      requestAnimationFrame(() => savedHeading.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't save your RSVP. Your answers are still here; please try again."); }
    finally { setSaving(false); }
  }

  async function cancelRsvp() {
    setError(""); setSaving(true);
    try {
      const response = await fetch("/api/portal/rsvp/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't cancel your RSVP. Please try again.");
      setSaved(data.rsvp); setEditing(false); setConfirmingCancel(false);
      requestAnimationFrame(() => savedHeading.current?.focus());
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't cancel your RSVP. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <section id="rsvp" className={styles.rsvpCard} aria-labelledby="rsvp-heading" aria-busy={saving}>
      <h2 id="rsvp-heading" tabIndex={-1} ref={savedHeading}>{saved?.cancelled_at && (!editing || !canRsvp) ? "RSVP cancelled" : closed ? "RSVP closed" : saved && !editing ? "RSVP saved" : "RSVP"}</h2>
      <p className={styles.rsvpDeadline}>
        {deadline ? <>{closed ? "RSVP closed at" : "RSVP by"} <time dateTime={deadline}>midnight at the end of {formatRsvpDeadline(deadline)}</time>.
          {!closed && (saved?.cancelled_at ? " You can RSVP again until then." : " You can save and edit your RSVP until then. You can cancel even after the deadline.")}</>
          : "Your RSVP deadline will appear here once your acceptance email has been sent."}
      </p>
      {closed && !saved?.cancelled_at && <p className={styles.rsvpDeadline} role="status">{saved ? "Your saved RSVP is below. You can still cancel it." : "No RSVP was submitted."} For help, email <a href="mailto:applications@stupideas.com">applications@stupideas.com</a>.</p>}
      {saved?.cancelled_at && (!editing || !canRsvp) ? (
        <div className={styles.savedRsvp}>
          <p className={styles.rsvpDeadline} role="status">You&apos;re no longer marked as attending.</p>
          {canRsvp ? <button className={styles.secondaryButton} onClick={() => { setEditing(true); setError(""); }}>RSVP again</button>
            : <p className={styles.rsvpDeadline}>{closed ? "To RSVP again after the deadline, email " : "To RSVP again, email "}<a href="mailto:applications@stupideas.com">applications@stupideas.com</a>.</p>}
        </div>
      ) : saved && (!editing || !canRsvp) ? (
        <div className={styles.savedRsvp}>
          <dl className={styles.savedAnswers}>
            <div><dt>local to ottawa</dt><dd>{saved.is_local ? "yes" : "no"}</dd></div>
            {!saved.is_local && <div><dt>travel + accommodation plan</dt><dd>{saved.travel_plan}</dd></div>}
          </dl>
          {confirmingCancel ? (
            <div className={styles.cancelConfirmation} role="group" aria-labelledby="cancel-rsvp-heading">
              <h3 id="cancel-rsvp-heading">cancel your RSVP?</h3>
              <p>You will no longer be marked as attending. {canRsvp ? "You can RSVP again until the deadline." : "The deadline has passed, so you'll need to contact us if you want to RSVP again."}</p>
              <div className={styles.rsvpActions}>
                <button className={styles.primaryButton} disabled={saving} onClick={cancelRsvp}>{saving ? "cancelling…" : "yes, cancel RSVP"}</button>
                <button ref={keepRsvpButton} className={styles.textButton} disabled={saving} onClick={() => { setConfirmingCancel(false); setError(""); }}>keep RSVP</button>
              </div>
            </div>
          ) : (
            <div className={styles.rsvpActions}>
              {canRsvp && <button className={styles.secondaryButton} onClick={() => { setEditing(true); setError(""); }}>edit RSVP</button>}
              <button className={styles.textButton} onClick={() => {
                setConfirmingCancel(true); setError("");
                requestAnimationFrame(() => keepRsvpButton.current?.focus());
              }}>cancel RSVP</button>
            </div>
          )}
        </div>
      ) : canRsvp ? (
        <form onSubmit={submit} className={styles.rsvpForm} aria-busy={saving}>
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
              <label className={styles.fieldLabel} htmlFor="travel-plan">how do you intend to arrive, and where do you plan to stay?</label>
              <p id="travel-note" className={styles.travelNote}>No travel reimbursement. You may be eligible for the &ldquo;stupidest journey&rdquo; award.</p>
              <textarea id="travel-plan" name="travelPlan" rows={4} required maxLength={TRAVEL_PLAN_LIMIT} disabled={saving}
                aria-describedby="travel-note" value={travelPlan} onChange={(event) => setTravelPlan(event.target.value)} />
            </div>
          )}
          <button className={styles.primaryButton} type="submit" disabled={saving || !local}>
            {saving ? "saving…" : "save RSVP"}
          </button>
          {saved ? <button className={styles.textButton} type="button" disabled={saving} onClick={() => {
            setLocal(saved.is_local ? "yes" : "no"); setTravelPlan(saved.travel_plan || ""); setEditing(false); setError("");
          }}>discard edits</button> : null}
        </form>
      ) : null}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
