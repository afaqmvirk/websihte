import { createHash } from "node:crypto";
import { getApplicationStorageConfig } from "./application-storage";
import { OTTAWA_EVENT } from "./ottawa-event";
import type { PortalMember, PortalRsvp } from "./portal";

// This module is used by server routes only. No private application data or key
// is sent to the browser; components import public types from portal.ts.
export async function portalStorageRequest(path: string, init: RequestInit = {}) {
  const config = getApplicationStorageConfig();
  if (!config) throw new Error("Portal storage is not configured");
  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Portal storage request failed");
  return response;
}

export async function findAcceptedMember(email: string): Promise<PortalMember | null> {
  const query = new URLSearchParams({
    select: "id,full_name,email,admission_status",
    email: `eq.${email.trim().toLowerCase()}`,
    event_slug: `eq.${OTTAWA_EVENT.slug}`, intake_status: "eq.complete",
    order: "created_at.desc,id.desc", limit: "1",
  });
  const response = await portalStorageRequest(`applications?${query}`);
  const [record] = await response.json() as (PortalMember & { admission_status: string })[];
  if (!record || record.admission_status !== "accepted") return null;
  return { id: record.id, full_name: record.full_name, email: record.email };
}

export async function getMemberRsvp(member: PortalMember): Promise<PortalRsvp | null> {
  const query = new URLSearchParams({
    select: "is_local,travel_plan,updated_at", application_id: `eq.${member.id}`, limit: "1",
  });
  const response = await portalStorageRequest(`member_rsvps?${query}`);
  return (await response.json() as PortalRsvp[])[0] || null;
}

export async function saveMemberRsvp(member: PortalMember, isLocal: boolean, travelPlan: string | null) {
  // The RPC rechecks acceptance under a row lock before writing. A browser can
  // never choose an application ID, email, or admission status.
  const response = await portalStorageRequest("rpc/save_member_rsvp", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_application_id: member.id, p_email: member.email,
      p_is_local: isLocal, p_travel_plan: travelPlan,
    }),
  });
  const [rsvp] = await response.json() as PortalRsvp[];
  if (!rsvp) throw new Error("RSVP was not returned");
  return rsvp;
}

export async function claimPortalSignIn(email: string, ip: string) {
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const response = await portalStorageRequest("rpc/claim_portal_sign_in", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_email_hash: hash(email), p_ip_hash: hash(ip) }),
  });
  return await response.json() === true;
}
