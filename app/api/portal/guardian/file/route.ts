import { getPortalMember } from "@/lib/portal-auth";
import { readOwnGuardianForm } from "@/lib/guardian-upload";
import { PortalRequestError } from "@/lib/portal-storage";
import { PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
export async function GET() {
  try {
    const member = await getPortalMember();
    if (!member) return Response.json({ message: "Please sign in." }, { status: 401, headers: PORTAL_RESPONSE_HEADERS });
    return await readOwnGuardianForm(member);
  } catch (error) {
    return Response.json({ message: error instanceof PortalRequestError ? error.message : "Could not load your form." }, { status: error instanceof PortalRequestError ? error.status : 502, headers: PORTAL_RESPONSE_HEADERS });
  }
}
