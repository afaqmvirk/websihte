import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as signIn } from "../api/portal/sign-in/route";
import { POST as signOut } from "../api/portal/sign-out/route";
import { POST as verifyCode } from "../api/portal/verify-code/route";
import { proxy } from "../../proxy";
import { createPortalEmail } from "./portal-email";
import { findAcceptedMember, saveMemberRsvp } from "./portal-storage";
import { getPortalUrl, isSameOriginRequest, parseRsvp, TRAVEL_PLAN_LIMIT } from "./portal";

const originalFetch = globalThis.fetch;
const names = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY", "APPLICATION_EMAIL_API_KEY", "APPLICATION_EMAIL_FROM", "APPLICATION_EMAIL_TO", "APPLICATION_EMAIL_REPLY_TO", "PORTAL_URL", "VERCEL"] as const;
const originalEnv = Object.fromEntries(names.map((key) => [key, process.env[key]]));
let calls: { url: URL; body: Record<string, unknown> | null }[];
let admission: string | null;
let claim: boolean;
let validCode: boolean;
let confirmedEmail: boolean;
const memberId = "99999999-9999-4999-8999-999999999991";

beforeEach(() => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://portal-test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_portal_test",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_portal_test", APPLICATION_EMAIL_API_KEY: "re_portal_test",
    APPLICATION_EMAIL_FROM: "applications@stupideas.com", APPLICATION_EMAIL_TO: "organizer@example.com",
    APPLICATION_EMAIL_REPLY_TO: "applications@stupideas.com", PORTAL_URL: "https://my.stupideas.com",
  });
  delete process.env.VERCEL;
  calls = []; admission = "accepted"; claim = true; validCode = true; confirmedEmail = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.pathname === "/rest/v1/rpc/claim_portal_sign_in") return Response.json(claim);
    if (url.pathname === "/rest/v1/rpc/claim_portal_code_verification") return Response.json(claim);
    if (url.pathname === "/rest/v1/applications") return Response.json(admission ? [{
      id: memberId, full_name: "Test Human", email: "accepted@example.com", admission_status: admission,
    }] : []);
    if (url.pathname === "/auth/v1/admin/generate_link") return Response.json({
      id: "auth-user", email: "accepted@example.com", action_link: "https://unused.invalid",
      hashed_token: "a".repeat(64), verification_type: "magiclink", email_otp: "123456", redirect_to: "https://unused.invalid",
    });
    if (url.origin === "https://api.resend.com") return Response.json({ id: "email-test" });
    if (url.pathname === "/auth/v1/verify") {
      if (!validCode) return Response.json({ error_code: "otp_expired", msg: "Invalid token" }, { status: 403 });
      return Response.json({
        access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600,
        user: { id: "auth-user", email: "accepted@example.com", email_confirmed_at: confirmedEmail ? "2026-10-22T00:00:00Z" : null },
      });
    }
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/rpc/save_member_rsvp") return Response.json([{
      is_local: body.p_is_local, travel_plan: body.p_travel_plan, updated_at: "2026-10-18T18:00:00Z",
    }]);
    throw new Error(`Unexpected request: ${url.origin}${url.pathname}`);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  names.forEach((name) => {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  });
});

