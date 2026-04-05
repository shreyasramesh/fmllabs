import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteCustomConceptsFromTranscript } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const transcriptId =
      typeof body.transcriptId === "string" ? body.transcriptId.trim() : "";
    if (!transcriptId) {
      return NextResponse.json(
        { error: "transcriptId is required" },
        { status: 400 }
      );
    }
    const result = await deleteCustomConceptsFromTranscript(userId, transcriptId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("delete-from-transcript:", err);
    return NextResponse.json(
      { error: "Failed to delete concepts" },
      { status: 500 }
    );
  }
}
