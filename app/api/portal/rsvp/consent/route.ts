import { getPortalMember } from "@/lib/portal-auth";
import { isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
import { parseConsent } from "@/lib/participant-documents";
import { PortalRequestError, recordMemberConsent } from "@/lib/portal-storage";
import { readPortalJson } from "@/lib/portal-request";
import { rsvpConsentResponse } from "@/lib/rsvp-consent-response";

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: PORTAL_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ message: "Please send this form from the portal." }, 403);
  try {
    const member = await getPortalMember();
    if (!member) return json({ message: "Please sign in with an accepted application." }, 401);
    const consent = parseConsent(await readPortalJson(request));
    if (!consent) return json({ message: "Answer the age question, accept both required documents, and type your full legal name." }, 400);
    return json(await rsvpConsentResponse(member, await recordMemberConsent(member, consent)));
  } catch (error) {
    if (error instanceof PortalRequestError) return json({ message: error.message }, error.status);
    return json({ message: "We couldn't save your agreements. Please try again." }, 502);
  }
}
