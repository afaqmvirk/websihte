export const PORTAL_HOST = "my.stupideas.com";
export const PORTAL_COOKIE = "sih-portal-auth";
export const TRAVEL_PLAN_LIMIT = 2000;

export type PortalRsvp = {
  is_local: boolean;
  travel_plan: string | null;
  updated_at: string;
};

export type PortalMember = {
  id: string;
  full_name: string;
  email: string;
};

export function formatRsvpDeadline(deadline: string) {
  // Midnight closes the preceding day. Name that day so the cutoff is unambiguous.
  const lastDay = new Date(new Date(deadline).getTime() - 1);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric",
  }).format(lastDay);
  const zone = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", timeZoneName: "short",
  }).formatToParts(lastDay).find((part) => part.type === "timeZoneName")?.value;
  return `${date} (${zone}, Ottawa time)`;
}

export function isPortalHost(host: string) {
  return host.toLowerCase().split(":")[0] === PORTAL_HOST;
}

// PORTAL_URL may include /portal for local development and Vercel previews.
// Email destinations always come from configuration, never a request Host header.
export function getPortalUrl(path = "") {
  const url = new URL(process.env.PORTAL_URL || `https://${PORTAL_HOST}`);
  const local = process.env.NODE_ENV !== "production"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password
    || url.search || url.hash || !["/", "/portal", "/portal/"].includes(url.pathname)) {
    throw new Error("Invalid portal URL configuration");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}` || "/";
  return url;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin || origin === getPortalUrl().origin;
}

export function parseRsvp(value: unknown): { isLocal: boolean; travelPlan: string | null } | null {
  if (!value || typeof value !== "object") return null;
  const { isLocal, travelPlan } = value as Record<string, unknown>;
  if (typeof isLocal !== "boolean") return null;
  if (isLocal) return { isLocal: true, travelPlan: null };
  if (typeof travelPlan !== "string" || !travelPlan.trim() || travelPlan.length > TRAVEL_PLAN_LIMIT) return null;
  return { isLocal: false, travelPlan: travelPlan.trim() };
}

export const PORTAL_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  // Strip paths and token hashes while preserving Origin on HTML POST forms.
  "Referrer-Policy": "strict-origin",
  "X-Robots-Tag": "noindex, nofollow",
} as const;
