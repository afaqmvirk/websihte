import { getPortalMember } from "@/lib/portal-auth";
import { getMemberRsvp } from "@/lib/portal-storage";
import { rsvpQrPng } from "@/lib/portal-rsvp-email";
import { PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

export async function GET() {
  try {
    const member = await getPortalMember();
    if (!member) return new Response(null,{status:401,headers:PORTAL_RESPONSE_HEADERS});
    const rsvp = await getMemberRsvp(member);
    if (!rsvp || rsvp.cancelled_at || !rsvp.qr_token) return new Response(null,{status:404,headers:PORTAL_RESPONSE_HEADERS});
    const png = await rsvpQrPng(rsvp.qr_token);
    return new Response(Uint8Array.from(png),{headers:{...PORTAL_RESPONSE_HEADERS,"Content-Type":"image/png","X-Content-Type-Options":"nosniff"}});
  } catch { return new Response(null,{status:502,headers:PORTAL_RESPONSE_HEADERS}); }
}
