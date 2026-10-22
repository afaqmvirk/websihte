import { randomUUID } from "node:crypto";
import { getApplicationEmailConfig } from "./application-email";

export function createPortalEmail(email: string, link: string) {
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
  return {
    to: [email], subject: "your stupid ideas hackathon sign-in link",
    text: ["your next stupid idea awaits.", "Sign in to your Ottawa participant dashboard:", link,
      "This link can be used once. If you didn't request it, you can ignore this email."].join("\n\n"),
    html: `<div style="background:#f5f2e9;padding:36px 24px;font-family:Arial,sans-serif;color:#191919"><div style="max-width:520px;margin:auto"><p>stupid ideas hackathon / ottawa</p><h1 style="font-size:36px;line-height:1.1">your next stupid idea awaits.</h1><p>Your schedule and RSVP are waiting in your participant dashboard.</p><p style="margin:30px 0"><a href="${escape(link)}" style="display:inline-block;background:#191919;color:#fff;padding:16px 24px;text-decoration:none">sign in to my dashboard ↗</a></p><p>This link can be used once. If you didn’t request it, you can ignore this email.</p></div></div>`,
  };
}

export async function sendPortalEmail(email: string, link: string) {
  const config = getApplicationEmailConfig();
  if (!config) throw new Error("Portal email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `portal-sign-in-${randomUUID()}` },
    body: JSON.stringify({
      ...createPortalEmail(email, link),
      from: `Stupid Ideas Hackathon <${config.from}>`, reply_to: config.replyTo,
      // Never Bcc a sign-in link to organizers or application notifications.
      tags: [{ name: "type", value: "portal-sign-in" }],
    }),
  });
  if (!response.ok) throw new Error("Portal email request failed");
}
