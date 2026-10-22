import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getApplicationStorageConfig } from "./application-storage";
import { PORTAL_COOKIE } from "./portal";
import { findAcceptedMember } from "./portal-storage";

export function getPortalAuthConfig() {
  const storage = getApplicationStorageConfig();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!storage || !publishableKey?.startsWith("sb_publishable_")) return null;
  return { ...storage, publishableKey };
}

export const portalCookieOptions = {
  name: PORTAL_COOKIE, httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", path: "/",
};

export async function createPortalClient() {
  const config = getPortalAuthConfig();
  if (!config) throw new Error("Portal authentication is not configured");
  const jar = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: portalCookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy handles refreshes.
        }
      },
    },
  });
}

export function createPortalAdmin() {
  const config = getApplicationStorageConfig();
  if (!config) throw new Error("Portal authentication is not configured");
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getPortalMember() {
  if (!getPortalAuthConfig()) return null;
  const client = await createPortalClient();
  // getUser validates the session with Auth. Client cookies and user_metadata
  // never grant admission; the current application decision is checked below.
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;
  return findAcceptedMember(user.email);
}
