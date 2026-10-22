import { randomUUID } from "node:crypto";
import { getApplicationEmailConfig } from "./application-email";

export function createPortalEmail(email: string, link: string, code: string) {
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
  return {
    to: [email], subject: "your stupid ideas hackathon sign-in",
    text: ["stupid ideas hackathon / ottawa", "Sign in using this link:", link,
      `Or enter this code in the portal: ${code}`,
      "This sign-in can be used once. If you didn't request it, ignore this email."].join("\n\n"),
    html: `<div style="background:#fff;padding:36px 24px;font-family:Arial,sans-serif;color:#111"><div style="max-width:520px;margin:auto"><p>stupid ideas hackathon / ottawa</p><h1 style="font-size:32px">sign in</h1><p style="margin:24px 0"><a href="${escape(link)}" style="display:inline-block;background:#111;color:#fff;padding:14px 24px;text-decoration:none">sign in</a></p><p>Or enter this code in the portal:</p><p style="font-family:monospace;font-size:28px;letter-spacing:4px">${escape(code)}</p><p>This sign-in can be used once. If you didn’t request it, ignore this email.</p></div></div>`,
  };
}

export async function sendPortalEmail(email: string, link: string, code: string) {
  const config = getApplicationEmailConfig();
  if (!config) throw new Error("Portal email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `portal-sign-in-${randomUUID()}` },
    body: JSON.stringify({
      ...createPortalEmail(email, link, code),
      from: `Stupid Ideas Hackathon <${config.from}>`, reply_to: config.replyTo,
      // Never copy sign-in credentials to organizers or application notifications.
      tags: [{ name: "type", value: "portal-sign-in" }],
    }),
  });
  if (!response.ok) throw new Error("Portal email request failed");
}
