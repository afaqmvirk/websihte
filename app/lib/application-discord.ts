import {
  claimApplicationDiscordNotification,
  recordApplicationDiscordNotification,
} from "@/lib/application-storage";

export function getApplicationDiscordConfig() {
  try {
    const url = new URL(process.env.DISCORD_APPLICATION_WEBHOOK_URL?.trim() || "");
    if (url.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(url.hostname)
      || url.port || url.username || url.password || url.search || url.hash
      || !/^\/api\/(?:v10\/)?webhooks\/\d{17,20}\/[\w-]{40,}\/?$/.test(url.pathname)) return null;
    url.searchParams.set("wait", "true");
    return { url: url.toString() };
  } catch {
    return null;
  }
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function displayValue(value: string, limit: number) {
  const escaped = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/([\\`*_~|>])/g, "\\$1") || "Not provided";
  const suffix = "… (full answer attached)";
  return escaped.length <= limit ? escaped : escaped.slice(0, limit - suffix.length) + suffix;
}

export function createApplicationDiscordMessage(form: FormData, application: { id: string; created_at: string }) {
  const file = form.get("resume");
  const resume = file instanceof File && file.size > 0 ? file : null;
  const filename = resume?.name.split(/[\\/]/).pop()?.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 240) || "resume.pdf";
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
    ["Résumé", resume ? filename : "Not provided"],
  ];
  let remaining = 5_000;
  const fields = answers.map(([name, answer], index) => {
    const value = displayValue(answer, Math.min(1024, remaining - (answers.length - index - 1) * 32));
    remaining -= value.length;
    return { name, value, inline: ["Full name", "Email", "T-shirt size", "Dietary restrictions"].includes(name) };
  });
  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: "New application · Ottawa 2026",
      description: "Full answers are attached as a text file, along with the résumé when provided.",
      color: 0xf2c94c,
      fields,
      footer: { text: `Application ${application.id}` },
      timestamp: application.created_at,
    }],
    attachments: [
      { id: 0, filename: "application.txt", description: "Complete application answers" },
      ...(resume ? [{ id: 1, filename, description: "Applicant résumé" }] : []),
    ],
  };
  const body = new FormData();
  body.set("payload_json", JSON.stringify(payload));
  body.set("files[0]", new Blob([
    `Stupid Ideas Hackathon · Ottawa 2026\nApplication: ${application.id}\nSubmitted: ${application.created_at}\n\n`,
    answers.map(([name, answer]) => `${name}\n${answer}`).join("\n\n"),
  ], { type: "text/plain;charset=utf-8" }), "application.txt");
  if (resume) body.set("files[1]", resume, filename);
  return body;
}

async function sendApplicationDiscordMessage(body: FormData, config: NonNullable<ReturnType<typeof getApplicationDiscordConfig>>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let delay = 300 * (attempt + 1);
    try {
      const response = await fetch(config.url, {
        method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => null) as { id?: string; retry_after?: number } | null;
      if (response.ok && result?.id) return result.id;
      if (response.status !== 429 && response.status < 500) {
        console.error("Discord application notification was not accepted", { status: response.status });
        return null;
      }
      if (response.status === 429) {
        const retryAfter = Number(result?.retry_after ?? response.headers.get("Retry-After") ?? 1);
        // Never retry earlier than Discord permits; long waits can be retried on resubmission.
        if (!Number.isFinite(retryAfter) || retryAfter < 0 || retryAfter > 10) return null;
        delay = Math.ceil(retryAfter * 1_000);
      }
    } catch {
      // Do not log fetch errors: they can contain the secret webhook URL.
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.error("Discord application notification failed after retries");
  return null;
}

export async function notifyApplicationDiscord(
  form: FormData,
  application: { id: string; created_at: string; discord_notification_status: string },
  storage: Parameters<typeof claimApplicationDiscordNotification>[0],
) {
  const config = getApplicationDiscordConfig();
  if (!config || application.discord_notification_status === "sent") return;
  try {
    const claimId = await claimApplicationDiscordNotification(storage, application.id);
    if (!claimId) return;
    const messageId = await sendApplicationDiscordMessage(createApplicationDiscordMessage(form, application), config);
    await recordApplicationDiscordNotification(storage, application.id, claimId, messageId);
  } catch {
    // Organizer notifications must never make a saved application fail.
    console.error("Could not deliver or track Discord application notification", { applicationId: application.id });
  }
}
