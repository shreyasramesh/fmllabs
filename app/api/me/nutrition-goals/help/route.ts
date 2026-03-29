import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscripts, getUserSettings } from "@/lib/db";
import { generateNutritionGoalGuidance } from "@/lib/gemini";
import { buildWeeklySummary } from "@/lib/nutrition-weekly-summary";
import { recordMongoUsageRequest } from "@/lib/usage";

const DEFAULT_NUTRITION_GOALS = {
  caloriesTarget: 2000,
  carbsGrams: 250,
  proteinGrams: 125,
  fatGrams: 56,
};

function asFiniteNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function findMostRecentTrackedWeek(
  savedTranscripts: Awaited<ReturnType<typeof getSavedTranscripts>>,
  caloriesTargetPerDay: number
): {
  summary: ReturnType<typeof buildWeeklySummary>;
  weekOffsetUsed: number;
} | null {
  const MAX_LOOKBACK_WEEKS = 12;
  for (let weekOffset = 0; weekOffset <= MAX_LOOKBACK_WEEKS; weekOffset += 1) {
    const summary = buildWeeklySummary(savedTranscripts, caloriesTargetPerDay, weekOffset);
    if (summary.foodEntries > 0 || summary.exerciseEntries > 0) {
      return { summary, weekOffsetUsed: weekOffset };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as {
      nutritionGoalIntent?: unknown;
    };
    const [savedTranscripts, settings] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
    ]);

    const goals = {
      caloriesTargetPerDay: asFiniteNumberOrFallback(
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

    const userGoalIntentRaw =
      typeof body.nutritionGoalIntent === "string"
        ? body.nutritionGoalIntent
        : settings?.nutritionGoalIntent ?? "";
    const userGoalIntent = userGoalIntentRaw.trim().slice(0, 500);
    if (!userGoalIntent) {
      return NextResponse.json(
        { error: "Please add your nutrition goal first." },
        { status: 400 }
      );
    }

    const trackedWeek = findMostRecentTrackedWeek(
      savedTranscripts,
      goals.caloriesTargetPerDay
    );
    if (!trackedWeek) {
      return NextResponse.json(
        { error: "Not enough nutrition/exercise data from recent weeks yet." },
        { status: 400 }
      );
    }
    const { summary, weekOffsetUsed } = trackedWeek;

    const guidance = await generateNutritionGoalGuidance(
      {
        userGoalIntent,
        periodLabel: `${summary.weekStartLabel} - ${summary.weekEndLabel}`,
        goals,
        weeklyTotals: {
          caloriesFood: summary.totals.caloriesFood,
          caloriesExercise: summary.totals.caloriesExercise,
          carbsGrams: summary.totals.carbsGrams,
          proteinGrams: summary.totals.proteinGrams,
          fatGrams: summary.totals.fatGrams,
          trackedDays: summary.trackedDays,
          foodEntries: summary.foodEntries,
          exerciseEntries: summary.exerciseEntries,
        },
        dailyRows: summary.rows.map((row) => ({
          dayKey: row.dayKey,
          caloriesFood: row.caloriesFood,
          caloriesExercise: row.caloriesExercise,
          carbsGrams: row.carbsGrams,
          proteinGrams: row.proteinGrams,
          fatGrams: row.fatGrams,
          foodEntries: row.foodEntries,
          exerciseEntries: row.exerciseEntries,
        })),
      },
      { userId, eventType: "nutrition_goals_help" }
    );

    return NextResponse.json({
      goalIntent: userGoalIntent,
      periodLabel: `${summary.weekStartLabel} - ${summary.weekEndLabel}`,
      weekOffsetUsed,
      guidance,
    });
  } catch (err) {
    console.error("Nutrition goals help error:", err);
    return NextResponse.json(
      { error: "Failed to generate nutrition coaching help." },
      { status: 500 }
    );
  }
}
