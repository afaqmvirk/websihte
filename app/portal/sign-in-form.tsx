"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./portal.module.css";

export default function SignInForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const messageRef = useRef<HTMLHeadingElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setState("sending");
    try {
      const response = await fetch("/api/portal/sign-in", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't send your link. Please try again.");
      setState("sent");
      requestAnimationFrame(() => messageRef.current?.focus());
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't send your link. Please try again.");
      setState("idle");
    }
  }

  if (state === "sent") return (
    <div className={styles.signInForm} role="status">
      <h1 tabIndex={-1} ref={messageRef}>check your email</h1>
      <p>If accepted, you&apos;ll receive a sign-in link at <strong>{email}</strong>.</p>
      <button className={styles.secondaryButton} onClick={() => setState("idle")}>back to sign in</button>
    </div>
  );

  return (
    <form className={styles.signInForm} onSubmit={submit}>
      <h1>sign in</h1>
      <p>Use your application email.</p>
      {invalidLink && <p className={styles.error} role="alert">Link unavailable. Request a new one.</p>}
      <label htmlFor="portal-email" className={styles.fieldLabel}>email</label>
      <input id="portal-email" name="email" type="email" autoComplete="email" required maxLength={320}
        value={email} onChange={(event) => setEmail(event.target.value)} disabled={state === "sending"} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primaryButton} type="submit" disabled={state === "sending"}>
        {state === "sending" ? "sending…" : "send sign-in link"}
      </button>
    </form>
  );
}
