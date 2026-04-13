import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscripts } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

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
    const transcripts = await getSavedTranscripts(userId, { sourceType, slim });
    return NextResponse.json(transcripts);
  } catch (err) {
    console.error("Failed to fetch transcripts:", err);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }
}
