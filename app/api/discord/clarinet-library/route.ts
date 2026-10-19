import { searchClarinetLibrary, CLARINET_LIBRARY_COUNT, CLARINET_NAMED_FILES, CLARINET_TITLE_COUNT } from "@/lib/discord-bot-clarinet-library";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 200) return Response.json({ message: "Query is too long" }, { status: 400 });
  const counts = { indexedMidiFiles: CLARINET_LIBRARY_COUNT, namedMidiFiles: CLARINET_NAMED_FILES, titleLabels: CLARINET_TITLE_COUNT };
  try {
    const entries = query ? await searchClarinetLibrary(query) : [];
    return Response.json({ ...counts, query, entries, catalog: "/discord/squd/library.json" }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return Response.json({ ...counts, message: "Song catalog temporarily unavailable" }, { status: 503, headers: { "Retry-After": "60" } });
  }
}
