import {
  saveJournalTranscript,
  createCustomConcept,
  createHabit,
  addWeightEntry,
  addSleepEntry,
  upsertReusableJournalItem,
} from "@/lib/db";
import {
  formatExerciseJournalText,
  formatMixedCalorieJournalText,
  formatNutritionJournalText,
} from "@/lib/calorie-journal-format";
import type { BrainDumpCategory, BrainDumpResult } from "@/lib/gemini";
import { completeExerciseFuelEstimate, finalizeCalorieTrackingEstimate } from "@/lib/gemini";
import type { CalorieTrackingFinalizeResult } from "@/lib/gemini";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import type { ClientQuickCalorieSnapshot } from "@/lib/quick-calorie-snapshot";

const VALID_CATEGORIES: BrainDumpCategory[] = [
  "reflection",
  "concept",
  "experiment",
  "nutrition",
  "exercise",
  "weight",
  "sleep",
];

function defaultNutritionFacts() {
  return {
    totalCarbohydratesGrams: null,
    dietaryFiberGrams: null,
    sugarGrams: null,
    addedSugarsGrams: null,
    sugarAlcoholsGrams: null,
    netCarbsGrams: null,
    saturatedFatGrams: null,
    transFatGrams: null,
    polyunsaturatedFatGrams: null,
    monounsaturatedFatGrams: null,
    cholesterolMg: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    potassiumMg: null,
    vitaminAIu: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    caffeineMg: null,
  };
}

function fallbackNutritionEstimate(reasoning: string) {
  return {
    calories: null,
    proteinGrams: null,
    carbsGrams: null,
    fatGrams: null,
    facts: defaultNutritionFacts(),
    notes: reasoning.trim().slice(0, 500),
  };
}

function fallbackExerciseEstimate(reasoning: string) {
  return {
    caloriesBurned: null,
    carbsUsedGrams: null,
    fatUsedGrams: null,
    proteinDeltaGrams: null,
    notes: reasoning.trim().slice(0, 500),
  };
}

