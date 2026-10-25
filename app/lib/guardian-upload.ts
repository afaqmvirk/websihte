import { createHash, randomUUID } from "node:crypto";
import { getApplicationStorageConfig } from "./application-storage";
import { hasParticipantConsent, type PortalMember } from "./portal";
import { getMemberRsvp, portalStorageRequest, PortalRequestError } from "./portal-storage";

export const GUARDIAN_UPLOAD_LIMIT = 4_000_000;
const BUCKET = "participant-consents";
export function guardianFileType(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", ext: "jpg" };
  return null;
}
async function storage(path: string, init: RequestInit = {}) {
  const config = getApplicationStorageConfig();
  if (!config) throw new Error("Storage unavailable");
  const headers = new Headers(init.headers); headers.set("apikey", config.key);
  const response = await fetch(`${config.url}/storage/v1/object/${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Could not access form storage");
  return response;
}
export async function uploadGuardianForm(member: PortalMember, file: File) {
  const rsvp = await getMemberRsvp(member);
  if (!rsvp || rsvp.cancelled_at || rsvp.is_adult !== false || !hasParticipantConsent(rsvp))
    throw new PortalRequestError("Save your RSVP and required participation forms with the under-18 answer first.", 409);
  if (!file.size || file.size > GUARDIAN_UPLOAD_LIMIT) throw new PortalRequestError("Choose a PDF, JPG or PNG up to 4 MB.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = guardianFileType(bytes);
  if (!kind) throw new PortalRequestError("Choose a PDF, JPG or PNG file.", 400);
  const filename = (file.name.split(/[\\/]/).pop() || "parent-form").replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 170);
  const path = `${member.id}/${randomUUID()}.${kind.ext}`;
  await storage(`${BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": kind.mime, "x-upsert": "false" }, body: bytes });
  try {
    await portalStorageRequest("rpc/record_guardian_upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      p_application_id: member.id, p_email: member.email, p_storage_path: path, p_filename: filename,
      p_content_type: kind.mime, p_size: bytes.length, p_digest: createHash("sha256").update(bytes).digest("hex"),
    }) });
  } catch (error) {
    await storage(BUCKET, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }) }).catch(() => {});
    throw error;
  }
  return getMemberRsvp(member);
}
export async function readOwnGuardianForm(member: PortalMember) {
  // Resolve ownership and the current file on the server; no path or ID is accepted from the browser.
  const response = await portalStorageRequest(`member_rsvps?${new URLSearchParams({ select: "guardian_upload_id", application_id: `eq.${member.id}`, limit: "1" })}`);
  const [rsvp] = await response.json() as { guardian_upload_id: string | null }[];
  if (!rsvp?.guardian_upload_id) throw new PortalRequestError("No parent/guardian form uploaded.", 404);
  const fileResponse = await portalStorageRequest(`member_guardian_uploads?${new URLSearchParams({ select: "storage_path,filename,content_type", id: `eq.${rsvp.guardian_upload_id}`, application_id: `eq.${member.id}`, limit: "1" })}`);
  const [file] = await fileResponse.json() as { storage_path: string; filename: string; content_type: string }[];
  if (!file || !file.storage_path.startsWith(`${member.id}/`) || file.storage_path.split("/").some(p => !p || p === ".." || p === ".")) throw new PortalRequestError("Form not found.", 404);
  const content = await storage(`${BUCKET}/${file.storage_path}`);
  return new Response(await content.arrayBuffer(), { headers: {
    "Content-Type": file.content_type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, "%27")}`,
    "Cache-Control": "private, no-store, max-age=0", "Content-Security-Policy": "sandbox; default-src 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  } });
}
