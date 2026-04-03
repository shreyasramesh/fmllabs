import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  saveJournalTranscript,
  createCustomConcept,
  createHabit,
} from "@/lib/db";
import type { BrainDumpCategory } from "@/lib/gemini";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const category = body.category as BrainDumpCategory | undefined;
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!category || !["reflection", "concept", "experiment"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (category === "reflection") {
      const text = typeof body.reflectionText === "string" ? body.reflectionText.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "Reflection text is required" }, { status: 400 });
      }
      const entryDate = resolveJournalEntryDateParts({});
      const saved = await saveJournalTranscript(userId, text, title, entryDate);
      return NextResponse.json({ id: saved._id, category });
    }

    if (category === "concept") {
      const summary = typeof body.conceptSummary === "string" ? body.conceptSummary.trim() : "";
      const enrichmentPrompt =
        typeof body.conceptEnrichmentPrompt === "string" ? body.conceptEnrichmentPrompt.trim() : "";
      if (!summary || !enrichmentPrompt) {
        return NextResponse.json(
          { error: "Concept summary and enrichment prompt are required" },
          { status: 400 }
        );
      }
      const saved = await createCustomConcept(userId, title, summary, enrichmentPrompt);
      return NextResponse.json({ id: saved._id, category });
    }

    if (category === "experiment") {
      const description =
        typeof body.experimentDescription === "string" ? body.experimentDescription.trim() : "";
      const howToFollowThrough =
        typeof body.experimentHowTo === "string" ? body.experimentHowTo.trim() : "";
      const tips =
        typeof body.experimentTips === "string" ? body.experimentTips.trim() : "";
      if (!description || !howToFollowThrough || !tips) {
        return NextResponse.json(
          { error: "Experiment description, steps, and tips are required" },
          { status: 400 }
        );
      }
      const saved = await createHabit(userId, {
        sourceType: "manual",
        sourceId: "",
        bucket: "wellbeing",
        name: title,
        description,
        howToFollowThrough,
        tips,
      });
      return NextResponse.json({ id: saved._id, category });
    }

    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  } catch (err) {
    console.error("Brain dump save failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
