import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFocusEntries, getSavedTranscripts, getUserSettings } from "@/lib/db";
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

    const [savedTranscripts, settings, focusEntries] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
      getFocusEntries(userId, { limit: 5000 }),
    ]);

    const caloriesTargetPerDay = asFiniteNumberOrFallback(
      settings?.goalCaloriesTarget,
      DEFAULT_NUTRITION_GOALS.caloriesTarget
    );

    const summary = buildWeeklySummary(savedTranscripts, caloriesTargetPerDay, weekOffset);
    const focusByDay = new Map<string, { minutes: number; sessions: number }>();
    for (const entry of focusEntries) {
      const key = `${String(entry.entryYear).padStart(4, "0")}-${String(entry.entryMonth).padStart(2, "0")}-${String(
        entry.entryDay
      ).padStart(2, "0")}`;
      const curr = focusByDay.get(key) ?? { minutes: 0, sessions: 0 };
      curr.minutes += Number.isFinite(entry.minutes) ? entry.minutes : 0;
      curr.sessions += 1;
      focusByDay.set(key, curr);
    }
    let totalFocusMinutes = 0;
    let totalFocusSessions = 0;
    const rows = summary.rows.map((row) => {
      const focus = focusByDay.get(row.dayKey) ?? { minutes: 0, sessions: 0 };
      totalFocusMinutes += focus.minutes;
      totalFocusSessions += focus.sessions;
      return {
        ...row,
        focusMinutes: Math.round(focus.minutes),
        focusSessions: focus.sessions,
      };
    });
    return NextResponse.json({
      ...summary,
      rows,
      totals: {
        ...summary.totals,
        focusMinutes: totalFocusMinutes,
        focusSessions: totalFocusSessions,
      },
    });
  } catch (err) {
    console.error("Weekly nutrition summary error:", err);
    return NextResponse.json({ error: "Failed to build weekly nutrition summary." }, { status: 500 });
  }
}
