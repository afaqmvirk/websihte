import { getPortalMember } from "@/lib/portal-auth";
import { RsvpWindowError, saveMemberRsvp } from "@/lib/portal-storage";
import { isSameOriginRequest, parseRsvp, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
import { sendRsvpEmail } from "@/lib/portal-rsvp-email";

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: PORTAL_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ message: "Please send this form from the portal." }, 403);
  if (Number(request.headers.get("content-length")) > 16_384) return json({ message: "This request is too large." }, 413);
  try {
    const member = await getPortalMember();
    if (!member) return json({ message: "Please sign in with an accepted application to save your RSVP." }, 401);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ message: "We couldn't read your RSVP. Please try again." }, 400); }
    const answer = parseRsvp(body);
    if (!answer) return json({ message: "Please say whether you're local to Ottawa and, if not, explain how you intend to arrive and where you plan to stay (2,000 characters or fewer)." }, 400);
    const rsvp = await saveMemberRsvp(member, answer.isLocal, answer.travelPlan);
    const emailSent = await sendRsvpEmail(member,rsvp);
    return json({ rsvp, emailSent, message: emailSent ? "RSVP saved. A confirmation email with your check-in QR code has been sent to your application email." : "RSVP saved, but we couldn't send the confirmation email. Your RSVP and check-in QR code are available here in the portal." });
  } catch (error) {
    if (error instanceof RsvpWindowError) return json({ message: error.message, reason: error.reason }, 409);
    return json({ message: "We couldn't save your RSVP. Your answers are still here; please try again." }, 502);
  }
}
