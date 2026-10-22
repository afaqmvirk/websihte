import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isValidEmail } from "@/lib/application-email";
import { getPortalAuthConfig, portalCookieOptions } from "@/lib/portal-auth";
import { claimPortalCodeVerification, findAcceptedMember } from "@/lib/portal-storage";
import { getPortalUrl, isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

const INVALID_CODE = "Code unavailable. Check your code or request a new email.";
const json = (message: string, status: number) => NextResponse.json({ message }, {
  status, headers: { ...PORTAL_RESPONSE_HEADERS, ...(status === 429 ? { "Retry-After": "600" } : {}) },
});

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json("Please send this form from the portal.", 403);
  if (Number(request.headers.get("content-length")) > 4096) return json("This request is too large.", 413);
  let email: string;
  let code: string;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    code = typeof body?.code === "string" ? body.code.replace(/\s/g, "") : "";
  } catch { return json(INVALID_CODE, 400); }
  if (!isValidEmail(email) || !/^\d{6,10}$/.test(code)) return json(INVALID_CODE, 400);
  const config = getPortalAuthConfig();
  if (!config) return json("Sign-in is temporarily unavailable. Please try again later.", 503);
  try {
    const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") || "unknown" : "local";
    if (!await claimPortalCodeVerification(email, ip)) return json("Too many attempts. Try again in 10 minutes.", 429);
    // Only this response receives session cookies. Failed verification or an
    // unaccepted application returns a separate response without those cookies.
    const response = NextResponse.json({ destination: getPortalUrl().toString() }, { headers: PORTAL_RESPONSE_HEADERS });
    const client = createServerClient(config.url, config.publishableKey, {
      cookieOptions: portalCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
    if (error?.status === 429) return json("Too many attempts. Try again in 10 minutes.", 429);
    if (error || !data.user?.email || !data.user.email_confirmed_at) return json(INVALID_CODE, 401);
    if (!await findAcceptedMember(data.user.email)) {
      await client.auth.signOut({ scope: "local" });
      return json(INVALID_CODE, 401);
    }
    return response;
  } catch { return json("Sign-in is temporarily unavailable. Please try again.", 502); }
}
