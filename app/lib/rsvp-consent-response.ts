import { getMemberRsvp } from "./portal-storage";
import { sendRsvpEmail } from "./portal-rsvp-email";
import type { PortalMember, PortalRsvp } from "./portal";

export async function rsvpConsentResponse(member: PortalMember, saved: PortalRsvp) {
  let rsvp = saved;
  try { rsvp = await getMemberRsvp(member) || saved; } catch { /* The transaction was saved; reload can refresh delivery status. */ }
  const emailSent = await sendRsvpEmail(member, rsvp);
  const parentMessage = rsvp.is_adult === false && !rsvp.guardian_completed_at
    ? " Download the parent/guardian form below, have your parent or legal guardian sign it, then upload the signed copy. Organizer approval is required before check-in."
    : "";
  return { rsvp, emailSent, message: (emailSent
    ? "RSVP and required agreements saved. A confirmation email has been sent."
    : "RSVP and required agreements saved, but we couldn't send the confirmation email. Your QR code is available in the portal.") + parentMessage };
}
