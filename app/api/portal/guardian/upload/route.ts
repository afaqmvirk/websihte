import { getPortalMember } from "@/lib/portal-auth";
import { isSameOriginRequest, PORTAL_RESPONSE_HEADERS } from "@/lib/portal";
import { PortalRequestError } from "@/lib/portal-storage";
import { uploadGuardianForm, GUARDIAN_UPLOAD_LIMIT } from "@/lib/guardian-upload";

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: PORTAL_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ message: "Upload this form from the portal." }, 403);
  try {
    const member = await getPortalMember();
    if (!member) return json({ message: "Please sign in with an accepted application." }, 401);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return json({ message: "Choose a signed form to upload." }, 415);
    // Count streamed bytes as well as the file size; a caller cannot bypass this with a false Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ message: "Choose a signed form to upload." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > GUARDIAN_UPLOAD_LIMIT + 32_000) { await reader.cancel(); return json({ message: "Choose a PDF, JPG or PNG up to 4 MB." }, 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) return json({ message: "Choose one signed PDF, JPG or PNG." }, 400);
    const rsvp = await uploadGuardianForm(member, file);
    return json({ rsvp, message: "Signed form uploaded. An organizer will review it before check-in." });
  } catch (error) {
    if (error instanceof PortalRequestError) return json({ message: error.message }, error.status);
    return json({ message: "We couldn't upload your form. Please try again." }, 502);
  }
}
