import { getPortalMember } from "@/lib/portal-auth";
import { saveMemberRsvp } from "@/lib/portal-storage";
import { isSameOriginRequest, parseRsvp, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

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
    if (!answer) return json({ message: "Please say whether you're local to Ottawa and, if not, tell us how you intend to arrive (2,000 characters or fewer)." }, 400);
    const rsvp = await saveMemberRsvp(member, answer.isLocal, answer.travelPlan);
    return json({ rsvp, message: "RSVP saved. See you in Ottawa!" });
  } catch { return json({ message: "We couldn't save your RSVP. Your answers are still here; please try again." }, 502); }
}
