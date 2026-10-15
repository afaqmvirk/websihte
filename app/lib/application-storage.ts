import { createHash } from "node:crypto";

const RESUME_BUCKET = "application-resumes";
const PRIVACY_POLICY_VERSION = "2026-10-14";
const RECEIPT_COLUMNS = "id,intake_status,confirmation_email_status";

export function getApplicationStorageConfig() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  try {
    const url = new URL(process.env.SUPABASE_URL || "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || url.pathname !== "/" || !key?.startsWith("sb_secret_")) return null;
    return { url: url.origin, key };
  } catch {
    return null;
  }
}

type StorageConfig = NonNullable<ReturnType<typeof getApplicationStorageConfig>>;
type StoredApplication = {
  id: string;
  intake_status: "pending_resume" | "complete";
  confirmation_email_status: "pending" | "sent" | "failed";
};

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function storageRequest(config: StorageConfig, path: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = new Headers(init.headers);
      // Modern Supabase secret keys belong in apikey, not a Bearer JWT header.
      headers.set("apikey", config.key);
      const response = await fetch(`${config.url}${path}`, {
        ...init, headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return response;
      if (response.status !== 408 && response.status !== 429 && response.status < 500) break;
    } catch {
      // A unique submission hash and content-addressed file make retries safe.
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw new Error("Application storage request failed");
}

export async function storeApplication(form: FormData, config: StorageConfig): Promise<StoredApplication> {
  const file = form.get("resume");
  const resume = file instanceof File && file.size > 0 ? file : null;
  const bytes = resume ? await resume.arrayBuffer() : null;
  const extension = resume?.name.match(/\.(pdf|doc|docx)$/i)?.[1].toLowerCase();
  const contentType = extension ? {
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }[extension] : null;
  const filename = resume?.name.split(/[\\/]/).pop()?.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 240) || null;
  if (resume && (!bytes || !contentType || !filename)) throw new Error("Invalid résumé");

  const answers = {
    event_slug: field(form, "event"),
    full_name: field(form, "fullName"),
    email: field(form, "email").toLowerCase(),
    affiliation: field(form, "affiliation"),
    tshirt_size: field(form, "tshirtSize"),
    dietary_restrictions: field(form, "dietaryRestrictions"),
    dietary_restrictions_other: field(form, "dietaryRestrictions") === "other"
      ? field(form, "dietaryRestrictionsOther") : null,
    linkedin_url: field(form, "linkedin"),
    other_url: field(form, "otherLink") || null,
    stupidest_thing: field(form, "stupidestThing"),
    coolest_build: field(form, "coolestBuild"),
    attending: form.get("attending") === "on",
    sponsor_opt_in: form.get("sponsorOptIn") === "on",
    privacy_policy_version: PRIVACY_POLICY_VERSION,
    resume_filename: filename,
    resume_content_type: contentType,
    resume_size: resume?.size || 0,
    resume_sha256: bytes ? sha256(Buffer.from(bytes)) : null,
  };
  const submissionHash = sha256(JSON.stringify(answers));
  const resumePath = resume ? `${answers.event_slug}/${submissionHash}/resume.${extension}` : null;
  const response = await storageRequest(config,
    `/rest/v1/applications?on_conflict=submission_hash&select=${RECEIPT_COLUMNS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        ...answers, submission_hash: submissionHash,
        resume_bucket: resume ? RESUME_BUCKET : null, resume_path: resumePath,
        intake_status: resume ? "pending_resume" : "complete",
      }),
    });
  let records = await response.json() as StoredApplication[];
  if (!records.length) {
    const existing = await storageRequest(config,
      `/rest/v1/applications?submission_hash=eq.${submissionHash}&select=${RECEIPT_COLUMNS}`);
    records = await existing.json() as StoredApplication[];
  }
  const record = records[0];
  if (!record?.id) throw new Error("Application record was not returned");

  if (record.intake_status === "pending_resume") {
    if (!bytes || !contentType || !resumePath) throw new Error("Missing résumé for pending application");
    await storageRequest(config, `/storage/v1/object/${RESUME_BUCKET}/${resumePath}`, {
      method: "POST", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: bytes,
    });
    await storageRequest(config, `/rest/v1/applications?id=eq.${encodeURIComponent(record.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_status: "complete", updated_at: new Date().toISOString() }),
    });
    record.intake_status = "complete";
  }
  return record;
}

export async function recordApplicationEmail(config: StorageConfig, applicationId: string, emailId: string | null) {
  try {
    const now = new Date().toISOString();
    // A failed concurrent attempt must not downgrade an already-sent receipt.
    await storageRequest(config, `/rest/v1/applications?id=eq.${encodeURIComponent(applicationId)}${emailId ? "" : "&confirmation_email_status=neq.sent"}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation_email_status: emailId ? "sent" : "failed",
        confirmation_email_id: emailId, confirmation_email_sent_at: emailId ? now : null,
        updated_at: now,
      }),
    });
  } catch {
    // Collection has succeeded; a receipt tracking failure must not ask for a duplicate application.
    console.error("Could not update application email status", { applicationId });
  }
}