function normalizeAssumptions(estimate: CalorieTrackingFinalizeResult): string[] {
  return (estimate.assumptions ?? [])
    .map((a) => (typeof a === "string" ? a.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function isValidBrainDumpCategory(c: unknown): c is BrainDumpCategory {
  return typeof c === "string" && VALID_CATEGORIES.includes(c as BrainDumpCategory);
}

/** Returns an error message if the payload cannot be persisted, otherwise null. */
export function validateBrainDumpFields(fields: BrainDumpResult): string | null {
  if (!isValidBrainDumpCategory(fields.category)) return "Invalid category";
  if (!fields.title?.trim()) return "Title is required";

  switch (fields.category) {
    case "reflection":
      if (!fields.reflectionText?.trim()) return "Reflection text is required";
      break;
    case "concept":
      if (!fields.conceptSummary?.trim() || !fields.conceptEnrichmentPrompt?.trim()) {
        return "Concept summary and enrichment prompt are required";
      }
      break;
    case "experiment":
      if (
        !fields.experimentDescription?.trim() ||
        !fields.experimentHowTo?.trim() ||
        !fields.experimentTips?.trim()
      ) {
        return "Experiment fields are required";
      }
      break;
    case "nutrition":
      if (!fields.nutritionText?.trim()) return "Nutrition description is required";
      break;
    case "exercise":
      if (!fields.exerciseText?.trim()) return "Exercise description is required";
      break;
    case "weight":
      if (fields.weightKg == null || !Number.isFinite(fields.weightKg)) return "Valid weight is required";
      if (fields.weightKg < 20 || fields.weightKg > 400) return "Weight out of range";
      break;
    case "sleep":
      if (fields.sleepHours == null || !Number.isFinite(fields.sleepHours)) return "Valid sleep hours required";
      if (fields.sleepHours < 0 || fields.sleepHours > 24) return "Sleep hours out of range";
      break;
    default:
      return "Unknown category";
  }
  return null;
}

function firstMeaningfulLine(raw: string): string {
  return raw.trim().split(/\n/).map((s) => s.trim()).find(Boolean) ?? "";
}

/** Avoid storing generic Gemini titles as journal videoTitle (Quick Note / modals). */
function resolveJournalVideoTitle(geminiTitle: string, bodyFallback: string): string {
  const g = geminiTitle.trim();
  if (g) {
    const lower = g.toLowerCase();
    if (lower !== "brain dump" && lower !== "voice note") {
      return g.length > 120 ? `${g.slice(0, 117)}...` : g;
    }
  }
  const line = firstMeaningfulLine(bodyFallback);
  if (line) return line.length > 120 ? `${line.slice(0, 117)}...` : line;
  return "Journal entry";
}

type JournalEntryDateParts = { day: number; month: number; year: number };

/** When inline quick-estimate matches the saved line, skip a second finalizeCalorieTrackingEstimate call. */
async function tryPersistNutritionWithClientSnapshot(
  userId: string,
  text: string,
  journalTitle: string,
  entryDate: JournalEntryDateParts,
  snap: ClientQuickCalorieSnapshot
): Promise<{ id: string; category: BrainDumpCategory } | null> {
  if (snap.sourceText.trim() !== text.trim()) return null;

  const intent = snap.intent.toLowerCase();
  const assumptions = snap.assumptions.map((a) => a.trim()).filter(Boolean).slice(0, 8);
  const nutritionCalories = snap.calories;
  const isExerciseOnly =
    intent === "exercise" &&
    (nutritionCalories == null || !Number.isFinite(nutritionCalories) || nutritionCalories <= 0);

  if (isExerciseOnly) {
    const exerciseEstimate = {
      caloriesBurned: snap.exerciseCaloriesBurned,
      carbsUsedGrams: null as number | null,
      fatUsedGrams: null as number | null,
      proteinDeltaGrams: null as number | null,
      notes: (snap.exerciseNotes || snap.reasoning || "").trim().slice(0, 500),
    };
    const journalText = formatExerciseJournalText(text, [], exerciseEstimate, assumptions);
    const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
      journalCategory: "exercise",
      quickNoteHighlightSpans: snap.highlightSpans ?? [],
    });
    await upsertReusableJournalItem(userId, "exercise", text).catch(() => {});
    return { id: saved._id, category: "exercise" };
  }

  if (intent === "mixed") {
    const hasN =
      nutritionCalories != null && Number.isFinite(nutritionCalories) && nutritionCalories > 0;
    const burn = snap.exerciseCaloriesBurned;
    const hasE = burn != null && Number.isFinite(burn) && burn > 0;

    if (hasN && hasE) {
      const nutritionEstimate = {
        calories: snap.calories,
        proteinGrams: snap.proteinGrams,
        carbsGrams: snap.carbsGrams,
        fatGrams: snap.fatGrams,
        notes: (snap.nutritionNotes || "").trim().slice(0, 500),
      };
      const exerciseEstimate = {
        caloriesBurned: burn,
        carbsUsedGrams: null as number | null,
        fatUsedGrams: null as number | null,
        proteinDeltaGrams: null as number | null,
        notes: (snap.exerciseNotes || "").trim().slice(0, 500),
      };
      const journalText = formatMixedCalorieJournalText(
        text,
        nutritionEstimate,
        exerciseEstimate,
        assumptions
      );
      const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
        journalCategory: "nutrition",
        quickNoteHighlightSpans: snap.highlightSpans ?? [],
      });
      await upsertReusableJournalItem(userId, "nutrition", text).catch(() => {});
      return { id: saved._id, category: "nutrition" };
    }
    if (!hasN && hasE) {
      const exerciseEstimate = {
        caloriesBurned: burn,
        carbsUsedGrams: null as number | null,
        fatUsedGrams: null as number | null,
        proteinDeltaGrams: null as number | null,
        notes: (snap.exerciseNotes || snap.reasoning || "").trim().slice(0, 500),
      };
      const journalText = formatExerciseJournalText(text, [], exerciseEstimate, assumptions);
      const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
        journalCategory: "exercise",
        quickNoteHighlightSpans: snap.highlightSpans ?? [],
      });
      await upsertReusableJournalItem(userId, "exercise", text).catch(() => {});
      return { id: saved._id, category: "exercise" };
    }
  }

  const nutritionEstimate = {
    calories: snap.calories,
    proteinGrams: snap.proteinGrams,
    carbsGrams: snap.carbsGrams,
    fatGrams: snap.fatGrams,
    facts: defaultNutritionFacts(),
    notes: (snap.nutritionNotes || snap.reasoning || "").trim().slice(0, 500),
  };
  const journalText = formatNutritionJournalText(text, [], nutritionEstimate, assumptions);
  const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
    journalCategory: "nutrition",
    quickNoteHighlightSpans: snap.highlightSpans ?? [],
  });
  await upsertReusableJournalItem(userId, "nutrition", text).catch(() => {});
  return { id: saved._id, category: "nutrition" };
}

