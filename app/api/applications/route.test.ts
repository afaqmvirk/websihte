import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "./route";

const DATABASE_URL = "https://test.supabase.co";
const WEBHOOK_URL = `https://discord.com/api/webhooks/123456789012345678/${"test-token-".repeat(6)}`;
const envNames = ["APPLICATION_EMAIL_API_KEY", "RESEND_API_KEY", "APPLICATION_EMAIL_FROM", "APPLICATION_EMAIL_TO", "APPLICATION_EMAIL_REPLY_TO", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "DISCORD_APPLICATION_WEBHOOK_URL"];
const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
type RecordData = { id: string; [key: string]: unknown };
let calls: { url: string; init?: RequestInit }[];
let records: Map<string, RecordData>;
let uploads: Map<string, ArrayBuffer>;
let intercept: ((url: string, init?: RequestInit) => Response | null) | undefined;

function application() {
  const form = new FormData();
  Object.entries({
    event: "ottawa-2026", fullName: "Test Applicant", email: "  Applicant@Example.com  ",
    affiliation: "Test school", tshirtSize: "M", dietaryRestrictions: "none",
    linkedin: "https://linkedin.com/in/test", otherLink: "",
    stupidestThing: "I built an unnecessary button and people used it.",
    coolestBuild: "An unnecessary button.", attending: "on",
  }).forEach(([name, value]) => form.set(name, value));
  return form;
}

function submit(form = application()) {
  return POST(new Request("https://stupideas.com/api/applications", { method: "POST", body: form }));
}

const emailCalls = () => calls.filter(({ url }) => url === "https://api.resend.com/emails");
const discordCalls = () => calls.filter(({ url }) => url.startsWith(WEBHOOK_URL));

beforeEach(() => {
  envNames.forEach((name) => delete process.env[name]);
  process.env.RESEND_API_KEY = "test-only-email-key";
  process.env.SUPABASE_URL = DATABASE_URL;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test-only-server-key";
  process.env.DISCORD_APPLICATION_WEBHOOK_URL = WEBHOOK_URL;
  calls = [];
  records = new Map();
  uploads = new Map();
  intercept = undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const intercepted = intercept?.(url, init);
    if (intercepted) return intercepted;
    if (url === "https://api.resend.com/emails") return Response.json({ id: "test-email-id" });
    if (url.startsWith(WEBHOOK_URL)) return Response.json({ id: "test-discord-message-id" });
    assert.ok(url.startsWith(DATABASE_URL));
    const endpoint = new URL(url);
    if (endpoint.pathname.startsWith("/storage/v1/object/")) {
      uploads.set(endpoint.pathname, init?.body as ArrayBuffer);
      return Response.json({ Key: endpoint.pathname });
    }
    assert.equal(endpoint.pathname, "/rest/v1/applications");
    if (init?.method === "POST") {
      const data = JSON.parse(String(init.body));
      if (records.has(data.submission_hash)) return Response.json([]);
      const record = {
        confirmation_email_status: "pending", discord_notification_status: "pending",
        created_at: "2026-10-15T12:00:00.000Z", ...data, id: `application-${records.size + 1}`,
      };
      records.set(data.submission_hash, record);
      return Response.json([record]);
    }
    if (init?.method === "PATCH") {
      const record = [...records.values()].find((record) => `eq.${record.id}` === endpoint.searchParams.get("id"));
      assert.ok(record);
      const patch = JSON.parse(String(init.body));
      const claim = endpoint.searchParams.get("or");
      if (claim) {
        const matches = record.intake_status === "complete" && (
          ["pending", "failed"].includes(String(record.discord_notification_status))
          || record.discord_notification_claim_id === patch.discord_notification_claim_id
          || (record.discord_notification_status === "sending"
            && new Date(String(record.discord_notification_attempted_at)).getTime() < Date.now() - 120_000)
        );
        if (!matches) return Response.json([]);
        Object.assign(record, patch);
        return Response.json([{ id: record.id }]);
      }
      if (endpoint.searchParams.has("discord_notification_claim_id")
        && `eq.${record.discord_notification_claim_id}` !== endpoint.searchParams.get("discord_notification_claim_id")) {
        return new Response(null, { status: 204 });
      }
      if (endpoint.searchParams.get("confirmation_email_status") !== "neq.sent" || record.confirmation_email_status !== "sent") {
        Object.assign(record, patch);
      }
      return new Response(null, { status: 204 });
    }
    const hash = endpoint.searchParams.get("submission_hash")?.slice(3);
    return Response.json(hash && records.has(hash) ? [records.get(hash)] : []);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  envNames.forEach((name) => {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  });
});

