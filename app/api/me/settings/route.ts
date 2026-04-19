import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";
import { isValidUserTypeId } from "@/lib/user-types";
import { normalizeReminderPreferences } from "@/lib/reminder-settings";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const TTS_MIN = 0.5;
const TTS_MAX = 2;
const GOAL_CALORIES_MIN = 800;
const GOAL_CALORIES_MAX = 6000;
const GOAL_MACRO_MIN = 10;
const GOAL_MACRO_MAX = 1000;
const GOAL_SPEND_USD_MIN = 1;
const GOAL_SPEND_USD_MAX = 100_000;
const GOAL_SLEEP_HOURS_MIN = 4;
const GOAL_SLEEP_HOURS_MAX = 12;
const GOAL_EXERCISE_SESSION_MINUTES_MIN = 10;
const GOAL_EXERCISE_SESSION_MINUTES_MAX = 240;
const GOAL_EXERCISE_DAYS_MIN = 1;
const GOAL_EXERCISE_DAYS_MAX = 7;
const BACKGROUND_ELEMENTS = ["default", "air", "water", "earth", "fire"] as const;
const PREFERRED_NAME_MAX = 80;
const NUTRITION_GOAL_INTENT_MAX = 500;
const FASTING_WINDOW_MIN_HOURS = 4;
const FASTING_WINDOW_MAX_HOURS = 16;

function clampTtsSpeed(v: number): number {
  return Math.max(TTS_MIN, Math.min(TTS_MAX, v));
}

