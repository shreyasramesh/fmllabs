import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { saveJournalTranscript } from "@/lib/db";
import { inferJournalTitleFromContent } from "@/lib/journal-title";
import {
  analyzeCalorieTrackingInput,
  completeExerciseFuelEstimate,
  enrichCalorieTrackingEntries,
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

function formatNutritionJournalText(entryText: string, answers: string[], estimate: {
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  notes: string;
}, assumptions: string[]): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Nutrition)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(entryText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
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

function formatExerciseJournalText(entryText: string, answers: string[], estimate: {
  caloriesBurned: number | null;
  carbsUsedGrams?: number | null;
  fatUsedGrams?: number | null;
  proteinDeltaGrams?: number | null;
  notes: string;
}, assumptions: string[]): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Exercise)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(entryText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
  lines.push(`- Calories burned: ${estimate.caloriesBurned ?? "unknown"} kcal`);
  lines.push(`- Carbs used: ${estimate.carbsUsedGrams ?? "unknown"} g`);
  lines.push(`- Fat used: ${estimate.fatUsedGrams ?? "unknown"} g`);
  lines.push(`- Protein delta: ${estimate.proteinDeltaGrams ?? "unknown"} g`);
  if (estimate.notes.trim()) lines.push(`- Notes: ${estimate.notes.trim()}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("Assumptions:");
    assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}

function splitAssumptionsByType(
  assumptions: string[],
  nutritionEntryText: string,
  exerciseEntryText: string
): { nutritionAssumptions: string[]; exerciseAssumptions: string[] } {
  const nutritionKeywords = ["food", "ate", "meal", "drink", "snack", "yogurt", "protein", "carbs", "fat", "nutrition", "calories"];
  const exerciseKeywords = ["run", "walk", "pace", "mile", "km", "workout", "exercise", "burn", "calories burned", "mph", "minutes"];
  const nutritionText = nutritionEntryText.toLowerCase();
  const exerciseText = exerciseEntryText.toLowerCase();
  const nutritionAssumptions: string[] = [];
  const exerciseAssumptions: string[] = [];

  for (const raw of assumptions) {
    const a = raw.trim();
    if (!a) continue;
    const lower = a.toLowerCase();
    const nutritionHit =
      nutritionKeywords.some((k) => lower.includes(k)) ||
      nutritionKeywords.some((k) => nutritionText.includes(k) && lower.includes(k));
    const exerciseHit =
      exerciseKeywords.some((k) => lower.includes(k)) ||
      exerciseKeywords.some((k) => exerciseText.includes(k) && lower.includes(k));

    if (nutritionHit && !exerciseHit) {
      nutritionAssumptions.push(a);
      continue;
    }
    if (exerciseHit && !nutritionHit) {
      exerciseAssumptions.push(a);
      continue;
    }
    if (nutritionHit && exerciseHit) {
      nutritionAssumptions.push(a);
      exerciseAssumptions.push(a);
      continue;
    }
  }

  return {
    nutritionAssumptions: nutritionAssumptions.slice(0, 6),
    exerciseAssumptions: exerciseAssumptions.slice(0, 6),
  };
}

async function inferCalorieJournalTitle(
  userId: string,
  kind: "nutrition" | "exercise",
  focusedEntryText: string,
  answers: string[],
  formattedText: string
): Promise<string> {
  const fallback = kind === "nutrition" ? "Nutrition log" : "Exercise log";
  const summaryLines = [
    kind === "nutrition" ? "Nutrition journal entry" : "Exercise journal entry",
    `Enriched entry: ${focusedEntryText.trim()}`,
  ];
  if (answers.length > 0) {
    summaryLines.push(`Clarifications: ${answers.join(" | ")}`);
  }
  // Keep prompt compact while still including structured estimate context.
  summaryLines.push(formattedText.slice(0, 700));
  const titleInput = summaryLines.join("\n\n").slice(0, 12_000);
  try {
    const inferred = await inferJournalTitleFromContent(titleInput, { userId });
    return inferred.trim() || fallback;
  } catch {
    return fallback;
  }
}

function buildNutritionEntryFallback(estimate: {
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  notes: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `Estimated intake: ${estimate.calories ?? "unknown"} kcal, ${estimate.proteinGrams ?? "unknown"}g protein, ${estimate.carbsGrams ?? "unknown"}g carbs, ${estimate.fatGrams ?? "unknown"}g fat.`
  );
  if (estimate.notes.trim()) parts.push(estimate.notes.trim());
  return parts.join(" ").trim();
}

function buildExerciseEntryFallback(estimate: {
  caloriesBurned: number | null;
  carbsUsedGrams?: number | null;
  fatUsedGrams?: number | null;
  proteinDeltaGrams?: number | null;
  notes: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `Estimated exercise burn: ${estimate.caloriesBurned ?? "unknown"} kcal, carbs used ${estimate.carbsUsedGrams ?? "unknown"}g, fat used ${estimate.fatUsedGrams ?? "unknown"}g, protein delta ${estimate.proteinDeltaGrams ?? "unknown"}g.`
  );
  if (estimate.notes.trim()) parts.push(estimate.notes.trim());
  return parts.join(" ").trim();
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
      const enrichedEntries = await enrichCalorieTrackingEntries(text, answers, {
        userId,
        eventType: "calorie_journal_enrich_entries",
      });
      const assumptions = estimate.assumptions.slice(0, 8);
      const batchId = `calorie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const entryNow = new Date();
      const savedRows: Array<{ id: string; category: "nutrition" | "exercise"; title: string }> = [];
      let nutritionFocusedEntryForAssumptions = "";
      let exerciseFocusedEntryForAssumptions = "";

      if (estimate.intent === "nutrition" || estimate.intent === "mixed") {
        const nutritionEstimate = estimate.nutrition ?? {
          calories: null,
          proteinGrams: null,
          carbsGrams: null,
          fatGrams: null,
          notes: "",
        };
        const nutritionFocusedEntry =
          enrichedEntries.nutritionEntry?.trim() || buildNutritionEntryFallback(nutritionEstimate);
        nutritionFocusedEntryForAssumptions = nutritionFocusedEntry;
        const { nutritionAssumptions } = splitAssumptionsByType(
          assumptions,
          nutritionFocusedEntry,
          ""
        );
        const nutritionText = formatNutritionJournalText(
          nutritionFocusedEntry,
          answers,
          nutritionEstimate,
          nutritionAssumptions.length > 0 ? nutritionAssumptions : assumptions
        );
        const nutritionTitle = await inferCalorieJournalTitle(
          userId,
          "nutrition",
          nutritionFocusedEntry,
          answers,
          nutritionText
        );
        const saved = await saveJournalTranscript(
          userId,
          nutritionText,
          nutritionTitle,
          entryDate,
          {
            journalCategory: "nutrition",
            journalBatchId: batchId,
            journalEntryTime: { hour: entryNow.getHours(), minute: entryNow.getMinutes() },
          }
        );
        savedRows.push({
          id: saved._id,
          category: "nutrition",
          title: saved.videoTitle ?? "Nutrition log",
        });
      }

      if (estimate.intent === "exercise" || estimate.intent === "mixed") {
        let exerciseEstimate = estimate.exercise ?? {
          caloriesBurned: null,
          carbsUsedGrams: null,
          fatUsedGrams: null,
          proteinDeltaGrams: null,
          notes: "",
        };
        const needsFuelCompletion =
          exerciseEstimate.carbsUsedGrams == null ||
          exerciseEstimate.fatUsedGrams == null ||
          exerciseEstimate.proteinDeltaGrams == null;
        if (needsFuelCompletion) {
          const completedFuel = await completeExerciseFuelEstimate(text, answers, exerciseEstimate, {
            userId,
            eventType: "calorie_journal_exercise_fuel_complete",
          });
          exerciseEstimate = {
            ...exerciseEstimate,
            carbsUsedGrams:
              exerciseEstimate.carbsUsedGrams != null
                ? exerciseEstimate.carbsUsedGrams
                : completedFuel.carbsUsedGrams,
            fatUsedGrams:
              exerciseEstimate.fatUsedGrams != null
                ? exerciseEstimate.fatUsedGrams
                : completedFuel.fatUsedGrams,
            proteinDeltaGrams:
              exerciseEstimate.proteinDeltaGrams != null
                ? exerciseEstimate.proteinDeltaGrams
                : completedFuel.proteinDeltaGrams,
          };
        }
        const exerciseFocusedEntry =
          enrichedEntries.exerciseEntry?.trim() || buildExerciseEntryFallback(exerciseEstimate);
        exerciseFocusedEntryForAssumptions = exerciseFocusedEntry;
        const { exerciseAssumptions } = splitAssumptionsByType(
          assumptions,
          "",
          exerciseFocusedEntry
        );
        const exerciseText = formatExerciseJournalText(
          exerciseFocusedEntry,
          answers,
          exerciseEstimate,
          exerciseAssumptions.length > 0 ? exerciseAssumptions : assumptions
        );
        const exerciseTitle = await inferCalorieJournalTitle(
          userId,
          "exercise",
          exerciseFocusedEntry,
          answers,
          exerciseText
        );
        const saved = await saveJournalTranscript(
          userId,
          exerciseText,
          exerciseTitle,
          entryDate,
          {
            journalCategory: "exercise",
            journalBatchId: batchId,
            journalEntryTime: { hour: entryNow.getHours(), minute: entryNow.getMinutes() },
          }
        );
        savedRows.push({
          id: saved._id,
          category: "exercise",
          title: saved.videoTitle ?? "Exercise log",
        });
        estimate.exercise = exerciseEstimate;
      }

      if (estimate.intent === "mixed") {
        const { nutritionAssumptions, exerciseAssumptions } = splitAssumptionsByType(
          assumptions,
          nutritionFocusedEntryForAssumptions,
          exerciseFocusedEntryForAssumptions
        );
        if (estimate.nutrition && nutritionAssumptions.length > 0) {
          estimate.assumptions = nutritionAssumptions;
        } else if (estimate.exercise && exerciseAssumptions.length > 0) {
          estimate.assumptions = exerciseAssumptions;
        }
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

