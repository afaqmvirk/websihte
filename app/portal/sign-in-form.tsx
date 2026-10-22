"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./portal.module.css";

export default function SignInForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"email" | "code">("email");
  const [state, setState] = useState<"idle" | "sending" | "verifying">("idle");
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  function enterCode() {
    setMode("code"); setError("");
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  async function sendEmail() {
    setError(""); setState("sending");
    try {
      const response = await fetch("/api/portal/sign-in", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't send your email. Please try again.");
      setCode(""); enterCode();
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't send your email. Please try again.");
    } finally { setState("idle"); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "email") return sendEmail();
    setError(""); setState("verifying");
    try {
      const response = await fetch("/api/portal/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't verify your code. Please try again.");
      window.location.assign(data.destination);
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't verify your code. Please try again.");
      setState("idle");
    }
  }

  const busy = state !== "idle";
  return (
    <form className={styles.signInForm} onSubmit={submit}>
      <h1>sign in</h1>
      <p role={mode === "code" ? "status" : undefined}>{mode === "code" ? "Use the email link or enter your code." : "Use your application email."}</p>
      {invalidLink && mode === "email" && <p className={styles.error} role="alert">Link unavailable. Request a new one.</p>}
      <label htmlFor="portal-email" className={styles.fieldLabel}>email</label>
      <input id="portal-email" name="email" type="email" autoComplete="email" required maxLength={320}
        value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
      {mode === "code" && <>
        <label htmlFor="portal-code" className={styles.fieldLabel}>code</label>
        <input id="portal-code" ref={codeRef} name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
          required pattern="[0-9]{6,10}" maxLength={10} value={code}
          onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))} disabled={busy} />
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {state === "sending" ? "sending…" : state === "verifying" ? "signing in…" : mode === "code" ? "sign in" : "send sign-in email"}
      </button>
      <button className={styles.textButton} type="button" disabled={busy}
        onClick={mode === "code" ? sendEmail : enterCode}>
        {mode === "code" ? "send another email" : "enter a code"}
      </button>
    </form>
  );
}
