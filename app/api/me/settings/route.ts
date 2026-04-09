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
