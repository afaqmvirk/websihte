import { PortalRequestError } from "./portal-storage";
export async function readPortalJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PortalRequestError("Please complete the form.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new PortalRequestError("This request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>; }
  catch { throw new PortalRequestError("We couldn't read this form. Please try again.", 400); }
}
