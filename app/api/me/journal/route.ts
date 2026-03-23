import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveJournalTranscript } from "@/lib/db";
import { recordMongoUsageRequest } from "@/lib/usage";
import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = await request.json().catch(() => ({}));
    const rawText = typeof body.text === "string" ? body.text : "";
    const text = rawText.trim();
    if (!text) {
      return NextResponse.json({ error: "Journal text is required" }, { status: 400 });
    }
    if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Journal text must be at most ${EXTRACT_CONCEPTS_MAX_TOTAL_CHARS} characters` },
        { status: 400 }
      );
    }
    const title =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;

    const saved = await saveJournalTranscript(userId, text, title);
    return NextResponse.json({
      id: saved._id,
      videoTitle: saved.videoTitle ?? "Journal entry",
    });
  } catch (err) {
    console.error("Journal save error:", err);
    return NextResponse.json({ error: "Failed to save journal entry" }, { status: 500 });
  }
}
