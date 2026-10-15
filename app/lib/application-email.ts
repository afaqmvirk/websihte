import { createHash } from "node:crypto";

const RESEND_API_URL = "https://api.resend.com/emails";
const APPLICATION_ADDRESS = "applications@stupideas.com";
const ORGANIZER_ADDRESS = "stupidideashackathon@gmail.com";

export function isValidEmail(value: string) {
  return value.length <= 320 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

export function getApplicationEmailConfig() {
  const apiKey = process.env.APPLICATION_EMAIL_API_KEY || process.env.RESEND_API_KEY;
  const from = process.env.APPLICATION_EMAIL_FROM?.trim() || APPLICATION_ADDRESS;
  const organizer = process.env.APPLICATION_EMAIL_TO?.trim() || ORGANIZER_ADDRESS;
  const replyTo = process.env.APPLICATION_EMAIL_REPLY_TO?.trim() || APPLICATION_ADDRESS;

  if (!apiKey || ![from, organizer, replyTo].every(isValidEmail)) return null;
  return { apiKey, from, organizer, replyTo };
}

type EmailConfig = NonNullable<ReturnType<typeof getApplicationEmailConfig>>;

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export async function createApplicationEmail(form: FormData, config: EmailConfig) {
  const resume = form.get("resume");
  const attachment = resume instanceof File && resume.size > 0 ? {
    filename: resume.name.split(/[\\/]/).pop()!.replace(/[\r\n]/g, ""),
    content: Buffer.from(await resume.arrayBuffer()).toString("base64"),
  } : null;

  const answers: [string, string][] = [
    ["Full name", field(form, "fullName")],
    ["Email", field(form, "email")],
    ["School / company / side quest", field(form, "affiliation")],
    ["T-shirt size", field(form, "tshirtSize")],
    ["Dietary restrictions", field(form, "dietaryRestrictions") === "other"
      ? field(form, "dietaryRestrictionsOther") : field(form, "dietaryRestrictions")],
    ["LinkedIn", field(form, "linkedin")],
    ["Another link", field(form, "otherLink") || "Not provided"],
    ["What's the stupidest thing you've ever done that completely worked out well?", field(form, "stupidestThing")],
    ["Coolest thing you've ever built", field(form, "coolestBuild")],
    ["Attendance and privacy consent", "Confirmed"],
    ["Share contact/profile details and résumé with event sponsors", form.get("sponsorOptIn") === "on" ? "Yes" : "No"],
    ["Résumé", attachment?.filename || "Not provided"],
  ];
  const greeting = `Hey ${field(form, "fullName")},`;
  const introduction = "We've received your application to the Stupid Ideas Hackathon Ottawa. Here's a copy of what you sent.";
  const nextSteps = "This confirms receipt of your application. We'll email you with an update after review.";
  const contact = `Need to correct something? Reply to this email or write to ${config.replyTo}.`;

  return {
    from: `Stupid Ideas Hackathon <${config.from}>`,
    to: [field(form, "email")],
    bcc: [config.organizer],
    reply_to: config.replyTo,
    subject: "Your Stupid Ideas Hackathon Ottawa application",
    text: [greeting, introduction, nextSteps,
      ...answers.map(([label, value]) => `${label}\n${value}`),
      contact, "https://stupideas.com/ottawa",
    ].join("\n\n"),
    html: `<div style="background:#f4f0e5;padding:28px 16px;color:#242420;font-family:Arial,sans-serif;line-height:1.6"><div style="max-width:600px;margin:auto"><p>stupid ideas hackathon / ottawa</p><h1 style="font-size:30px;line-height:1.2">application received.</h1><p>${escapeHtml(greeting)}</p><p>${introduction}</p><p>${nextSteps}</p><dl>${answers.map(([label, value]) => `<dt style="margin-top:20px;font-weight:bold">${escapeHtml(label)}</dt><dd style="margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(value)}</dd>`).join("")}</dl><p style="margin-top:28px">${escapeHtml(contact)}</p><p><a href="https://stupideas.com/ottawa" style="color:#242420">stupideas.com/ottawa</a></p></div></div>`,
    ...(attachment ? { attachments: [attachment] } : {}),
    tags: [{ name: "event", value: "ottawa-2026" }, { name: "type", value: "application-receipt" }],
  };
}

export async function sendApplicationEmail(form: FormData, config: EmailConfig) {
  const body = JSON.stringify(await createApplicationEmail(form, config));
  // Keep the payload and key identical across retries, including browser resubmissions.
  const idempotencyKey = `ottawa-application/${createHash("sha256").update(body).digest("hex")}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => null) as { id?: string; name?: string } | null;
      if (response.ok && result?.id) return result.id;

      const retryable = response.status === 429 || response.status >= 500
        || result?.name === "concurrent_idempotent_requests";
      if (!retryable || attempt === 2) {
        console.error("Application email was not accepted", { status: response.status });
        return null;
      }
    } catch {
      if (attempt === 2) {
        console.error("Application email request failed after retries");
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  return null;
}
