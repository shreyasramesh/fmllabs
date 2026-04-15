import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSavedTranscripts,
  getSavedTranscriptsPage,
  DEFAULT_TRANSCRIPT_PAGE_SIZE,
  decodeTranscriptPaginationCursor,
} from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";
import { perfAsync } from "@/lib/perf-timing";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const url = new URL(request.url);
    const sourceTypeParam = url.searchParams.get("sourceType");
    const slim = url.searchParams.get("slim") === "1";
    const sourceType =
      sourceTypeParam === "journal" ? "journal" :
      sourceTypeParam === "youtube" ? "youtube" :
      undefined;
    const fullList = url.searchParams.get("full") === "1";
    const cursorParam = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    const limit =
      limitRaw != null && limitRaw !== ""
        ? Math.min(500, Math.max(1, parseInt(limitRaw, 10) || DEFAULT_TRANSCRIPT_PAGE_SIZE))
        : DEFAULT_TRANSCRIPT_PAGE_SIZE;

    if (fullList) {
      const transcripts = await perfAsync("GET /api/me/transcripts", "getSavedTranscripts(full)", () =>
        getSavedTranscripts(userId, { sourceType, slim })
      );
      return NextResponse.json(transcripts);
    }

    const beforeCursor = cursorParam ? decodeTranscriptPaginationCursor(cursorParam) : null;
    if (cursorParam && !beforeCursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    const page = await perfAsync("GET /api/me/transcripts", "getSavedTranscriptsPage", () =>
      getSavedTranscriptsPage(userId, {
        sourceType,
        slim,
        limit,
        beforeCursor: beforeCursor ?? undefined,
      })
    );
    return NextResponse.json({
      transcripts: page.transcripts,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  } catch (err) {
    console.error("Failed to fetch transcripts:", err);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }
}