function parseNumberish(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampGoalCalories(v: number): number {
  return Math.round(Math.max(GOAL_CALORIES_MIN, Math.min(GOAL_CALORIES_MAX, v)));
}

function clampGoalMacro(v: number): number {
  return Math.round(Math.max(GOAL_MACRO_MIN, Math.min(GOAL_MACRO_MAX, v)));
}

function clampGoalSpendUsd(v: number): number {
  return Math.round(Math.max(GOAL_SPEND_USD_MIN, Math.min(GOAL_SPEND_USD_MAX, v)) * 100) / 100;
}

function clampGoalSleepHours(v: number): number {
  return Math.round(Math.max(GOAL_SLEEP_HOURS_MIN, Math.min(GOAL_SLEEP_HOURS_MAX, v)));
}

function clampGoalExerciseSessionMinutes(v: number): number {
  return Math.round(
    Math.max(GOAL_EXERCISE_SESSION_MINUTES_MIN, Math.min(GOAL_EXERCISE_SESSION_MINUTES_MAX, v))
  );
}

function clampGoalExerciseDays(v: number): number {
  return Math.round(Math.max(GOAL_EXERCISE_DAYS_MIN, Math.min(GOAL_EXERCISE_DAYS_MAX, v)));
}

function isValidBackground(b: unknown): b is "default" | "air" | "water" | "earth" | "fire" {
  return typeof b === "string" && BACKGROUND_ELEMENTS.includes(b as (typeof BACKGROUND_ELEMENTS)[number]);
}

function isNutritionFatLossMethod(
  value: unknown
): value is "calorie_counting" | "intermittent_fasting" | "diet_based" {
  return (
    value === "calorie_counting" ||
    value === "intermittent_fasting" ||
    value === "diet_based"
  );
}

function normalizeNutritionMethodConfig(
  value: unknown
): { intermittentFastingEatingWindowHours?: number; dietBasedTemplate?: "balanced" | "low_carb" | "high_protein" | "low_fat" } {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const next: {
    intermittentFastingEatingWindowHours?: number;
    dietBasedTemplate?: "balanced" | "low_carb" | "high_protein" | "low_fat";
  } = {};
  const fastingHours = parseNumberish(obj.intermittentFastingEatingWindowHours);
  if (fastingHours !== null) {
    next.intermittentFastingEatingWindowHours = Math.round(
      Math.max(FASTING_WINDOW_MIN_HOURS, Math.min(FASTING_WINDOW_MAX_HOURS, fastingHours))
    );
  }
  if (
    obj.dietBasedTemplate === "balanced" ||
    obj.dietBasedTemplate === "low_carb" ||
    obj.dietBasedTemplate === "high_protein" ||
    obj.dietBasedTemplate === "low_fat"
  ) {
    next.dietBasedTemplate = obj.dietBasedTemplate;
  }
  return next;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlGet = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rlGet.allowed) return tooManyRequestsResponse(rlGet.resetMs);
  try {
    const settings = await getUserSettings(userId);
    return NextResponse.json(settings ?? {});
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const updates: Parameters<typeof upsertUserSettings>[1] = {};

    if (body.theme !== undefined) {
      if (body.theme === "light" || body.theme === "dark") {
        updates.theme = body.theme;
      }
    }
    if (body.language !== undefined) {
      if (typeof body.language === "string" && isValidLanguageCode(body.language)) {
        updates.language = body.language;
      }
    }
    if (body.userType !== undefined) {
      if (typeof body.userType === "string" && isValidUserTypeId(body.userType)) {
        updates.userType = body.userType;
      }
    }
    if (body.ttsSpeed !== undefined) {
      const v = parseNumberish(body.ttsSpeed);
      if (v !== null) {
        updates.ttsSpeed = clampTtsSpeed(v);
      }
    }
    if (body.goalCaloriesTarget !== undefined) {
      const v = parseNumberish(body.goalCaloriesTarget);
      if (v !== null) {
        updates.goalCaloriesTarget = clampGoalCalories(v);
      }
    }
    if (body.goalCarbsGrams !== undefined) {
      const v = parseNumberish(body.goalCarbsGrams);
      if (v !== null) {
        updates.goalCarbsGrams = clampGoalMacro(v);
      }
    }
    if (body.goalProteinGrams !== undefined) {
      const v = parseNumberish(body.goalProteinGrams);
      if (v !== null) {
        updates.goalProteinGrams = clampGoalMacro(v);
      }
    }
    if (body.goalFatGrams !== undefined) {
      const v = parseNumberish(body.goalFatGrams);
      if (v !== null) {
        updates.goalFatGrams = clampGoalMacro(v);
      }
    }
    if (body.goalDailySpendUsd !== undefined) {
      const v = parseNumberish(body.goalDailySpendUsd);
      if (v !== null) {
        updates.goalDailySpendUsd = clampGoalSpendUsd(v);
      }
    }
    if (body.goalSleepHours !== undefined) {
      const v = parseNumberish(body.goalSleepHours);
      if (v !== null) {
        updates.goalSleepHours = clampGoalSleepHours(v);
      }
    }
    if (body.goalExerciseSessionMinutes !== undefined) {
      const v = parseNumberish(body.goalExerciseSessionMinutes);
      if (v !== null) {
        updates.goalExerciseSessionMinutes = clampGoalExerciseSessionMinutes(v);
      }
    }
    if (body.goalExerciseDaysOn !== undefined) {
      const v = parseNumberish(body.goalExerciseDaysOn);
      if (v !== null) {
        updates.goalExerciseDaysOn = clampGoalExerciseDays(v);
      }
    }
    if (body.goalExerciseDaysOff !== undefined) {
      const v = parseNumberish(body.goalExerciseDaysOff);
      if (v !== null) {
        updates.goalExerciseDaysOff = clampGoalExerciseDays(v);
      }
    }
    if (body.nutritionFatLossMethod !== undefined && isNutritionFatLossMethod(body.nutritionFatLossMethod)) {
      updates.nutritionFatLossMethod = body.nutritionFatLossMethod;
    }
    if (body.nutritionFatLossMethods !== undefined && Array.isArray(body.nutritionFatLossMethods)) {
      const methods = body.nutritionFatLossMethods
        .filter((m: unknown): m is "calorie_counting" | "intermittent_fasting" | "diet_based" =>
          isNutritionFatLossMethod(m)
        )
        .slice(0, 3);
      if (methods.length > 0) {
        updates.nutritionFatLossMethods = methods;
        updates.nutritionFatLossMethod = methods[0];
      }
    }
    if (body.nutritionMethodConfig !== undefined) {
      updates.nutritionMethodConfig = normalizeNutritionMethodConfig(body.nutritionMethodConfig);
    }
    if (body.nutritionGoalIntent !== undefined) {
      if (typeof body.nutritionGoalIntent === "string") {
        updates.nutritionGoalIntent = body.nutritionGoalIntent.trim().slice(0, NUTRITION_GOAL_INTENT_MAX);
      }
    }
    for (const key of [
      "nutritionActivityLevel", "nutritionDailySteps", "nutritionExerciseFrequency",
      "nutritionSleepQuality", "nutritionStressLevel", "nutritionMealsPerDay",
      "nutritionSnackingFrequency", "nutritionWaterIntake",
    ] as const) {
      if (typeof body[key] === "string") {
        (updates as Record<string, unknown>)[key] = (body[key] as string).slice(0, 50);
      }
    }
    if (Array.isArray(body.nutritionChallenges)) {
      updates.nutritionChallenges = body.nutritionChallenges
        .filter((c: unknown): c is string => typeof c === "string")
        .map((c: string) => c.slice(0, 50))
        .slice(0, 10);
    }
    if (body.background !== undefined) {
      if (isValidBackground(body.background)) {
        updates.background = body.background;
      }
    }
    if (body.clonedVoiceId !== undefined) {
      updates.clonedVoiceId = typeof body.clonedVoiceId === "string" ? body.clonedVoiceId || undefined : undefined;
    }
    if (body.clonedVoiceName !== undefined) {
      updates.clonedVoiceName = typeof body.clonedVoiceName === "string" ? body.clonedVoiceName || undefined : undefined;
    }
    if (body.followedFigureIds !== undefined) {
      if (Array.isArray(body.followedFigureIds)) {
        const ids = body.followedFigureIds
          .filter((id: unknown): id is string => typeof id === "string")
          .slice(0, 500); // Cap at 500
        updates.followedFigureIds = ids;
      }
    }
    if (body.leaderboardOptIn !== undefined) {
      updates.leaderboardOptIn = Boolean(body.leaderboardOptIn);
    }
    if (body.cavemanMode !== undefined) {
      updates.cavemanMode = Boolean(body.cavemanMode);
    }
    if (body.preferredName !== undefined) {
      if (typeof body.preferredName === "string") {
        const t = body.preferredName.trim();
        updates.preferredName = t.length > 0 ? t.slice(0, PREFERRED_NAME_MAX) : "";
      }
    }
    if (body.reminderPreferences !== undefined) {
      updates.reminderPreferences = normalizeReminderPreferences(body.reminderPreferences);
    }

    if (body.birthday !== undefined) {
      if (typeof body.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday)) {
        const d = new Date(body.birthday + "T00:00:00Z");
        const now = new Date();
        const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
        if (!isNaN(d.getTime()) && d < now && d >= minDate) {
          updates.birthday = body.birthday;
        }
      } else if (body.birthday === null || body.birthday === "") {
        updates.birthday = undefined;
      }
    }
    if (body.lifeExpectancyYears !== undefined) {
      const v = parseNumberish(body.lifeExpectancyYears);
      if (v !== null) {
        updates.lifeExpectancyYears = Math.max(50, Math.min(120, Math.round(v)));
      }
    }
    if (body.fireSavingsCurrent !== undefined) {
      const v = parseNumberish(body.fireSavingsCurrent);
      if (v !== null) updates.fireSavingsCurrent = Math.max(0, v);
    }
    if (body.fireTargetAmount !== undefined) {
      const v = parseNumberish(body.fireTargetAmount);
      if (v !== null) updates.fireTargetAmount = Math.max(0, v);
    }
    if (body.fireMonthlyContribution !== undefined) {
      const v = parseNumberish(body.fireMonthlyContribution);
      if (v !== null) updates.fireMonthlyContribution = Math.max(0, v);
    }
    if (body.fireAnnualReturnPct !== undefined) {
      const v = parseNumberish(body.fireAnnualReturnPct);
      if (v !== null) updates.fireAnnualReturnPct = Math.max(0, Math.min(30, v));
    }
    if (body.fireCurrentAge !== undefined) {
      const v = parseNumberish(body.fireCurrentAge);
      if (v !== null) updates.fireCurrentAge = Math.max(1, Math.min(120, Math.round(v)));
    }
    if (body.fireTargetRetirementAge !== undefined) {
      const v = parseNumberish(body.fireTargetRetirementAge);
      if (v !== null) updates.fireTargetRetirementAge = Math.max(1, Math.min(120, Math.round(v)));
    }
    if (body.lifeCountdowns !== undefined) {
      if (Array.isArray(body.lifeCountdowns)) {
        const cleaned = body.lifeCountdowns
          .filter(
            (c: unknown): c is { id: string; label: string; targetDate: string } =>
              typeof c === "object" &&
              c !== null &&
              typeof (c as Record<string, unknown>).id === "string" &&
              typeof (c as Record<string, unknown>).label === "string" &&
              typeof (c as Record<string, unknown>).targetDate === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test((c as Record<string, unknown>).targetDate as string),
          )
          .slice(0, 5)
          .map((c: { id: string; label: string; targetDate: string }) => ({
            id: c.id.slice(0, 36),
            label: c.label.trim().slice(0, 100),
            targetDate: c.targetDate,
          }));
        updates.lifeCountdowns = cleaned;
      } else if (body.lifeCountdowns === null) {
        updates.lifeCountdowns = undefined;
      }
    }

    if (Object.keys(updates).length === 0) {
      const current = await getUserSettings(userId);
      return NextResponse.json(current ?? {});
    }

    const settings = await upsertUserSettings(userId, updates);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("Failed to update settings:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
