import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscripts, getUserSettings } from "@/lib/db";
import { buildWeeklySummary } from "@/lib/nutrition-weekly-summary";
import { recordMongoUsageRequest } from "@/lib/usage";

const DEFAULT_NUTRITION_GOALS = {
  caloriesTarget: 2000,
};

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
    const body = (await request.json().catch(() => ({}))) as { weekOffset?: unknown };
    const weekOffsetRaw = typeof body.weekOffset === "number" ? body.weekOffset : Number(body.weekOffset);
    const weekOffset = Number.isFinite(weekOffsetRaw) ? Math.max(0, Math.min(12, Math.floor(weekOffsetRaw))) : 0;

    const [savedTranscripts, settings] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
    ]);

    const caloriesTargetPerDay = asFiniteNumberOrFallback(
      settings?.goalCaloriesTarget,
      DEFAULT_NUTRITION_GOALS.caloriesTarget
    );

    const summary = buildWeeklySummary(savedTranscripts, caloriesTargetPerDay, weekOffset);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("Weekly nutrition summary error:", err);
    return NextResponse.json({ error: "Failed to build weekly nutrition summary." }, { status: 500 });
  }
}
