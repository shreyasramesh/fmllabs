import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscripts, getUserSettings } from "@/lib/db";
import { generateNutritionDailyReport } from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";

const DEFAULT_NUTRITION_GOALS = {
  caloriesTarget: 2000,
  carbsGrams: 250,
  proteinGrams: 125,
  fatGrams: 56,
};

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(dayKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function dayKeyFromTranscriptRow(row: {
  journalEntryYear?: number;
  journalEntryMonth?: number;
  journalEntryDay?: number;
  createdAt?: string | Date;
}): string | null {
  if (
    typeof row.journalEntryYear === "number" &&
    typeof row.journalEntryMonth === "number" &&
    typeof row.journalEntryDay === "number"
  ) {
    return toDayKey(new Date(row.journalEntryYear, row.journalEntryMonth - 1, row.journalEntryDay));
  }
  if (row.createdAt) {
    const created = new Date(row.createdAt);
    if (!Number.isNaN(created.getTime())) return toDayKey(created);
  }
  return null;
}

function extractEstimatedNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function asFiniteNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as {
      dayScope?: unknown;
      selectedDayKey?: unknown;
      focusPrompt?: unknown;
    };

    const scope = body.dayScope === "selected_day" ? "selected_day" : "today";
    const todayKey = toDayKey(new Date());
    const selectedDayKey =
      typeof body.selectedDayKey === "string" && dateFromDayKey(body.selectedDayKey)
        ? body.selectedDayKey
        : null;
    const targetDayKey = scope === "selected_day" && selectedDayKey ? selectedDayKey : todayKey;
    const focusPrompt =
      typeof body.focusPrompt === "string" ? body.focusPrompt.trim().slice(0, 600) : "";

    const [savedTranscripts, settings] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
    ]);

    const goals = {
      caloriesTarget: asFiniteNumberOrFallback(
        settings?.goalCaloriesTarget,
        DEFAULT_NUTRITION_GOALS.caloriesTarget
      ),
      carbsTargetGrams: asFiniteNumberOrFallback(
        settings?.goalCarbsGrams,
        DEFAULT_NUTRITION_GOALS.carbsGrams
      ),
      proteinTargetGrams: asFiniteNumberOrFallback(
        settings?.goalProteinGrams,
        DEFAULT_NUTRITION_GOALS.proteinGrams
      ),
      fatTargetGrams: asFiniteNumberOrFallback(
        settings?.goalFatGrams,
        DEFAULT_NUTRITION_GOALS.fatGrams
      ),
    };

    let caloriesFood = 0;
    let caloriesExercise = 0;
    let carbsGrams = 0;
    let proteinGrams = 0;
    let fatGrams = 0;

    for (const row of savedTranscripts) {
      if (row.sourceType !== "journal" || !row.transcriptText) continue;
      const dayKey = dayKeyFromTranscriptRow(row);
      if (dayKey !== targetDayKey) continue;

      if (row.journalCategory === "nutrition") {
        const calories = extractEstimatedNumber(row.transcriptText, /- Calories:\s*([\d.]+)\s*kcal/i);
        const carbs = extractEstimatedNumber(row.transcriptText, /- Carbs:\s*([\d.]+)\s*g/i);
        const protein = extractEstimatedNumber(row.transcriptText, /- Protein:\s*([\d.]+)\s*g/i);
        const fat = extractEstimatedNumber(row.transcriptText, /- Fat:\s*([\d.]+)\s*g/i);
        if (calories !== null) caloriesFood += calories;
        if (carbs !== null) carbsGrams += carbs;
        if (protein !== null) proteinGrams += protein;
        if (fat !== null) fatGrams += fat;
      }

      if (row.journalCategory === "exercise") {
        const burned = extractEstimatedNumber(
          row.transcriptText,
          /- Calories burned:\s*([\d.]+)\s*kcal/i
        );
        if (burned !== null) caloriesExercise += burned;
      }
    }

    const totals = {
      caloriesFood: Math.round(caloriesFood),
      caloriesExercise: Math.round(caloriesExercise),
      caloriesRemaining: Math.max(0, Math.round(goals.caloriesTarget - caloriesFood + caloriesExercise)),
      carbsGrams: Math.round(carbsGrams),
      proteinGrams: Math.round(proteinGrams),
      fatGrams: Math.round(fatGrams),
    };

    const hasMeaningfulData =
      totals.caloriesFood > 0 ||
      totals.caloriesExercise > 0 ||
      totals.carbsGrams > 0 ||
      totals.proteinGrams > 0 ||
      totals.fatGrams > 0;

    if (!hasMeaningfulData) {
      return NextResponse.json(
        { error: "No nutrition or exercise activity found for that day." },
        { status: 400 }
      );
    }

    const targetDate = dateFromDayKey(targetDayKey) ?? new Date();
    const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
      targetDate
    );
    const report = await generateNutritionDailyReport(
      {
        dayLabel,
        focusPrompt,
        goals,
        totals,
      },
      { userId, eventType: "nutrition_daily_report" }
    );

    return NextResponse.json({
      dayKey: targetDayKey,
      dayLabel,
      scopeUsed: scope,
      goals,
      totals,
      report,
    });
  } catch (err) {
    console.error("Nutrition report error:", err);
    return NextResponse.json({ error: "Failed to generate nutrition report" }, { status: 500 });
  }
}
