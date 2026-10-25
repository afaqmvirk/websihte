import { getPortalMember } from "@/lib/portal-auth";
import { getMemberRsvp, PortalRequestError, RsvpWindowError, saveMemberRsvp } from "@/lib/portal-storage";
import { isSameOriginRequest, parseRsvp, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
import { parseConsent } from "@/lib/participant-documents";
import { readPortalJson } from "@/lib/portal-request";
import { rsvpConsentResponse } from "@/lib/rsvp-consent-response";

export async function GET() {
  try {
    const member = await getPortalMember();
    if (!member) return Response.json({ message: "Please sign in." }, { status: 401, headers: PORTAL_RESPONSE_HEADERS });
    return Response.json({ rsvp: await getMemberRsvp(member) }, { headers: PORTAL_RESPONSE_HEADERS });
  }
  catch { return Response.json({ message: "Could not refresh your RSVP." }, { status: 502, headers: PORTAL_RESPONSE_HEADERS }); }
}

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: PORTAL_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ message: "Please send this form from the portal." }, 403);
  if (Number(request.headers.get("content-length")) > 16_384) return json({ message: "This request is too large." }, 413);
  try {
    const member = await getPortalMember();
    if (!member) return json({ message: "Please sign in with an accepted application to save your RSVP." }, 401);
    const body = await readPortalJson(request);
    const answer = parseRsvp(body);
    if (!answer) return json({ message: "Please say whether you're local to Ottawa and, if not, explain how you intend to arrive and where you plan to stay (2,000 characters or fewer)." }, 400);
    const consent = parseConsent(body);
    if (!consent) return json({ message: "Answer the age question, accept the Code of Conduct and liability waiver, and type your full legal name to sign." }, 400);
    const rsvp = await saveMemberRsvp(member, answer.isLocal, answer.travelPlan, consent);
    return json(await rsvpConsentResponse(member, rsvp));
  } catch (error) {
    if (error instanceof RsvpWindowError) return json({ message: error.message, reason: error.reason }, 409);
    if (error instanceof PortalRequestError) return json({ message: error.message }, error.status);
    return json({ message: "We couldn't save your RSVP. Your answers are still here; please try again." }, 502);
  }
}
