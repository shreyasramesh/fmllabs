import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveJournalTranscript, updateJournalMentorReflections } from "@/lib/db";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { inferJournalTitleFromContent } from "@/lib/journal-title";
import { runJournalMentorReflections } from "@/lib/journal-mentor-reflections";
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

    let entryDate: { day: number; month: number; year: number };
    try {
      const entryDateStr =
        typeof body.entryDate === "string" ? body.entryDate.trim() : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(entryDateStr)) {
        const [ys, ms, ds] = entryDateStr.split("-");
        entryDate = resolveJournalEntryDateParts({
          year: parseInt(ys, 10),
          month: parseInt(ms, 10),
          day: parseInt(ds, 10),
        });
      } else {
        entryDate = resolveJournalEntryDateParts({
          day: body.day,
          month: body.month,
          year: body.year,
        });
      }
    } catch {
      return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
    }

    let title: string;
    try {
      title = await inferJournalTitleFromContent(text, { userId });
    } catch (err) {
      console.error("Journal title inference failed:", err);
      title = "Journal entry";
    }

    const now = new Date();
    const saved = await saveJournalTranscript(userId, text, title, entryDate, {
      journalEntryTime: { hour: now.getHours(), minute: now.getMinutes() },
    });
    const transcriptId = saved._id;
    void updateJournalMentorReflections(transcriptId, userId, { status: "pending" }).then((ok) => {
      if (ok) {
        void runJournalMentorReflections(transcriptId, userId).catch((e) =>
          console.error("Journal mentor reflections failed:", e)
        );
      }
    });
    return NextResponse.json({
      id: transcriptId,
      videoTitle: saved.videoTitle ?? "Journal entry",
    });
  } catch (err) {
    console.error("Journal save error:", err);
    return NextResponse.json({ error: "Failed to save journal entry" }, { status: 500 });
  }
}
