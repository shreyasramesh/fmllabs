import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateConceptsFromLongText } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import {
  getSavedTranscript,
  saveJournalTranscript,
  updateTranscriptExtractedConcepts,
} from "@/lib/db";
import { recordMongoUsageRequest } from "@/lib/usage";

const MAX_JOURNAL_CHARS = 50_000;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = await request.json().catch(() => ({}));
    const transcriptId =
      typeof body.transcriptId === "string" ? body.transcriptId.trim() : null;

    let text: string;
    let journalTitleFromSaved: string | undefined;

    if (transcriptId) {
      const saved = await getSavedTranscript(transcriptId, userId);
      if (!saved) {
        return NextResponse.json({ error: "Journal not found" }, { status: 404 });
      }
      if (saved.sourceType !== "journal") {
        return NextResponse.json(
          { error: "Not a saved journal entry" },
          { status: 400 }
        );
      }
      text = saved.transcriptText.trim();
      journalTitleFromSaved = saved.videoTitle ?? undefined;
      if (!text) {
        return NextResponse.json({ error: "Journal text is empty" }, { status: 400 });
      }
    } else {
      const rawText = typeof body.text === "string" ? body.text : "";
      text = rawText.trim();
      if (!text) {
        return NextResponse.json({ error: "Journal text is required" }, { status: 400 });
      }
    }

    if (text.length > MAX_JOURNAL_CHARS) {
      return NextResponse.json(
        { error: `Journal text must be at most ${MAX_JOURNAL_CHARS} characters` },
        { status: 400 }
      );
    }

    const journalTitle =
      (typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : undefined) ?? journalTitleFromSaved;
    const extractPrompt =
      typeof body.extractPrompt === "string" ? body.extractPrompt.trim() : undefined;
    const persist = body.persist === true;
    const languageCode =
      typeof body.language === "string" && isValidLanguageCode(body.language)
        ? body.language
        : "en";
    const languageName = getLanguageName(languageCode);

    let savedTranscriptId: string | null = transcriptId;
    if (persist && !transcriptId) {
      const saved = await saveJournalTranscript(userId, text, journalTitle);
      savedTranscriptId = saved._id!;
    }

    const { groups } = await generateConceptsFromLongText(text, {
      source: "journal",
      displayTitle: journalTitle,
      languageName,
      extractPrompt,
      usageContext: { userId, eventType: "from_journal" },
    });

    if (savedTranscriptId) {
      await updateTranscriptExtractedConcepts(savedTranscriptId, userId, groups);
    }

    return NextResponse.json({
      source: "journal",
      journalTitle: journalTitle ?? null,
      journalTranscriptId: savedTranscriptId,
      groups,
    });
  } catch (err) {
    console.error("Failed to extract concepts from journal:", err);
    return NextResponse.json(
      { error: "Failed to extract concepts from journal" },
      { status: 500 }
    );
  }
}
