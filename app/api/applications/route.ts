const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function getSubmissionEndpoint() {
  const configuredEndpoint = process.env.APPLICATION_SUBMISSION_URL;
  if (!configuredEndpoint) return null;

  try {
    const endpoint = new URL(configuredEndpoint);
    if (endpoint.protocol !== "https:") return null;
    return endpoint;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const endpoint = getSubmissionEndpoint();

  if (!endpoint) {
    return Response.json(
      {
        message:
          "Applications are temporarily unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { message: "We could not read this submission." },
      { status: 400 },
    );
  }

  for (const value of formData.values()) {
    if (value instanceof File && value.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { message: "Each uploaded file must be 10 MB or smaller." },
        { status: 413 },
      );
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          message:
            "We could not submit your application. Please check your answers and try again.",
        },
        { status: 502 },
      );
    }

    return Response.json({ message: "Application received. See you soon." });
  } catch {
    return Response.json(
      {
        message:
          "We could not submit your application. Please try again in a moment.",
      },
      { status: 502 },
    );
  }
}
