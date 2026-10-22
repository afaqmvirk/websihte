import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPortalAuthConfig, portalCookieOptions } from "./app/lib/portal-auth";
import { isPortalHost, PORTAL_COOKIE, PORTAL_RESPONSE_HEADERS } from "./app/lib/portal";

export async function proxy(request: NextRequest) {
  const portalHost = isPortalHost(request.headers.get("host") || request.nextUrl.host);
  const path = request.nextUrl.pathname;
  const root = portalHost && path === "/";
  const confirm = portalHost && path === "/confirm";
  const portal = root || confirm || path.startsWith("/portal") || path.startsWith("/api/portal");
  if (!portal && !portalHost) return NextResponse.next();
  if (portalHost && path === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
  }

  const destination = request.nextUrl.clone();
  if (root) destination.pathname = "/portal";
  if (confirm) destination.pathname = "/portal/confirm";
  const makeResponse = () => root || confirm
    ? NextResponse.rewrite(destination, { request }) : NextResponse.next({ request });
  let response = makeResponse();
  const config = getPortalAuthConfig();
  if (portal && config && request.cookies.getAll().some(({ name }) => name.startsWith(PORTAL_COOKIE))) {
    const client = createServerClient(config.url, config.publishableKey, {
      cookieOptions: portalCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    await client.auth.getClaims();
  }
  Object.entries(PORTAL_RESPONSE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
