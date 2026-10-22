import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPortalAuthConfig, portalCookieOptions } from "@/lib/portal-auth";
import { getPortalUrl, isSameOriginRequest, PORTAL_COOKIE, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(getPortalUrl(), { status: 303, headers: PORTAL_RESPONSE_HEADERS });
  const config = getPortalAuthConfig();
  if (config) {
    const client = createServerClient(config.url, config.publishableKey, {
      cookieOptions: portalCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) { values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
      },
    });
    await client.auth.signOut({ scope: "local" });
  }
  // Also clear a corrupt or expired cookie when Auth cannot revoke the session.
  request.cookies.getAll().filter(({ name }) => name.startsWith(PORTAL_COOKIE))
    .forEach(({ name }) => response.cookies.set({ ...portalCookieOptions, name, value: "", maxAge: 0 }));
  return response;
}