function request(body: unknown, origin = "https://my.stupideas.com") {
  return new Request("https://my.stupideas.com/api/portal/sign-in", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function codeRequest(body: unknown, origin = "https://my.stupideas.com") {
  return new NextRequest("https://my.stupideas.com/api/portal/verify-code", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

test("RSVP requires an explicit boolean and a non-empty travel plan for visitors", () => {
  assert.equal(parseRsvp({}), null);
  assert.equal(parseRsvp({ isLocal: "false", travelPlan: "train" }), null);
  assert.equal(parseRsvp({ isLocal: false, travelPlan: "  " }), null);
  assert.equal(parseRsvp({ isLocal: false, travelPlan: "a".repeat(TRAVEL_PLAN_LIMIT + 1) }), null);
  assert.deepEqual(parseRsvp({ isLocal: false, travelPlan: "  train from Toronto  " }), { isLocal: false, travelPlan: "train from Toronto" });
});

test("switching to local clears stored travel details and ignores caller identity fields", () => {
  assert.deepEqual(parseRsvp({ isLocal: true, travelPlan: "old plan", applicationId: "someone-else", email: "someone@example.com" }), { isLocal: true, travelPlan: null });
});

test("member lookup uses only the latest complete Ottawa application and returns no private answers", async () => {
  const member = await findAcceptedMember(" ACCEPTED@EXAMPLE.COM ");
  assert.deepEqual(member, { id: memberId, full_name: "Test Human", email: "accepted@example.com" });
  assert.equal(calls[0].url.searchParams.get("email"), "eq.accepted@example.com");
  assert.equal(calls[0].url.searchParams.get("intake_status"), "eq.complete");
  assert.equal(calls[0].url.searchParams.get("event_slug"), "eq.ottawa-2026");
  assert.equal(calls[0].url.searchParams.get("order"), "created_at.desc,id.desc");
  assert.equal(calls[0].url.searchParams.get("limit"), "1");
});

test("pending, waitlisted, rejected, and unknown applicants have no member access", async () => {
  for (const status of ["pending", "waitlisted", "rejected", null]) {
    admission = status;
    assert.equal(await findAcceptedMember("accepted@example.com"), null);
  }
});

test("RSVP storage sends verified member identity to the acceptance-checking RPC", async () => {
  const rsvp = await saveMemberRsvp({ id: memberId, email: "accepted@example.com", full_name: "Test Human" }, false, "train");
  assert.equal(rsvp.travel_plan, "train");
  assert.deepEqual(calls[0].body, { p_application_id: memberId, p_email: "accepted@example.com", p_is_local: false, p_travel_plan: "train" });
});

test("sign-in rejects cross-origin and invalid requests before calling any backend", async () => {
  assert.equal((await signIn(request({ email: "accepted@example.com" }, "https://evil.example"))).status, 403);
  assert.equal((await signIn(request({ email: "not an email" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("sign-in creates no link or account for unaccepted applicants and uses a generic response", async () => {
  admission = "pending";
  const pending = await signIn(request({ email: "pending@example.com" }));
  admission = null;
  const unknown = await signIn(request({ email: "unknown@example.com" }));
  assert.equal(pending.status, 200);
  assert.deepEqual(await pending.json(), await unknown.json());
  assert.equal(calls.some(({ url }) => url.pathname.includes("generate_link") || url.origin === "https://api.resend.com"), false);
});

test("accepted sign-in emails both a one-time link and code only to that applicant, without leaking credentials in the response", async () => {
  const response = await signIn(request({ email: " ACCEPTED@EXAMPLE.COM " }));
  assert.equal(response.status, 200);
  const message = await response.text();
  assert.equal(message.includes("a".repeat(64)), false);
  assert.equal(message.includes("123456"), false);
  const email = calls.find(({ url }) => url.origin === "https://api.resend.com")?.body;
  assert.ok(email);
  assert.deepEqual(email.to, ["accepted@example.com"]);
  assert.equal(email.bcc, undefined);
  assert.equal(email.cc, undefined);
  assert.ok(String(email.text).includes("https://my.stupideas.com/confirm?token_hash="));
  assert.ok(String(email.html).includes("https://my.stupideas.com/confirm?token_hash="));
  assert.ok(String(email.text).includes("123456"));
  assert.ok(String(email.html).includes("123456"));
  const limiter = calls.find(({ url }) => url.pathname.includes("claim_portal_sign_in"))!;
  assert.match(String(limiter.body?.p_email_hash), /^[a-f0-9]{64}$/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("rate-limited sign-in does not generate or send another link", async () => {
  claim = false;
  assert.equal((await signIn(request({ email: "accepted@example.com" }))).status, 200);
  assert.equal(calls.length, 1);
});

test("missing Auth configuration fails closed", async () => {
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  assert.equal((await signIn(request({ email: "accepted@example.com" }))).status, 503);
  assert.equal(calls.length, 0);
});

test("code entry rejects cross-origin, invalid email, and malformed code before contacting any backend", async () => {
  assert.equal((await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456" }, "https://evil.example"))).status, 403);
  for (const code of [123456, "12345", "abcdef", "12345678901", null]) {
    assert.equal((await verifyCode(codeRequest({ email: "accepted@example.com", code }))).status, 400);
  }
  assert.equal((await verifyCode(codeRequest({ email: "invalid", code: "123456" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("accepted code entry verifies the email OTP, preserves leading zeroes, and sets an HttpOnly session", async () => {
  const response = await verifyCode(codeRequest({ email: " ACCEPTED@EXAMPLE.COM ", code: "001 234" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { destination: "https://my.stupideas.com/" });
  const verification = calls.find(({ url }) => url.pathname === "/auth/v1/verify")?.body;
  assert.deepEqual({ email: verification?.email, token: verification?.token, type: verification?.type }, {
    email: "accepted@example.com", token: "001234", type: "email",
  });
  assert.match(response.headers.get("cache-control") || "", /private/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.ok(response.headers.getSetCookie().some(cookie => cookie.startsWith("sih-portal-auth=") && cookie.includes("HttpOnly")));
  const limiter = calls.find(({ url }) => url.pathname.includes("claim_portal_code_verification"))!;
  assert.match(String(limiter.body?.p_email_hash), /^[a-f0-9]{64}$/);
  assert.match(String(limiter.body?.p_ip_hash), /^[a-f0-9]{64}$/);
});

test("wrong and expired codes cannot establish a session", async () => {
  validCode = false;
  const response = await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456" }));
  assert.equal(response.status, 401);
  assert.deepEqual(response.headers.getSetCookie(), []);
  assert.equal(calls.some(({ url }) => url.pathname === "/rest/v1/applications"), false);
});

test("code entry requires a confirmed email and current acceptance, with no session cookies on rejection", async () => {
  confirmedEmail = false;
  assert.equal((await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456" }))).status, 401);
  confirmedEmail = true;
  for (const status of ["pending", "waitlisted", "rejected", null]) {
    admission = status;
    const response = await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456", admission_status: "accepted" }));
    assert.equal(response.status, 401);
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
});

test("shared code retry limits reject attempts before verification, independently of email sending", async () => {
  claim = false;
  const response = await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/rest/v1/rpc/claim_portal_code_verification");
  assert.deepEqual(response.headers.getSetCookie(), []);
});

test("code entry fails closed when Auth configuration is unavailable", async () => {
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  assert.equal((await verifyCode(codeRequest({ email: "accepted@example.com", code: "123456" }))).status, 503);
  assert.equal(calls.length, 0);
});

test("sign-out clears every session cookie chunk using its actual name", async () => {
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  const response = await signOut(new NextRequest("https://my.stupideas.com/api/portal/sign-out", {
    method: "POST", headers: {
      origin: "https://my.stupideas.com",
      cookie: "sih-portal-auth.0=first; sih-portal-auth.1=second; unrelated=keep",
    },
  }));
  assert.equal(response.status, 303);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some((value) => value.startsWith("sih-portal-auth.0=;") && value.includes("Max-Age=0")));
  assert.ok(cookies.some((value) => value.startsWith("sih-portal-auth.1=;") && value.includes("HttpOnly")));
  assert.equal(cookies.some((value) => value.startsWith("unrelated=")), false);
});

test("configured URL controls emailed links and rejects credentials or arbitrary paths", () => {
  assert.equal(getPortalUrl("/confirm").toString(), "https://my.stupideas.com/confirm");
  process.env.PORTAL_URL = "https://preview.example.com/portal";
  assert.equal(getPortalUrl("/confirm").toString(), "https://preview.example.com/portal/confirm");
  process.env.PORTAL_URL = "https://user:password@example.com";
  assert.throws(() => getPortalUrl());
  process.env.PORTAL_URL = "https://example.com/unexpected";
  assert.throws(() => getPortalUrl());
});

test("origin checks reject missing Origin headers and external origins", () => {
  assert.equal(isSameOriginRequest(new Request("https://my.stupideas.com/api/portal/rsvp")), false);
  assert.equal(isSameOriginRequest(request({}, "https://evil.example")), false);
  assert.equal(isSameOriginRequest(request({})), true);
});

test("subdomain root rewrites to the portal while the public homepage stays intact", async () => {
  const portal = await proxy(new NextRequest("https://my.stupideas.com/", { headers: { host: "my.stupideas.com" } }));
  assert.equal(new URL(portal.headers.get("x-middleware-rewrite")!).pathname, "/portal");
  assert.equal(portal.headers.get("x-robots-tag"), "noindex, nofollow");
  const publicSite = await proxy(new NextRequest("https://www.stupideas.com/", { headers: { host: "www.stupideas.com" } }));
  assert.equal(publicSite.headers.get("x-middleware-rewrite"), null);
  const confirm = await proxy(new NextRequest(`https://my.stupideas.com/confirm?token_hash=${"a".repeat(64)}`, { headers: { host: "my.stupideas.com" } }));
  assert.equal(new URL(confirm.headers.get("x-middleware-rewrite")!).pathname, "/portal/confirm");
  assert.equal(confirm.headers.get("referrer-policy"), "strict-origin");
});

test("sign-in email escapes HTML and never includes an organizer copy", () => {
  const email = createPortalEmail("accepted@example.com", "https://my.stupideas.com/confirm?token_hash=test&type=magiclink", "001234");
  assert.ok(email.html.includes("&amp;type=magiclink"));
  assert.ok(email.text.includes("001234"));
  assert.ok(email.html.includes("001234"));
  assert.equal("bcc" in email, false);
});