async function tryPersistExerciseWithClientSnapshot(
  userId: string,
  text: string,
  journalTitle: string,
  entryDate: JournalEntryDateParts,
  snap: ClientQuickCalorieSnapshot
): Promise<{ id: string; category: BrainDumpCategory } | null> {
  if (snap.sourceText.trim() !== text.trim()) return null;

  const intent = snap.intent.toLowerCase();
  const assumptions = snap.assumptions.map((a) => a.trim()).filter(Boolean).slice(0, 8);
  const caloriesBurned = snap.exerciseCaloriesBurned;
  const isNutritionOnly =
    intent === "nutrition" &&
    (caloriesBurned == null || !Number.isFinite(caloriesBurned) || caloriesBurned <= 0);

  if (isNutritionOnly) {
    const nutritionEstimate = {
      calories: snap.calories,
      proteinGrams: snap.proteinGrams,
      carbsGrams: snap.carbsGrams,
      fatGrams: snap.fatGrams,
      facts: defaultNutritionFacts(),
      notes: (snap.nutritionNotes || snap.reasoning || "").trim().slice(0, 500),
    };
    const journalText = formatNutritionJournalText(text, [], nutritionEstimate, assumptions);
    const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
      journalCategory: "nutrition",
      quickNoteHighlightSpans: snap.highlightSpans ?? [],
    });
    await upsertReusableJournalItem(userId, "nutrition", text).catch(() => {});
    return { id: saved._id, category: "nutrition" };
  }

  const exerciseEstimate = {
    caloriesBurned: snap.exerciseCaloriesBurned,
    carbsUsedGrams: null as number | null,
    fatUsedGrams: null as number | null,
    proteinDeltaGrams: null as number | null,
    notes: (snap.exerciseNotes || snap.reasoning || "").trim().slice(0, 500),
  };
  const journalText = formatExerciseJournalText(text, [], exerciseEstimate, assumptions);
  const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
    journalCategory: "exercise",
    quickNoteHighlightSpans: snap.highlightSpans ?? [],
  });
  await upsertReusableJournalItem(userId, "exercise", text).catch(() => {});
  return { id: saved._id, category: "exercise" };
}

