const RESEND_API_URL = "https://api.resend.com";

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_SEGMENT_ID;

  if (!apiKey || !segmentId) return null;
  return { apiKey, segmentId };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resendHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "sih-ottawa-waitlist/1.0",
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { message: "We could not read that email address." },
      { status: 400 },
    );
  }

  if (formData.get("website")) {
    return Response.json({ message: "You’re on the list. Talk soon." });
  }

  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (email.length > 320 || !isValidEmail(email)) {
    return Response.json(
      { message: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const config = getResendConfig();
  if (!config) {
    return Response.json(
      { message: "The mailing list is temporarily unavailable." },
      { status: 503 },
    );
  }

  const normalizedEmail = email.toLowerCase();
  const headers = resendHeaders(config.apiKey);

  try {
    const createResponse = await fetch(`${RESEND_API_URL}/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: normalizedEmail,
        unsubscribed: false,
        segments: [{ id: config.segmentId }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (createResponse.ok) {
      return Response.json({ message: "You’re on the list. Talk soon." });
    }

    if (createResponse.status === 409) {
      const contactId = encodeURIComponent(normalizedEmail);
      const segmentId = encodeURIComponent(config.segmentId);
      const segmentResponse = await fetch(
        `${RESEND_API_URL}/contacts/${contactId}/segments/${segmentId}`,
        {
          method: "POST",
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (segmentResponse.ok || segmentResponse.status === 409) {
        return Response.json({ message: "You’re already on the list." });
      }
    }

    return Response.json(
      { message: "We couldn’t add you right now. Please try again." },
      { status: 502 },
    );
  } catch {
    return Response.json(
      { message: "We couldn’t add you right now. Please try again." },
      { status: 502 },
    );
  }
}
