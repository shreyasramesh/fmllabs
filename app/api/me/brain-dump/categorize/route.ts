import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { categorizeBrainDump } from "@/lib/gemini";

const MAX_TRANSCRIPT_LENGTH = 20_000;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Transcript text is required" }, { status: 400 });
    }
    if (text.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: `Transcript must be at most ${MAX_TRANSCRIPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const result = await categorizeBrainDump(text, {
      userId,
      eventType: "brain_dump_categorize",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Brain dump categorize failed:", err);
    return NextResponse.json({ error: "Categorization failed" }, { status: 500 });
  }
}
