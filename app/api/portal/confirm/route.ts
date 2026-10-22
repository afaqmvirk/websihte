import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPortalAuthConfig, portalCookieOptions } from "@/lib/portal-auth";
import { findAcceptedMember } from "@/lib/portal-storage";
import { getPortalUrl, isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const destination = getPortalUrl();
  const failure = () => {
    const url = new URL(destination);
    url.searchParams.set("error", "link");
    return NextResponse.redirect(url, { status: 303, headers: PORTAL_RESPONSE_HEADERS });
  };
  const config = getPortalAuthConfig();
  if (!config) return failure();
  try {
    const form = await request.formData();
    const tokenHash = form.get("token_hash");
    const type = form.get("type");
    if (typeof tokenHash !== "string" || !/^[a-f0-9]{40,128}$/i.test(tokenHash)
      || (type !== "magiclink" && type !== "signup")) return failure();
    const response = NextResponse.redirect(destination, { status: 303, headers: PORTAL_RESPONSE_HEADERS });
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
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.user?.email || !data.user.email_confirmed_at) return failure();
    if (!await findAcceptedMember(data.user.email)) {
      await client.auth.signOut({ scope: "local" });
      return failure();
    }
    return response;
  } catch { return failure(); }
}
