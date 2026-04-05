import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  saveJournalTranscript,
  createCustomConcept,
  createHabit,
  addWeightEntry,
  addSleepEntry,
} from "@/lib/db";
import type { BrainDumpCategory } from "@/lib/gemini";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const VALID_CATEGORIES: BrainDumpCategory[] = [
  "reflection", "concept", "experiment", "nutrition", "exercise", "weight", "sleep",
];

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({}));
    const category = body.category as BrainDumpCategory | undefined;
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const entryDate = resolveJournalEntryDateParts({});

    if (category === "reflection") {
      const text = typeof body.reflectionText === "string" ? body.reflectionText.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "Reflection text is required" }, { status: 400 });
      }
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

    if (category === "nutrition") {
      const text = typeof body.nutritionText === "string" ? body.nutritionText.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "Nutrition description is required" }, { status: 400 });
      }
      const saved = await saveJournalTranscript(userId, text, title, entryDate, {
        journalCategory: "nutrition",
      });
      return NextResponse.json({ id: saved._id, category });
    }

    if (category === "exercise") {
      const text = typeof body.exerciseText === "string" ? body.exerciseText.trim() : "";
      if (!text) {
        return NextResponse.json({ error: "Exercise description is required" }, { status: 400 });
      }
      const saved = await saveJournalTranscript(userId, text, title, entryDate, {
        journalCategory: "exercise",
      });
      return NextResponse.json({ id: saved._id, category });
    }

    if (category === "weight") {
      const weightKg =
        typeof body.weightKg === "number" && Number.isFinite(body.weightKg)
          ? Math.round(body.weightKg * 10) / 10
          : null;
      if (weightKg == null || weightKg < 20 || weightKg > 400) {
        return NextResponse.json({ error: "Valid weight in kg is required" }, { status: 400 });
      }
      const saved = await addWeightEntry(userId, weightKg);
      return NextResponse.json({ id: saved._id, category });
    }

    if (category === "sleep") {
      const sleepHours =
        typeof body.sleepHours === "number" && Number.isFinite(body.sleepHours)
          ? Math.round(body.sleepHours * 10) / 10
          : null;
      if (sleepHours == null || sleepHours < 0 || sleepHours > 24) {
        return NextResponse.json({ error: "Valid sleep hours required" }, { status: 400 });
      }
      const hrvMs =
        typeof body.hrvMs === "number" && Number.isFinite(body.hrvMs)
          ? Math.round(body.hrvMs)
          : null;
      const saved = await addSleepEntry(userId, {
        sleepHours,
        hrvMs,
        entryDay: entryDate.day,
        entryMonth: entryDate.month,
        entryYear: entryDate.year,
      });
      return NextResponse.json({ id: saved._id, category });
    }

    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  } catch (err) {
    console.error("Brain dump save failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
