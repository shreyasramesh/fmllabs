import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";
import { isValidUserTypeId } from "@/lib/user-types";

const TTS_MIN = 0.5;
const TTS_MAX = 2;
const BACKGROUND_ELEMENTS = ["default", "air", "water", "earth", "fire"] as const;
const WEATHER_FORMATS = ["condition-temp", "emoji-temp", "temp-only"] as const;

function clampTtsSpeed(v: number): number {
  return Math.max(TTS_MIN, Math.min(TTS_MAX, v));
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
      const v = typeof body.ttsSpeed === "number" ? body.ttsSpeed : parseFloat(body.ttsSpeed);
      if (!Number.isNaN(v)) {
        updates.ttsSpeed = clampTtsSpeed(v);
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
