import { getApplicationEmailConfig, isValidEmail } from "@/lib/application-email";
import { createPortalAdmin, getPortalAuthConfig } from "@/lib/portal-auth";
import { sendPortalEmail } from "@/lib/portal-email";
import { claimPortalSignIn, findAcceptedMember } from "@/lib/portal-storage";
import { getPortalUrl, isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

const GENERIC_MESSAGE = "If this email belongs to an accepted applicant, a sign-in link is on its way. Check your spam folder too.";
const json = (message: string, status = 200) => Response.json({ message }, { status, headers: PORTAL_RESPONSE_HEADERS });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json("Please send this form from the portal.", 403);
  if (Number(request.headers.get("content-length")) > 4096) return json("This request is too large.", 413);
  let email: string;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch { return json("Please enter a valid email address.", 400); }
  if (!isValidEmail(email)) return json("Please enter a valid email address.", 400);
  if (!getPortalAuthConfig() || !getApplicationEmailConfig()) return json("Sign-in is temporarily unavailable. Please try again later.", 503);
  try {
    // Vercel overwrites x-vercel-forwarded-for. A shared fallback is deliberately
    // conservative outside Vercel; arbitrary client headers cannot bypass it.
    const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") || "unknown" : "local";
    if (!await claimPortalSignIn(email, ip)) return json(GENERIC_MESSAGE);
    const member = await findAcceptedMember(email);
    if (!member) return json(GENERIC_MESSAGE);
    const { data, error } = await createPortalAdmin().auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties) throw new Error("Could not generate sign-in link");
    const link = getPortalUrl("/confirm");
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", data.properties.verification_type);
    await sendPortalEmail(email, link.toString());
    return json(GENERIC_MESSAGE);
  } catch {
    return json("We couldn't send your sign-in link. Please try again in a minute.", 502);
  }
}
