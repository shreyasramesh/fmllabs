import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { saveJournalTranscript } from "@/lib/db";
import {
  analyzeCalorieTrackingInput,
  finalizeCalorieTrackingEstimate,
} from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";
import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";

function normalizeDatePartsFromBody(body: Record<string, unknown>): {
  day: number;
  month: number;
  year: number;
} {
  const entryDateStr =
    typeof body.entryDate === "string" ? body.entryDate.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(entryDateStr)) {
    const [ys, ms, ds] = entryDateStr.split("-");
    return resolveJournalEntryDateParts({
      year: parseInt(ys, 10),
      month: parseInt(ms, 10),
      day: parseInt(ds, 10),
    });
  }
  return resolveJournalEntryDateParts({
    day: body.day,
    month: body.month,
    year: body.year,
  });
}

function formatNutritionJournalText(inputText: string, answers: string[], estimate: {
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  notes: string;
}, assumptions: string[]): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Nutrition)");
  lines.push("");
  lines.push("Original entry:");
  lines.push(inputText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
  lines.push("Estimated nutrition:");
  lines.push(`- Calories: ${estimate.calories ?? "unknown"} kcal`);
  lines.push(`- Protein: ${estimate.proteinGrams ?? "unknown"} g`);
  lines.push(`- Carbs: ${estimate.carbsGrams ?? "unknown"} g`);
  lines.push(`- Fat: ${estimate.fatGrams ?? "unknown"} g`);
  if (estimate.notes.trim()) lines.push(`- Notes: ${estimate.notes.trim()}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("Assumptions:");
    assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}

function formatExerciseJournalText(inputText: string, answers: string[], estimate: {
  caloriesBurned: number | null;
  notes: string;
}, assumptions: string[]): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Exercise)");
  lines.push("");
  lines.push("Original entry:");
  lines.push(inputText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
  lines.push("Estimated exercise burn:");
  lines.push(`- Calories burned: ${estimate.caloriesBurned ?? "unknown"} kcal`);
  if (estimate.notes.trim()) lines.push(`- Notes: ${estimate.notes.trim()}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("Assumptions:");
    assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const rawText = typeof body.text === "string" ? body.text : "";
    const text = rawText.trim();
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Text must be at most ${EXTRACT_CONCEPTS_MAX_TOTAL_CHARS} characters` },
        { status: 400 }
      );
    }

    if (action === "analyze") {
      const analysis = await analyzeCalorieTrackingInput(text, {
        userId,
        eventType: "calorie_journal_analyze",
      });
      return NextResponse.json(analysis);
    }

    if (action === "finalize") {
      const answers = Array.isArray(body.answers)
        ? body.answers
            .map((a) => (typeof a === "string" ? a.trim() : ""))
            .filter((a) => a.length > 0)
            .slice(0, 2)
        : [];
      let entryDate: { day: number; month: number; year: number };
      try {
        entryDate = normalizeDatePartsFromBody(body);
      } catch {
        return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
      }

      const estimate = await finalizeCalorieTrackingEstimate(text, answers, {
        userId,
        eventType: "calorie_journal_finalize",
      });
      const assumptions = estimate.assumptions.slice(0, 6);
      const batchId = `calorie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const savedRows: Array<{ id: string; category: "nutrition" | "exercise"; title: string }> = [];

      if (estimate.intent === "nutrition" || estimate.intent === "mixed") {
        const nutritionText = formatNutritionJournalText(
          text,
          answers,
          estimate.nutrition ?? {
            calories: null,
            proteinGrams: null,
            carbsGrams: null,
            fatGrams: null,
            notes: "",
          },
          assumptions
        );
        const saved = await saveJournalTranscript(
          userId,
          nutritionText,
          "Nutrition log",
          entryDate,
          { journalCategory: "nutrition", journalBatchId: batchId }
        );
        savedRows.push({
          id: saved._id,
          category: "nutrition",
          title: saved.videoTitle ?? "Nutrition log",
        });
      }

      if (estimate.intent === "exercise" || estimate.intent === "mixed") {
        const exerciseText = formatExerciseJournalText(
          text,
          answers,
          estimate.exercise ?? { caloriesBurned: null, notes: "" },
          assumptions
        );
        const saved = await saveJournalTranscript(
          userId,
          exerciseText,
          "Exercise log",
          entryDate,
          { journalCategory: "exercise", journalBatchId: batchId }
        );
        savedRows.push({
          id: saved._id,
          category: "exercise",
          title: saved.videoTitle ?? "Exercise log",
        });
      }

      return NextResponse.json({
        ...estimate,
        savedEntries: savedRows,
        journalBatchId: estimate.intent === "mixed" ? batchId : undefined,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Calorie journal error:", err);
    return NextResponse.json(
      { error: "Failed calorie journal request" },
      { status: 500 }
    );
  }
}

