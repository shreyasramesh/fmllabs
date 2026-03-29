import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";
import { isValidUserTypeId } from "@/lib/user-types";
import { normalizeReminderPreferences } from "@/lib/reminder-settings";

const TTS_MIN = 0.5;
const TTS_MAX = 2;
const GOAL_CALORIES_MIN = 800;
const GOAL_CALORIES_MAX = 6000;
const GOAL_MACRO_MIN = 10;
const GOAL_MACRO_MAX = 1000;
const BACKGROUND_ELEMENTS = ["default", "air", "water", "earth", "fire"] as const;
const WEATHER_FORMATS = ["condition-temp", "emoji-temp", "temp-only"] as const;
const PREFERRED_NAME_MAX = 80;

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

function isValidWeatherFormat(v: unknown): v is "condition-temp" | "emoji-temp" | "temp-only" {
  return typeof v === "string" && WEATHER_FORMATS.includes(v as (typeof WEATHER_FORMATS)[number]);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    if (body.background !== undefined) {
      if (isValidBackground(body.background)) {
        updates.background = body.background;
      }
    }
    if (body.weatherFormat !== undefined) {
      if (isValidWeatherFormat(body.weatherFormat)) {
        updates.weatherFormat = body.weatherFormat;
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
