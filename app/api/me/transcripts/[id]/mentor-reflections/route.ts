import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscript, updateJournalMentorReflections } from "@/lib/db";
import { runJournalMentorReflections } from "@/lib/journal-mentor-reflections";
import { recordMongoUsageRequest } from "@/lib/usage";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  const { id } = await params;
  try {
    const transcript = await getSavedTranscript(id, userId);
    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }
    if (transcript.sourceType !== "journal") {
      return NextResponse.json({ error: "Not a journal entry" }, { status: 400 });
    }

    const ok = await updateJournalMentorReflections(id, userId, { status: "pending" });
    if (!ok) {
      return NextResponse.json({ error: "Failed to update transcript" }, { status: 500 });
    }

    void runJournalMentorReflections(id, userId).catch((e) =>
      console.error("Journal mentor reflections regenerate failed:", e)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("mentor-reflections POST error:", err);
    return NextResponse.json({ error: "Failed to start regeneration" }, { status: 500 });
  }
}