describe("Ottawa application collection and receipts", () => {
  it("saves normalized answers and consent before emailing the applicant and organizer", async () => {
    const response = await submit();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).confirmationEmailSent, true);
    assert.equal(records.size, 1);
    const record = [...records.values()][0];
    assert.equal(record.email, "applicant@example.com");
    assert.equal(record.coolest_build, "An unnecessary button.");
    assert.equal(record.attending, true);
    assert.equal(record.sponsor_opt_in, false);
    assert.equal(record.privacy_policy_version, "2026-10-15");
    assert.equal(record.intake_status, "complete");
    assert.equal(record.confirmation_email_status, "sent");
    assert.equal(record.confirmation_email_id, "test-email-id");
    assert.ok(record.confirmation_email_sent_at);
    assert.match(calls[0].url, /\/rest\/v1\/applications/);
    const storageHeaders = new Headers(calls[0].init?.headers);
    assert.equal(storageHeaders.get("apikey"), "sb_secret_test-only-server-key");
    assert.equal(storageHeaders.get("Authorization"), null);
    const email = JSON.parse(String(emailCalls()[0].init?.body));
    assert.deepEqual(email.to, ["applicant@example.com"]);
    assert.deepEqual(email.bcc, ["stupidideashackathon@gmail.com"]);
    assert.equal(email.from, "Stupid Ideas Hackathon <applications@stupideas.com>");
    assert.equal(email.reply_to, "applications@stupideas.com");
    assert.match(email.text, /after review/);
    assert.doesNotMatch(email.html, /test-only/);
  });

  it("stores a private resume before sending it, preserves answers safely, and ignores unknown fields", async () => {
    const form = application();
    form.set("fullName", '<img src=x onerror="alert(1)"> & Test');
    form.set("dietaryRestrictions", "other");
    form.set("dietaryRestrictionsOther", "No peanuts & sesame");
    form.set("sponsorOptIn", "on");
    form.set("resume", new File(["synthetic resume contents"], "resume.pdf", { type: "text/plain" }));
    form.set("untrustedField", "DO NOT INCLUDE");
    assert.equal((await submit(form)).status, 200);
    const record = [...records.values()][0];
    assert.equal(record.sponsor_opt_in, true);
    assert.equal(record.dietary_restrictions_other, "No peanuts & sesame");
    assert.equal(record.resume_content_type, "application/pdf");
    assert.equal(record.resume_bucket, "application-resumes");
    assert.match(String(record.resume_path), /^ottawa-2026\/[a-f0-9]{64}\/resume\.pdf$/);
    assert.equal(Buffer.from([...uploads.values()][0]).toString(), "synthetic resume contents");
    assert.doesNotMatch(JSON.stringify(record), /DO NOT INCLUDE/);
    const emailIndex = calls.findIndex(({ url }) => url.includes("api.resend.com"));
    assert.ok(calls.findIndex(({ url }) => url.includes("/storage/v1/object/")) < emailIndex);
    const email = JSON.parse(String(emailCalls()[0].init?.body));
    assert.match(email.html, /&lt;img/);
    assert.doesNotMatch(email.html, /<img/);
    assert.match(email.text, /No peanuts & sesame/);
    assert.match(email.text, /event sponsors\nYes/);
    assert.equal(email.attachments[0].filename, "resume.pdf");
    assert.equal(Buffer.from(email.attachments[0].content, "base64").toString(), "synthetic resume contents");
  });

  it("retries transient mail failures with identical payloads and idempotency keys", async () => {
    intercept = (url) => url.includes("api.resend.com") && emailCalls().length === 1
      ? Response.json({}, { status: 429 }) : null;
    assert.equal((await submit()).status, 200);
    const emails = emailCalls();
    assert.equal(emails.length, 2);
    assert.equal(emails[0].init?.body, emails[1].init?.body);
    assert.equal(new Headers(emails[0].init?.headers).get("Idempotency-Key"), new Headers(emails[1].init?.headers).get("Idempotency-Key"));
  });

  it("retries transient database failures without creating multiple records", async () => {
    intercept = () => calls.length === 1 ? Response.json({}, { status: 503 }) : null;
    assert.equal((await submit()).status, 200);
    assert.equal(records.size, 1);
    assert.equal(calls[0].init?.body, calls[1].init?.body);
    assert.equal(emailCalls().length, 1);
  });

  it("deduplicates identical submissions durably and does not send a second receipt", async () => {
    await submit();
    const response = await submit();
    assert.equal(records.size, 1);
    assert.equal(emailCalls().length, 1);
    assert.equal(discordCalls().length, 1);
    assert.match((await response.json()).message, /already received/);
  });

  it("keeps changed answers separately instead of overwriting someone by email", async () => {
    await submit();
    const changed = application();
    changed.set("coolestBuild", "A different project.");
    await submit(changed);
    assert.equal(records.size, 2);
    assert.equal([...records.values()][0].coolest_build, "An unnecessary button.");
  });

  it("does not send a receipt when database storage fails", async () => {
    intercept = () => Response.json({}, { status: 403 });
    assert.equal((await submit()).status, 502);
    assert.equal(emailCalls().length, 0);
    assert.equal(records.size, 0);
  });

  it("resumes an interrupted resume upload against the same application", async () => {
    const form = application();
    form.set("resume", new File(["test resume"], "resume.pdf"));
    intercept = (url) => url.includes("/storage/v1/object/") ? Response.json({}, { status: 503 }) : null;
    assert.equal((await submit(form)).status, 502);
    assert.equal(records.size, 1);
    assert.equal([...records.values()][0].intake_status, "pending_resume");
    assert.equal(emailCalls().length, 0);
    intercept = undefined;
    assert.equal((await submit(form)).status, 200);
    assert.equal(records.size, 1);
    assert.equal(uploads.size, 1);
    assert.equal([...records.values()][0].intake_status, "complete");
    assert.equal(emailCalls().length, 1);
  });

  it("keeps a saved application successful if its email fails, and can retry the receipt", async () => {
    intercept = (url) => url.includes("api.resend.com") ? Response.json({}, { status: 403 }) : null;
    const response = await submit();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.confirmationEmailSent, false);
    assert.match(result.message, /don't need to apply again/);
    assert.equal([...records.values()][0].confirmation_email_status, "failed");
    intercept = undefined;
    assert.equal((await submit()).status, 200);
    assert.equal(records.size, 1);
    assert.equal([...records.values()][0].confirmation_email_status, "sent");
  });

  it("does not fail a stored application if email-status tracking is unavailable", async () => {
    intercept = (url, init) => url.includes("/rest/") && init?.method === "PATCH"
      ? Response.json({}, { status: 403 }) : null;
    const response = await submit();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).confirmationEmailSent, true);
    assert.equal(records.size, 1);
    assert.equal(emailCalls().length, 1);
  });

  it("requires both providers and rejects browser keys as server credentials", async () => {
    delete process.env.RESEND_API_KEY;
    assert.equal((await submit()).status, 503);
    process.env.RESEND_API_KEY = "test-only-key";
    delete process.env.SUPABASE_URL;
    assert.equal((await submit()).status, 503);
    process.env.SUPABASE_URL = DATABASE_URL;
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_test";
    assert.equal((await submit()).status, 503);
    assert.equal(calls.length, 0);
  });

  it("rejects invalid email, missing consent, oversized answers and bad links", async () => {
    for (const [name, value] of [["email", "bad\r\nBcc: victim@example.com"], ["attending", ""], ["stupidestThing", "x".repeat(401)], ["linkedin", "javascript:alert(1)"]]) {
      const form = application();
      form.set(name, value);
      assert.equal((await submit(form)).status, 400);
    }
    assert.equal(calls.length, 0);
  });

  it("rejects unsupported and oversized attachments", async () => {
    const form = application();
    form.set("resume", new File(["script"], "resume.exe"));
    assert.equal((await submit(form)).status, 400);
    form.set("resume", new File([new Uint8Array(4 * 1024 * 1024 + 1)], "resume.pdf"));
    assert.equal((await submit(form)).status, 413);
    assert.equal(calls.length, 0);
  });

  it("ignores honeypot submissions without calling either provider", async () => {
    const form = application();
    form.set("website", "spam.example.com");
    assert.equal((await submit(form)).status, 200);
    assert.equal(calls.length, 0);
  });

  it("posts all application details and the optional résumé to Discord after storage completes", async () => {
    const form = application();
    form.set("fullName", "Test @everyone **Applicant**");
    form.set("dietaryRestrictions", "other");
    form.set("dietaryRestrictionsOther", "No peanuts");
    form.set("sponsorOptIn", "on");
    form.set("resume", new File(["Synthetic résumé"], "test-resume.pdf", { type: "application/pdf" }));
    form.set("unknownField", "MUST NOT SEND");
    const response = await submit(form);
    assert.equal((await response.json()).confirmationEmailSent, true);
    assert.equal(discordCalls().length, 1);
    const call = discordCalls()[0];
    assert.equal(new URL(call.url).searchParams.get("wait"), "true");
    const body = call.init?.body as FormData;
    const payload = JSON.parse(String(body.get("payload_json")));
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
    assert.match(payload.embeds[0].fields[0].value, /\\\*\\\*Applicant\\\*\\\*/);
    assert.ok(payload.embeds[0].fields.some((field: { value: string }) => field.value === "No peanuts"));
    assert.equal(await (body.get("files[1]") as File).text(), "Synthetic résumé");
    const fullApplication = await (body.get("files[0]") as File).text();
    assert.match(fullApplication, /Test @everyone \*\*Applicant\*\*/);
    assert.match(fullApplication, /applicant@example.com/);
    assert.match(fullApplication, /event sponsors\nYes/);
    assert.doesNotMatch(fullApplication, /MUST NOT SEND/);
    const discordIndex = calls.findIndex(({ url }) => url.startsWith(WEBHOOK_URL));
    assert.ok(calls.findIndex(({ url }) => url.includes("/storage/v1/object/")) < discordIndex);
    assert.equal([...records.values()][0].discord_notification_status, "sent");
    assert.equal([...records.values()][0].discord_notification_id, "test-discord-message-id");
  });

  it("respects Discord rate limits and records successful delivery", async () => {
    intercept = (url) => url.startsWith(WEBHOOK_URL) && discordCalls().length === 1
      ? Response.json({ retry_after: 0.001 }, { status: 429 }) : null;
    assert.equal((await submit()).status, 200);
    assert.equal(discordCalls().length, 2);
    assert.equal([...records.values()][0].discord_notification_status, "sent");
  });

  it("preserves signup and email success on webhook failure, then retries only the notification", async () => {
    intercept = (url) => url.startsWith(WEBHOOK_URL) ? Response.json({}, { status: 403 }) : null;
    assert.equal((await (await submit()).json()).confirmationEmailSent, true);
    assert.equal([...records.values()][0].discord_notification_status, "failed");
    intercept = undefined;
    await submit();
    assert.equal(records.size, 1);
    assert.equal(emailCalls().length, 1);
    assert.equal(discordCalls().length, 2);
    assert.equal([...records.values()][0].discord_notification_status, "sent");
  });

  it("sends the Discord notification even when receipt email fails", async () => {
    intercept = (url) => url.includes("api.resend.com") ? Response.json({}, { status: 403 }) : null;
    assert.equal((await (await submit()).json()).confirmationEmailSent, false);
    assert.equal([...records.values()][0].discord_notification_status, "sent");
  });

  it("claims a concurrent duplicate only once", async () => {
    const responses = await Promise.all([submit(), submit()]);
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(records.size, 1);
    assert.equal(discordCalls().length, 1);
  });

  it("keeps Discord embed limits and attaches complete long answers", async () => {
    const form = application();
    form.set("affiliation", "*".repeat(500));
    const longLink = `https://example.com/${"_".repeat(2028)}`;
    form.set("linkedin", longLink);
    form.set("otherLink", longLink);
    await submit(form);
    const body = discordCalls()[0].init?.body as FormData;
    const embed = JSON.parse(String(body.get("payload_json"))).embeds[0];
    let length = embed.title.length + embed.description.length + embed.footer.text.length;
    for (const field of embed.fields) {
      assert.ok(field.value.length > 0 && field.value.length <= 1024);
      length += field.name.length + field.value.length;
    }
    assert.ok(length <= 6000);
    assert.ok((await (body.get("files[0]") as File).text()).includes(longLink));
  });

  it("ignores absent or unsafe webhook URLs without sending data elsewhere", async () => {
    for (const url of ["", "https://example.com/api/webhooks/123/token", `${WEBHOOK_URL}?redirect=elsewhere`]) {
      process.env.DISCORD_APPLICATION_WEBHOOK_URL = url;
      const form = application();
      form.set("coolestBuild", `Configuration check ${url.length}`);
      assert.equal((await submit(form)).status, 200);
    }
    assert.equal(discordCalls().length, 0);
  });
});