export async function persistBrainDumpFields(
  userId: string,
  fields: BrainDumpResult,
  options?: {
    geminiEventSuffix?: string;
    clientQuickCalorie?: ClientQuickCalorieSnapshot;
    habitTags?: string[];
  }
): Promise<{ id: string; category: BrainDumpCategory }> {
  const err = validateBrainDumpFields(fields);
  if (err) throw new Error(err);

  const suffix = options?.geminiEventSuffix ?? "";
  const habitTags = options?.habitTags?.length ? options.habitTags : undefined;
  const entryDate = resolveJournalEntryDateParts({});
  const category = fields.category;
  const title = fields.title.trim();

  if (category === "reflection") {
    const text = fields.reflectionText!.trim();
    const journalTitle = resolveJournalVideoTitle(title, text);
    const saved = await saveJournalTranscript(userId, text, journalTitle, entryDate, {
      ...(habitTags ? { habitTags } : {}),
    });
    return { id: saved._id, category };
  }

  if (category === "concept") {
    const summary = fields.conceptSummary!.trim();
    const conceptTitle = resolveJournalVideoTitle(title, summary);
    const saved = await createCustomConcept(
      userId,
      conceptTitle,
      summary,
      fields.conceptEnrichmentPrompt!.trim()
    );
    return { id: saved._id, category };
  }

  if (category === "experiment") {
    const desc = fields.experimentDescription!.trim();
    const habitTitle = resolveJournalVideoTitle(title, desc);
    const saved = await createHabit(userId, {
      sourceType: "manual",
      sourceId: "",
      bucket: "wellbeing",
      name: habitTitle,
      description: fields.experimentDescription!.trim(),
      howToFollowThrough: fields.experimentHowTo!.trim(),
      tips: fields.experimentTips!.trim(),
    });
    return { id: saved._id, category };
  }

  if (category === "nutrition") {
    const text = fields.nutritionText!.trim();
    const journalTitle = resolveJournalVideoTitle(title, text);
    const snap = options?.clientQuickCalorie;
    if (snap) {
      const reused = await tryPersistNutritionWithClientSnapshot(userId, text, journalTitle, entryDate, snap);
      if (reused) return reused;
    }
    const estimate =
      fields.precomputedCalorieEstimate ??
      (await finalizeCalorieTrackingEstimate(text, [], {
        userId,
        eventType: `brain_dump_nutrition_save${suffix}`,
      }));
    const assumptions = normalizeAssumptions(estimate);
    const reasoning = typeof estimate.reasoning === "string" ? estimate.reasoning : "";

    const nutritionCalories = estimate.nutrition?.calories;
    const isExerciseOnly =
      estimate.intent === "exercise" &&
      (nutritionCalories == null || !Number.isFinite(nutritionCalories) || nutritionCalories <= 0);

    if (isExerciseOnly) {
      let exerciseEstimate = estimate.exercise ?? fallbackExerciseEstimate(reasoning);
      const needsFuel =
        exerciseEstimate.carbsUsedGrams == null ||
        exerciseEstimate.fatUsedGrams == null ||
        exerciseEstimate.proteinDeltaGrams == null;
      if (needsFuel) {
        const completedFuel = await completeExerciseFuelEstimate(text, [], exerciseEstimate, {
          userId,
          eventType: `brain_dump_exercise_fuel${suffix}`,
        });
        exerciseEstimate = {
          ...exerciseEstimate,
          carbsUsedGrams:
            exerciseEstimate.carbsUsedGrams != null
              ? exerciseEstimate.carbsUsedGrams
              : completedFuel.carbsUsedGrams,
          fatUsedGrams:
            exerciseEstimate.fatUsedGrams != null ? exerciseEstimate.fatUsedGrams : completedFuel.fatUsedGrams,
          proteinDeltaGrams:
            exerciseEstimate.proteinDeltaGrams != null
              ? exerciseEstimate.proteinDeltaGrams
              : completedFuel.proteinDeltaGrams,
        };
      }
      const journalText = formatExerciseJournalText(text, [], exerciseEstimate, assumptions);
      const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
        journalCategory: "exercise",
        quickNoteHighlightSpans: estimate.highlightSpans ?? [],
        ...(habitTags ? { habitTags } : {}),
      });
      await upsertReusableJournalItem(userId, "exercise", text).catch(() => {});
      return { id: saved._id, category: "exercise" };
    }

    const nutritionEstimate =
      estimate.nutrition != null
        ? {
            ...estimate.nutrition,
            facts: estimate.nutrition.facts ?? defaultNutritionFacts(),
            notes: estimate.nutrition.notes ?? "",
          }
        : fallbackNutritionEstimate(reasoning);

    const journalText = formatNutritionJournalText(text, [], nutritionEstimate, assumptions);
    const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
      journalCategory: "nutrition",
      quickNoteHighlightSpans: estimate.highlightSpans ?? [],
      ...(habitTags ? { habitTags } : {}),
    });
    await upsertReusableJournalItem(userId, "nutrition", text).catch(() => {});
    return { id: saved._id, category };
  }

  if (category === "exercise") {
    const text = fields.exerciseText!.trim();
    const journalTitle = resolveJournalVideoTitle(title, text);
    const snap = options?.clientQuickCalorie;
    if (snap) {
      const reused = await tryPersistExerciseWithClientSnapshot(userId, text, journalTitle, entryDate, snap);
      if (reused) return reused;
    }
    const estimate =
      fields.precomputedCalorieEstimate ??
      (await finalizeCalorieTrackingEstimate(text, [], {
        userId,
        eventType: `brain_dump_exercise_save${suffix}`,
      }));
    const assumptions = normalizeAssumptions(estimate);
    const reasoning = typeof estimate.reasoning === "string" ? estimate.reasoning : "";

    const caloriesBurned = estimate.exercise?.caloriesBurned;
    const isNutritionOnly =
      estimate.intent === "nutrition" &&
      (caloriesBurned == null || !Number.isFinite(caloriesBurned) || caloriesBurned <= 0);

    if (isNutritionOnly) {
      const nutritionEstimate =
        estimate.nutrition != null
          ? {
              ...estimate.nutrition,
              facts: estimate.nutrition.facts ?? defaultNutritionFacts(),
              notes: estimate.nutrition.notes ?? "",
            }
          : fallbackNutritionEstimate(reasoning);
      const journalText = formatNutritionJournalText(text, [], nutritionEstimate, assumptions);
      const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
        journalCategory: "nutrition",
        quickNoteHighlightSpans: estimate.highlightSpans ?? [],
        ...(habitTags ? { habitTags } : {}),
      });
      await upsertReusableJournalItem(userId, "nutrition", text).catch(() => {});
      return { id: saved._id, category: "nutrition" };
    }

    let exerciseEstimate = estimate.exercise ?? fallbackExerciseEstimate(reasoning);
    const needsFuel =
      exerciseEstimate.carbsUsedGrams == null ||
      exerciseEstimate.fatUsedGrams == null ||
      exerciseEstimate.proteinDeltaGrams == null;
    if (needsFuel) {
      const completedFuel = await completeExerciseFuelEstimate(text, [], exerciseEstimate, {
        userId,
        eventType: `brain_dump_exercise_fuel${suffix}`,
      });
      exerciseEstimate = {
        ...exerciseEstimate,
        carbsUsedGrams:
          exerciseEstimate.carbsUsedGrams != null
            ? exerciseEstimate.carbsUsedGrams
            : completedFuel.carbsUsedGrams,
        fatUsedGrams:
          exerciseEstimate.fatUsedGrams != null ? exerciseEstimate.fatUsedGrams : completedFuel.fatUsedGrams,
        proteinDeltaGrams:
          exerciseEstimate.proteinDeltaGrams != null
            ? exerciseEstimate.proteinDeltaGrams
            : completedFuel.proteinDeltaGrams,
      };
    }
    const journalText = formatExerciseJournalText(text, [], exerciseEstimate, assumptions);
    const saved = await saveJournalTranscript(userId, journalText, journalTitle, entryDate, {
      journalCategory: "exercise",
      quickNoteHighlightSpans: estimate.highlightSpans ?? [],
      ...(habitTags ? { habitTags } : {}),
    });
    await upsertReusableJournalItem(userId, "exercise", text).catch(() => {});
    return { id: saved._id, category };
  }

  if (category === "weight") {
    const weightKg = Math.round(fields.weightKg! * 10) / 10;
    const saved = await addWeightEntry(userId, weightKg);
    return { id: saved._id, category };
  }

  const saved = await addSleepEntry(userId, {
    sleepHours: fields.sleepHours!,
    hrvMs: fields.hrvMs === null || fields.hrvMs === undefined ? null : Math.round(fields.hrvMs),
    sleepScore: null,
    entryDay: entryDate.day,
    entryMonth: entryDate.month,
    entryYear: entryDate.year,
  });
  return { id: saved._id, category };
}
