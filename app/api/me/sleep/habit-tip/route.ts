import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSleepEntries, getHabits } from "@/lib/db";
import { generateSleepHabitTip, type SleepHabitTipHabit, type SleepInsightsEntry } from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";
import { getPacificDateParts } from "@/lib/journal-entry-date";

function toDayKey(entry: { entryYear: number; entryMonth: number; entryDay: number }): string {
  return `${String(entry.entryYear).padStart(4, "0")}-${String(entry.entryMonth).padStart(2, "0")}-${String(
    entry.entryDay
  ).padStart(2, "0")}`;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimitByUser(userId, { max: 10, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const [sleepRows, allHabits] = await Promise.all([
      getSleepEntries(userId, { limit: 14 }),
      getHabits(userId),
    ]);

    if (sleepRows.length === 0) {
      return NextResponse.json(
        { error: "Log at least one night of sleep to generate a recommendation." },
        { status: 400 }
      );
    }

    const entries: SleepInsightsEntry[] = sleepRows.map((r) => ({
      dayKey: toDayKey(r),
      sleepHours: r.sleepHours,
      hrvMs: r.hrvMs,
      sleepScore: r.sleepScore,
    }));

    // Hero habits + current-month 30-day experiment habits
    const { month: cm, year: cy } = getPacificDateParts();
    const habits: SleepHabitTipHabit[] = allHabits
      .filter((h) => {
        if (h.isHeroHabit) return true;
        return !h.isHeroHabit && h.intendedMonth === cm && h.intendedYear === cy;
      })
      .map((h) => ({
        name: h.name,
        description: h.description || undefined,
        isHero: !!h.isHeroHabit,
      }));

    const tip = await generateSleepHabitTip(entries, habits, {
      userId,
      eventType: "sleep_habit_tip",
    });

    return NextResponse.json({ tip });
  } catch (err) {
    console.error("Sleep habit tip failed:", err);
    return NextResponse.json({ error: "Could not generate recommendation." }, { status: 500 });
  }
}
