import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSleepEntries } from "@/lib/db";
import { generateSleepInsightsMarkdown, type SleepInsightsEntry } from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

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
  const rl = rateLimitByUser(userId, { max: 12, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const rows = await getSleepEntries(userId, { limit: 40 });
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Log at least one night of sleep to generate insights." },
        { status: 400 }
      );
    }

    const entries: SleepInsightsEntry[] = rows.map((r) => ({
      dayKey: toDayKey(r),
      sleepHours: r.sleepHours,
      hrvMs: r.hrvMs,
      sleepScore: r.sleepScore,
    }));

    const markdown = await generateSleepInsightsMarkdown(entries, {
      userId,
      eventType: "sleep_insights",
    });

    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("Sleep insights failed:", err);
    return NextResponse.json({ error: "Could not generate sleep insights." }, { status: 500 });
  }
}
