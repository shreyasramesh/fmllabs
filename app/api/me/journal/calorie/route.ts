import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { getPacificTimeParts, parseJournalEntryTimeFromBody } from "@/lib/journal-entry-time";
import {
  getReusableNutritionEntryUsageMap,
  getReusableJournalTags,
  getSavedTranscript,
  getSavedTranscripts,
  incrementReusableNutritionEntryUsage,
  saveJournalTranscript,
  upsertReusableJournalItem,
  upsertReusableJournalTags,
} from "@/lib/db";
import { inferJournalTitleFromContent } from "@/lib/journal-title";
import {
  analyzeCalorieTrackingInput,
  completeExerciseFuelEstimate,
  extractReusableJournalTags,
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
  facts?: {
    totalCarbohydratesGrams: number | null;
    dietaryFiberGrams: number | null;
    sugarGrams: number | null;
    addedSugarsGrams: number | null;
    sugarAlcoholsGrams: number | null;
    netCarbsGrams: number | null;
    saturatedFatGrams: number | null;
    transFatGrams: number | null;
    polyunsaturatedFatGrams: number | null;
    monounsaturatedFatGrams: number | null;
    cholesterolMg: number | null;
    sodiumMg: number | null;
    calciumMg: number | null;
    ironMg: number | null;
    potassiumMg: number | null;
    vitaminAIu: number | null;
    vitaminCMg: number | null;
    vitaminDMcg: number | null;
  };
  notes: string;
}, assumptions: string[], customTag?: string): string {
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
  lines.push(`- Total Carbohydrates: ${estimate.facts?.totalCarbohydratesGrams ?? "unknown"} g`);
  lines.push(`- Dietary Fiber: ${estimate.facts?.dietaryFiberGrams ?? "unknown"} g`);
  lines.push(`- Sugar: ${estimate.facts?.sugarGrams ?? "unknown"} g`);
  lines.push(`- Added Sugars: ${estimate.facts?.addedSugarsGrams ?? "unknown"} g`);
  lines.push(`- Sugar Alcohols: ${estimate.facts?.sugarAlcoholsGrams ?? "unknown"} g`);
  lines.push(`- Net Carbs: ${estimate.facts?.netCarbsGrams ?? "unknown"} g`);
  lines.push(`- Saturated Fat: ${estimate.facts?.saturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Trans Fat: ${estimate.facts?.transFatGrams ?? "unknown"} g`);
  lines.push(`- Polyunsaturated Fat: ${estimate.facts?.polyunsaturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Monounsaturated Fat: ${estimate.facts?.monounsaturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Cholesterol: ${estimate.facts?.cholesterolMg ?? "unknown"} mg`);
  lines.push(`- Sodium: ${estimate.facts?.sodiumMg ?? "unknown"} mg`);
  lines.push(`- Calcium: ${estimate.facts?.calciumMg ?? "unknown"} mg`);
  lines.push(`- Iron: ${estimate.facts?.ironMg ?? "unknown"} mg`);
  lines.push(`- Potassium: ${estimate.facts?.potassiumMg ?? "unknown"} mg`);
  lines.push(`- Vitamin A: ${estimate.facts?.vitaminAIu ?? "unknown"} IU`);
  lines.push(`- Vitamin C: ${estimate.facts?.vitaminCMg ?? "unknown"} mg`);
  lines.push(`- Vitamin D: ${estimate.facts?.vitaminDMcg ?? "unknown"} mcg`);
  if ((customTag ?? "").trim()) lines.push(`- Tag: ${(customTag ?? "").trim()}`);
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
}, assumptions: string[], customTag?: string): string {
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
  if ((customTag ?? "").trim()) lines.push(`- Tag: ${(customTag ?? "").trim()}`);
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

function pickReusableDisplayName(entryText: string): string {
  const firstLine = entryText
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  if (!firstLine) return "";
  const short = firstLine.split(/[.!?]/)[0]?.trim() ?? firstLine;
  return short.slice(0, 120);
}

function extractEnrichedEntryFromJournalText(text: string): string {
  const marker = "Enriched entry:";
  const idx = text.indexOf(marker);
  if (idx < 0) return text.trim().slice(0, 500);
  const after = text.slice(idx + marker.length).trimStart();
  const stopMatch = after.match(/\n(?:Clarifications:|- Calories:|- Calories burned:|Assumptions:)/);
  const body = (stopMatch ? after.slice(0, stopMatch.index) : after).trim();
  return body.slice(0, 500);
}

function parseOptionalMetric(text: string, pattern: RegExp): number | null | undefined {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const raw = (match[1] ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseNutritionSnapshotFromJournalText(text: string) {
  return {
    calories: parseOptionalMetric(text, /- Calories:\s*([^\n]+?)\s*kcal/i),
    proteinGrams: parseOptionalMetric(text, /- Protein:\s*([^\n]+?)\s*g/i),
    carbsGrams: parseOptionalMetric(text, /- Carbs:\s*([^\n]+?)\s*g/i),
    fatGrams: parseOptionalMetric(text, /- Fat:\s*([^\n]+?)\s*g/i),
    facts: {
      totalCarbohydratesGrams: parseOptionalMetric(text, /- Total Carbohydrates:\s*([^\n]+?)\s*g/i),
      dietaryFiberGrams: parseOptionalMetric(text, /- Dietary Fiber:\s*([^\n]+?)\s*g/i),
      sugarGrams: parseOptionalMetric(text, /- Sugar:\s*([^\n]+?)\s*g/i),
      addedSugarsGrams: parseOptionalMetric(text, /- Added Sugars:\s*([^\n]+?)\s*g/i),
      sugarAlcoholsGrams: parseOptionalMetric(text, /- Sugar Alcohols:\s*([^\n]+?)\s*g/i),
      netCarbsGrams: parseOptionalMetric(text, /- Net Carbs:\s*([^\n]+?)\s*g/i),
      saturatedFatGrams: parseOptionalMetric(text, /- Saturated Fat:\s*([^\n]+?)\s*g/i),
      transFatGrams: parseOptionalMetric(text, /- Trans Fat:\s*([^\n]+?)\s*g/i),
      polyunsaturatedFatGrams: parseOptionalMetric(text, /- Polyunsaturated Fat:\s*([^\n]+?)\s*g/i),
      monounsaturatedFatGrams: parseOptionalMetric(text, /- Monounsaturated Fat:\s*([^\n]+?)\s*g/i),
      cholesterolMg: parseOptionalMetric(text, /- Cholesterol:\s*([^\n]+?)\s*mg/i),
      sodiumMg: parseOptionalMetric(text, /- Sodium:\s*([^\n]+?)\s*mg/i),
      calciumMg: parseOptionalMetric(text, /- Calcium:\s*([^\n]+?)\s*mg/i),
      ironMg: parseOptionalMetric(text, /- Iron:\s*([^\n]+?)\s*mg/i),
      potassiumMg: parseOptionalMetric(text, /- Potassium:\s*([^\n]+?)\s*mg/i),
      vitaminAIu: parseOptionalMetric(text, /- Vitamin A:\s*([^\n]+?)\s*IU/i),
      vitaminCMg: parseOptionalMetric(text, /- Vitamin C:\s*([^\n]+?)\s*mg/i),
      vitaminDMcg: parseOptionalMetric(text, /- Vitamin D:\s*([^\n]+?)\s*mcg/i),
    },
  };
}

function normalizeTagToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()=+[{\]}\\|;:'",<>/?]+/g, " ")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 60);
}

async function persistReusableTags(
  userId: string,
  kind: "nutrition" | "exercise",
  entryText: string,
  customTag?: string,
  options?: {
    nutritionSnapshot?: {
      calories?: number | null;
      proteinGrams?: number | null;
      carbsGrams?: number | null;
      fatGrams?: number | null;
      facts?: {
        totalCarbohydratesGrams?: number | null;
        dietaryFiberGrams?: number | null;
        sugarGrams?: number | null;
        addedSugarsGrams?: number | null;
        sugarAlcoholsGrams?: number | null;
        netCarbsGrams?: number | null;
        saturatedFatGrams?: number | null;
        transFatGrams?: number | null;
        polyunsaturatedFatGrams?: number | null;
        monounsaturatedFatGrams?: number | null;
        cholesterolMg?: number | null;
        sodiumMg?: number | null;
        calciumMg?: number | null;
        ironMg?: number | null;
        potassiumMg?: number | null;
        vitaminAIu?: number | null;
        vitaminCMg?: number | null;
        vitaminDMcg?: number | null;
      };
    };
  }
): Promise<void> {
  const extracted = await extractReusableJournalTags(kind, entryText, {
    userId,
    eventType: "calorie_journal_extract_reusable_tags",
  }).catch(() => []);
  const fallbackDisplay = pickReusableDisplayName(entryText) || entryText.slice(0, 80);
  const fallbackTag = normalizeTagToken(fallbackDisplay);
  const tags = extracted.length
    ? extracted
    : fallbackTag
      ? [{ tag: fallbackTag, displayName: fallbackDisplay, aliases: [] }]
      : [];
  const customTagClean = (customTag ?? "").trim();
  const customTagToken = normalizeTagToken(customTagClean);
  if (customTagToken) {
    tags.unshift({
      tag: customTagToken,
      displayName: customTagClean.slice(0, 80),
      aliases: [],
    });
  }
  if (tags.length === 0) return;
  await upsertReusableJournalTags(userId, kind, tags, entryText, {
    nutritionSnapshot: kind === "nutrition" ? options?.nutritionSnapshot : undefined,
  }).catch(() => {});
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
    const requiresText = action === "analyze" || action === "finalize";
    if (requiresText) {
      if (!text) {
        return NextResponse.json({ error: "Text is required" }, { status: 400 });
      }
      if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
        return NextResponse.json(
          { error: `Text must be at most ${EXTRACT_CONCEPTS_MAX_TOTAL_CHARS} characters` },
          { status: 400 }
        );
      }
    }

    if (action === "analyze") {
      const analysis = await analyzeCalorieTrackingInput(text, {
        userId,
        eventType: "calorie_journal_analyze",
      });
      return NextResponse.json(analysis);
    }

    if (action === "reuse_snapshot") {
      const sourceTranscriptId =
        typeof body.sourceTranscriptId === "string" ? body.sourceTranscriptId.trim() : "";
      if (!sourceTranscriptId) {
        return NextResponse.json({ error: "sourceTranscriptId is required" }, { status: 400 });
      }
      const source = await getSavedTranscript(sourceTranscriptId, userId);
      if (!source || source.sourceType !== "journal" || source.journalCategory !== "nutrition") {
        return NextResponse.json({ error: "Reusable nutrition source entry not found" }, { status: 404 });
      }
      let entryDate: { day: number; month: number; year: number };
      try {
        entryDate = normalizeDatePartsFromBody(body);
      } catch {
        return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
      }
      const journalEntryTime = parseJournalEntryTimeFromBody(body) ?? getPacificTimeParts();
      const nutritionSnapshot = parseNutritionSnapshotFromJournalText(source.transcriptText);
      const nutritionEstimate = {
        calories: nutritionSnapshot.calories ?? null,
        proteinGrams: nutritionSnapshot.proteinGrams ?? null,
        carbsGrams: nutritionSnapshot.carbsGrams ?? null,
        fatGrams: nutritionSnapshot.fatGrams ?? null,
        facts: {
          totalCarbohydratesGrams: nutritionSnapshot.facts.totalCarbohydratesGrams ?? null,
          dietaryFiberGrams: nutritionSnapshot.facts.dietaryFiberGrams ?? null,
          sugarGrams: nutritionSnapshot.facts.sugarGrams ?? null,
          addedSugarsGrams: nutritionSnapshot.facts.addedSugarsGrams ?? null,
          sugarAlcoholsGrams: nutritionSnapshot.facts.sugarAlcoholsGrams ?? null,
          netCarbsGrams: nutritionSnapshot.facts.netCarbsGrams ?? null,
          saturatedFatGrams: nutritionSnapshot.facts.saturatedFatGrams ?? null,
          transFatGrams: nutritionSnapshot.facts.transFatGrams ?? null,
          polyunsaturatedFatGrams: nutritionSnapshot.facts.polyunsaturatedFatGrams ?? null,
          monounsaturatedFatGrams: nutritionSnapshot.facts.monounsaturatedFatGrams ?? null,
          cholesterolMg: nutritionSnapshot.facts.cholesterolMg ?? null,
          sodiumMg: nutritionSnapshot.facts.sodiumMg ?? null,
          calciumMg: nutritionSnapshot.facts.calciumMg ?? null,
          ironMg: nutritionSnapshot.facts.ironMg ?? null,
          potassiumMg: nutritionSnapshot.facts.potassiumMg ?? null,
          vitaminAIu: nutritionSnapshot.facts.vitaminAIu ?? null,
          vitaminCMg: nutritionSnapshot.facts.vitaminCMg ?? null,
          vitaminDMcg: nutritionSnapshot.facts.vitaminDMcg ?? null,
        },
        notes: "",
      };
      const nutritionText = formatNutritionJournalText(
        extractEnrichedEntryFromJournalText(source.transcriptText),
        [],
        nutritionEstimate,
        [],
        ""
      );
      const saved = await saveJournalTranscript(
        userId,
        nutritionText,
        source.videoTitle || "Nutrition log",
        entryDate,
        {
          journalCategory: "nutrition",
          journalEntryTime,
        }
      );
      await incrementReusableNutritionEntryUsage(userId, sourceTranscriptId).catch(() => {});
      return NextResponse.json({
        reused: true,
        savedEntries: [
          {
            id: saved._id,
            category: "nutrition",
            title: saved.videoTitle ?? "Nutrition log",
          },
        ],
      });
    }

    if (action === "finalize") {
      const persist = body.persist !== false;
      const customTag =
        typeof body.customTag === "string" && body.customTag.trim()
          ? body.customTag.trim().slice(0, 80)
          : "";
      const answers = Array.isArray(body.answers)
        ? body.answers
            .map((a) => (typeof a === "string" ? a.trim() : ""))
            .filter((a) => a.length > 0)
            .slice(0, 2)
        : [];
      const parseOptionalNullableNumber = (value: unknown): number | null | undefined => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value === "string" && value.trim() === "") return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return undefined;
        return n;
      };
      const rawNutritionOverrides = body.nutritionOverrides;
      let nutritionOverrides:
        | {
            calories?: number | null;
            proteinGrams?: number | null;
            carbsGrams?: number | null;
            fatGrams?: number | null;
            facts?: {
              totalCarbohydratesGrams?: number | null;
              dietaryFiberGrams?: number | null;
              sugarGrams?: number | null;
              addedSugarsGrams?: number | null;
              sugarAlcoholsGrams?: number | null;
              netCarbsGrams?: number | null;
              saturatedFatGrams?: number | null;
              transFatGrams?: number | null;
              polyunsaturatedFatGrams?: number | null;
              monounsaturatedFatGrams?: number | null;
              cholesterolMg?: number | null;
              sodiumMg?: number | null;
              calciumMg?: number | null;
              ironMg?: number | null;
              potassiumMg?: number | null;
              vitaminAIu?: number | null;
              vitaminCMg?: number | null;
              vitaminDMcg?: number | null;
            };
          }
        | null = null;
      if (rawNutritionOverrides !== undefined) {
        if (!rawNutritionOverrides || typeof rawNutritionOverrides !== "object") {
          return NextResponse.json({ error: "Invalid nutrition overrides" }, { status: 400 });
        }
        const obj = rawNutritionOverrides as Record<string, unknown>;
        const calories = parseOptionalNullableNumber(obj.calories);
        const proteinGrams = parseOptionalNullableNumber(obj.proteinGrams);
        const carbsGrams = parseOptionalNullableNumber(obj.carbsGrams);
        const fatGrams = parseOptionalNullableNumber(obj.fatGrams);
        let facts:
          | {
              totalCarbohydratesGrams?: number | null;
              dietaryFiberGrams?: number | null;
              sugarGrams?: number | null;
              addedSugarsGrams?: number | null;
              sugarAlcoholsGrams?: number | null;
              netCarbsGrams?: number | null;
              saturatedFatGrams?: number | null;
              transFatGrams?: number | null;
              polyunsaturatedFatGrams?: number | null;
              monounsaturatedFatGrams?: number | null;
              cholesterolMg?: number | null;
              sodiumMg?: number | null;
              calciumMg?: number | null;
              ironMg?: number | null;
              potassiumMg?: number | null;
              vitaminAIu?: number | null;
              vitaminCMg?: number | null;
              vitaminDMcg?: number | null;
            }
          | undefined = undefined;
        if (obj.facts !== undefined) {
          if (!obj.facts || typeof obj.facts !== "object") {
            return NextResponse.json({ error: "Invalid dietary facts overrides" }, { status: 400 });
          }
          const factsObj = obj.facts as Record<string, unknown>;
          const factKeys = [
            "totalCarbohydratesGrams",
            "dietaryFiberGrams",
            "sugarGrams",
            "addedSugarsGrams",
            "sugarAlcoholsGrams",
            "netCarbsGrams",
            "saturatedFatGrams",
            "transFatGrams",
            "polyunsaturatedFatGrams",
            "monounsaturatedFatGrams",
            "cholesterolMg",
            "sodiumMg",
            "calciumMg",
            "ironMg",
            "potassiumMg",
            "vitaminAIu",
            "vitaminCMg",
            "vitaminDMcg",
          ] as const;
          facts = {};
          for (const key of factKeys) {
            const parsed = parseOptionalNullableNumber(factsObj[key]);
            if (factsObj[key] !== undefined && parsed === undefined) {
              return NextResponse.json(
                { error: "Dietary facts overrides must be valid numbers or null" },
                { status: 400 }
              );
            }
            facts[key] = parsed;
          }
        }
        if (
          (obj.calories !== undefined && calories === undefined) ||
          (obj.proteinGrams !== undefined && proteinGrams === undefined) ||
          (obj.carbsGrams !== undefined && carbsGrams === undefined) ||
          (obj.fatGrams !== undefined && fatGrams === undefined)
        ) {
          return NextResponse.json({ error: "Nutrition overrides must be valid numbers or null" }, { status: 400 });
        }
        nutritionOverrides = { calories, proteinGrams, carbsGrams, fatGrams, facts };
      }
      let entryDate: { day: number; month: number; year: number };
      try {
        entryDate = normalizeDatePartsFromBody(body);
      } catch {
        return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
      }

      const journalEntryTime = parseJournalEntryTimeFromBody(body) ?? getPacificTimeParts();
      const estimate = await finalizeCalorieTrackingEstimate(text, answers, {
        userId,
        eventType: "calorie_journal_finalize",
      });
      if (nutritionOverrides && estimate.nutrition) {
        if (nutritionOverrides.calories !== undefined) estimate.nutrition.calories = nutritionOverrides.calories;
        if (nutritionOverrides.proteinGrams !== undefined) {
          estimate.nutrition.proteinGrams = nutritionOverrides.proteinGrams;
        }
        if (nutritionOverrides.carbsGrams !== undefined) estimate.nutrition.carbsGrams = nutritionOverrides.carbsGrams;
        if (nutritionOverrides.fatGrams !== undefined) estimate.nutrition.fatGrams = nutritionOverrides.fatGrams;
        if (nutritionOverrides.facts) {
          if (!estimate.nutrition.facts) {
            estimate.nutrition.facts = {
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
            };
          }
          const facts = nutritionOverrides.facts;
          if (facts.totalCarbohydratesGrams !== undefined) estimate.nutrition.facts.totalCarbohydratesGrams = facts.totalCarbohydratesGrams;
          if (facts.dietaryFiberGrams !== undefined) estimate.nutrition.facts.dietaryFiberGrams = facts.dietaryFiberGrams;
          if (facts.sugarGrams !== undefined) estimate.nutrition.facts.sugarGrams = facts.sugarGrams;
          if (facts.addedSugarsGrams !== undefined) estimate.nutrition.facts.addedSugarsGrams = facts.addedSugarsGrams;
          if (facts.sugarAlcoholsGrams !== undefined) estimate.nutrition.facts.sugarAlcoholsGrams = facts.sugarAlcoholsGrams;
          if (facts.netCarbsGrams !== undefined) estimate.nutrition.facts.netCarbsGrams = facts.netCarbsGrams;
          if (facts.saturatedFatGrams !== undefined) estimate.nutrition.facts.saturatedFatGrams = facts.saturatedFatGrams;
          if (facts.transFatGrams !== undefined) estimate.nutrition.facts.transFatGrams = facts.transFatGrams;
          if (facts.polyunsaturatedFatGrams !== undefined) estimate.nutrition.facts.polyunsaturatedFatGrams = facts.polyunsaturatedFatGrams;
          if (facts.monounsaturatedFatGrams !== undefined) estimate.nutrition.facts.monounsaturatedFatGrams = facts.monounsaturatedFatGrams;
          if (facts.cholesterolMg !== undefined) estimate.nutrition.facts.cholesterolMg = facts.cholesterolMg;
          if (facts.sodiumMg !== undefined) estimate.nutrition.facts.sodiumMg = facts.sodiumMg;
          if (facts.calciumMg !== undefined) estimate.nutrition.facts.calciumMg = facts.calciumMg;
          if (facts.ironMg !== undefined) estimate.nutrition.facts.ironMg = facts.ironMg;
          if (facts.potassiumMg !== undefined) estimate.nutrition.facts.potassiumMg = facts.potassiumMg;
          if (facts.vitaminAIu !== undefined) estimate.nutrition.facts.vitaminAIu = facts.vitaminAIu;
          if (facts.vitaminCMg !== undefined) estimate.nutrition.facts.vitaminCMg = facts.vitaminCMg;
          if (facts.vitaminDMcg !== undefined) estimate.nutrition.facts.vitaminDMcg = facts.vitaminDMcg;
        }
      }
      if (!persist) {
        return NextResponse.json({
          ...estimate,
          savedEntries: [],
        });
      }
      const enrichedEntries = await enrichCalorieTrackingEntries(text, answers, {
        userId,
        eventType: "calorie_journal_enrich_entries",
      });
      const assumptions = estimate.assumptions.slice(0, 8);
      const batchId = `calorie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const savedRows: Array<{ id: string; category: "nutrition" | "exercise"; title: string }> = [];
      let nutritionFocusedEntryForAssumptions = "";
      let exerciseFocusedEntryForAssumptions = "";

      if (estimate.intent === "nutrition" || estimate.intent === "mixed") {
        const nutritionEstimate = estimate.nutrition ?? {
          calories: null,
          proteinGrams: null,
          carbsGrams: null,
          fatGrams: null,
          facts: {
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
          },
          notes: "",
        };
        const nutritionFocusedEntry =
          enrichedEntries.nutritionEntry?.trim() ||
          text.trim() ||
          buildNutritionEntryFallback(nutritionEstimate);
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
          nutritionAssumptions.length > 0 ? nutritionAssumptions : assumptions,
          customTag
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
            journalEntryTime,
          }
        );
        savedRows.push({
          id: saved._id,
          category: "nutrition",
          title: saved.videoTitle ?? "Nutrition log",
        });
        await upsertReusableJournalItem(
          userId,
          "nutrition",
          nutritionFocusedEntry,
          pickReusableDisplayName(nutritionFocusedEntry)
        ).catch(() => {});
        await persistReusableTags(userId, "nutrition", nutritionFocusedEntry, customTag, {
          nutritionSnapshot: {
            calories: nutritionEstimate.calories,
            proteinGrams: nutritionEstimate.proteinGrams,
            carbsGrams: nutritionEstimate.carbsGrams,
            fatGrams: nutritionEstimate.fatGrams,
            facts: nutritionEstimate.facts,
          },
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
          exerciseAssumptions.length > 0 ? exerciseAssumptions : assumptions,
          customTag
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
            journalEntryTime,
          }
        );
        savedRows.push({
          id: saved._id,
          category: "exercise",
          title: saved.videoTitle ?? "Exercise log",
        });
        await upsertReusableJournalItem(
          userId,
          "exercise",
          exerciseFocusedEntry,
          pickReusableDisplayName(exerciseFocusedEntry)
        ).catch(() => {});
        await persistReusableTags(userId, "exercise", exerciseFocusedEntry, customTag);
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

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get("kind");
    const q = (searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "8", 10);
    const minUsageRaw = Number.parseInt(searchParams.get("minUsage") ?? "1", 10);
    const kind = kindParam === "exercise" ? "exercise" : kindParam === "nutrition" ? "nutrition" : null;
    if (!kind) {
      return NextResponse.json({ error: "kind must be nutrition or exercise" }, { status: 400 });
    }
    const limit = Number.isFinite(limitRaw) ? limitRaw : 8;
    const minUsage = Number.isFinite(minUsageRaw) ? Math.max(1, minUsageRaw) : 3;
    if (kind === "nutrition") {
      const rows = await getSavedTranscripts(userId);
      const queryLower = q.toLowerCase();
      const nutritionRows = rows
        .filter((row) => row.sourceType === "journal" && row.journalCategory === "nutrition")
        .filter((row) => {
          if (!queryLower) return true;
          const hay = `${row.videoTitle ?? ""} ${row.transcriptText ?? ""}`.toLowerCase();
          return hay.includes(queryLower);
        })
        .slice(0, 250);
      const usageMap = await getReusableNutritionEntryUsageMap(
        userId,
        nutritionRows.map((r) => r._id)
      );
      const mapped = nutritionRows.map((row) => {
        const usage = usageMap[row._id];
        const snapshot = parseNutritionSnapshotFromJournalText(row.transcriptText);
        return {
          id: row._id,
          kind: "nutrition" as const,
          canonicalName: row._id,
          displayName: (row.videoTitle ?? "").trim() || "Nutrition entry",
          sampleEntry: extractEnrichedEntryFromJournalText(row.transcriptText),
          nutritionSnapshot: snapshot,
          usageCount: usage?.usageCount ?? 0,
          lastUsedAt: (usage?.lastUsedAt ?? row.updatedAt ?? row.createdAt).toISOString(),
        };
      });
      mapped.sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      });
      const filteredByUsage = mapped.filter((item) => item.usageCount >= minUsage || minUsage <= 1);
      return NextResponse.json({ items: filteredByUsage.slice(0, limit) });
    }
    const tags = await getReusableJournalTags(userId, kind, q, {
      minUsageCount: minUsage,
      limit,
    });
    const mappedTags = tags.map((item) => ({
      id: item._id,
      kind: item.kind,
      canonicalName: item.tag,
      displayName: item.displayName,
      sampleEntry: item.sampleEntry,
      nutritionSnapshot: item.nutritionSnapshot,
      usageCount: item.usageCount,
      lastUsedAt: item.lastUsedAt,
    }));
    return NextResponse.json({ items: mappedTags });
  } catch (err) {
    console.error("Calorie journal suggestions error:", err);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}

