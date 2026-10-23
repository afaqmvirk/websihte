import { getPortalMember } from "@/lib/portal-auth";
import { cancelMemberRsvp } from "@/lib/portal-storage";
import { isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
import { sendRsvpEmail } from "@/lib/portal-rsvp-email";

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: PORTAL_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ message: "Please send this form from the portal." }, 403);
  if (Number(request.headers.get("content-length")) > 16_384) return json({ message: "This request is too large." }, 413);
  try {
    const member = await getPortalMember();
    if (!member) return json({ message: "Please sign in with an accepted application to cancel your RSVP." }, 401);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ message: "We couldn't read your request. Please try again." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || (body as Record<string, unknown>).confirmed !== true) {
      return json({ message: "Please confirm that you want to cancel your RSVP." }, 400);
    }
    const rsvp = await cancelMemberRsvp(member);
    if (!rsvp) return json({ message: "There is no RSVP to cancel. Please refresh your dashboard." }, 409);
    const emailSent = await sendRsvpEmail(member,rsvp);
    return json({ rsvp, emailSent, message: emailSent ? "Your RSVP is cancelled. A confirmation email has been sent; you're no longer marked as attending." : "Your RSVP is cancelled. We couldn't send the confirmation email, but you're no longer marked as attending." });
  } catch {
    return json({ message: "We couldn't cancel your RSVP. Please try again." }, 502);
  }
}
