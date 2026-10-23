import { createHash } from "node:crypto";
import { getApplicationStorageConfig } from "./application-storage";
import { OTTAWA_EVENT } from "./ottawa-event";
import type { PortalMember, PortalRsvp } from "./portal";

export class RsvpWindowError extends Error {
  constructor(public readonly reason: "closed" | "pending") {
    super(reason === "closed"
      ? "The RSVP deadline has passed. Please contact applications@stupideas.com if you need help."
      : "RSVP opens once your acceptance email has been sent. Please check back soon.");
  }
}

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
  if (!response.ok) {
    if (path === "rpc/save_member_rsvp") {
      const error = await response.json().catch(() => null);
      if (error?.message === "member_rsvp_closed") throw new RsvpWindowError("closed");
      if (error?.message === "member_rsvp_not_open") throw new RsvpWindowError("pending");
    }
    throw new Error("Portal storage request failed");
  }
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
    select: "is_local,travel_plan,updated_at,cancelled_at", application_id: `eq.${member.id}`, limit: "1",
  });
  const response = await portalStorageRequest(`member_rsvps?${query}`);
  return (await response.json() as PortalRsvp[])[0] || null;
}

export async function getMemberRsvpWindow(member: PortalMember) {
  const response = await portalStorageRequest("rpc/member_rsvp_deadline", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_application_id: member.id }),
  });
  const deadline = await response.json() as string | null;
  return { deadline, closed: deadline !== null && Date.now() >= new Date(deadline).getTime() };
}

export async function saveMemberRsvp(member: PortalMember, isLocal: boolean, travelPlan: string | null) {
  // The RPC rechecks acceptance and the deadline under a row lock. A browser can
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
  // The existing save RPC keeps its return signature; a successful save always
  // clears cancellation, and still enforces the original RSVP deadline.
  return { ...rsvp, cancelled_at: null };
}

export async function cancelMemberRsvp(member: PortalMember): Promise<PortalRsvp | null> {
  const response = await portalStorageRequest("rpc/cancel_member_rsvp", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_application_id: member.id, p_email: member.email }),
  });
  const [rsvp] = await response.json() as PortalRsvp[];
  return rsvp || null;
}

export async function claimPortalSignIn(email: string, ip: string) {
  return claimPortalAttempt("claim_portal_sign_in", email, ip);
}

export async function claimPortalCodeVerification(email: string, ip: string) {
  return claimPortalAttempt("claim_portal_code_verification", email, ip);
}

async function claimPortalAttempt(rpc: string, email: string, ip: string) {
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const response = await portalStorageRequest(`rpc/${rpc}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_email_hash: hash(email), p_ip_hash: hash(ip) }),
  });
  return await response.json() === true;
}
