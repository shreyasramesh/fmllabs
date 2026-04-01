import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFocusEntries, getSavedTranscripts, getUserSettings, getWeightEntries } from "@/lib/db";
import { buildWeeklySummary } from "@/lib/nutrition-weekly-summary";
import { recordMongoUsageRequest } from "@/lib/usage";

const DEFAULT_NUTRITION_GOALS = {
  caloriesTarget: 2000,
};

function asFiniteNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toDayKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function extractDurationMinutes(transcriptText: string): number {
  const match = transcriptText.match(/- Duration:\s*([\d.]+)\s*(?:min|mins|minute|minutes)\b/i);
  const raw = match?.[1] ? Number(match[1]) : NaN;
  if (!Number.isFinite(raw)) return 45;
  return Math.max(5, Math.min(360, Math.round(raw)));
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

    const [savedTranscripts, settings, focusEntries, weightEntries] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
      getFocusEntries(userId, { limit: 5000 }),
      getWeightEntries(userId, 1000),
    ]);

    const caloriesTargetPerDay = asFiniteNumberOrFallback(
      settings?.goalCaloriesTarget,
      DEFAULT_NUTRITION_GOALS.caloriesTarget
    );

    const summary = buildWeeklySummary(
      savedTranscripts,
      caloriesTargetPerDay,
      settings?.nutritionFatLossMethod,
      settings?.nutritionFatLossMethods,
      settings?.nutritionMethodConfig,
      weekOffset
    );
    const rowMetaByDayKey = new Map(
      summary.rows.map((r) => [r.dayKey, { weekdayLabel: r.weekdayLabel, monthDayLabel: r.monthDayLabel }])
    );
    const timelineByDay = new Map<
      string,
      Array<{
        type: "nutrition" | "weight" | "exercise" | "focus";
        startMinute: number;
        endMinute: number;
        label: string;
        color: string;
      }>
    >();
    const pushTimelineEvent = (
      dayKey: string,
      event: {
        type: "nutrition" | "weight" | "exercise" | "focus";
        startMinute: number;
        endMinute: number;
        label: string;
        color: string;
      }
    ) => {
      if (!rowMetaByDayKey.has(dayKey)) return;
      const curr = timelineByDay.get(dayKey) ?? [];
      curr.push(event);
      timelineByDay.set(dayKey, curr);
    };

    for (const entry of savedTranscripts) {
      if (entry.sourceType !== "journal") continue;
      if (entry.journalCategory !== "nutrition" && entry.journalCategory !== "exercise") continue;
      const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
      const dayKey =
        typeof entry.journalEntryYear === "number" &&
        typeof entry.journalEntryMonth === "number" &&
        typeof entry.journalEntryDay === "number"
          ? `${String(entry.journalEntryYear).padStart(4, "0")}-${String(entry.journalEntryMonth).padStart(
              2,
              "0"
            )}-${String(entry.journalEntryDay).padStart(2, "0")}`
          : createdAt && !Number.isNaN(createdAt.getTime())
            ? toDayKey(createdAt)
            : null;
      if (!dayKey) continue;
      const hour =
        typeof entry.journalEntryHour === "number"
          ? entry.journalEntryHour
          : createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.getHours()
            : null;
      const minute =
        typeof entry.journalEntryMinute === "number"
          ? entry.journalEntryMinute
          : createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.getMinutes()
            : 0;
      if (hour == null || !Number.isFinite(hour)) continue;
      const startMinute = Math.max(0, Math.min(1439, Math.floor(hour) * 60 + Math.floor(minute)));
      if (entry.journalCategory === "nutrition") {
        pushTimelineEvent(dayKey, {
          type: "nutrition",
          startMinute,
          endMinute: startMinute,
          label: "Nutrition",
          color: "#0ea5e9",
        });
      } else {
        const duration = extractDurationMinutes(entry.transcriptText ?? "");
        pushTimelineEvent(dayKey, {
          type: "exercise",
          startMinute,
          endMinute: Math.max(startMinute + 1, Math.min(1440, startMinute + duration)),
          label: `Exercise (${duration}m)`,
          color: "#f97316",
        });
      }
    }

    const focusByDay = new Map<string, { minutes: number; sessions: number }>();
    for (const entry of focusEntries) {
      const key = `${String(entry.entryYear).padStart(4, "0")}-${String(entry.entryMonth).padStart(2, "0")}-${String(
        entry.entryDay
      ).padStart(2, "0")}`;
      const curr = focusByDay.get(key) ?? { minutes: 0, sessions: 0 };
      curr.minutes += Number.isFinite(entry.minutes) ? entry.minutes : 0;
      curr.sessions += 1;
      focusByDay.set(key, curr);
      const start = new Date(entry.startedAt);
      const end = new Date(entry.endedAt);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const startMinute = Math.max(0, Math.min(1439, start.getHours() * 60 + start.getMinutes()));
        const endMinute = Math.max(startMinute + 1, Math.min(1440, end.getHours() * 60 + end.getMinutes()));
        pushTimelineEvent(key, {
          type: "focus",
          startMinute,
          endMinute,
          label: `Focus (${Math.max(1, Math.round(entry.minutes))}m)`,
          color: "#8b5cf6",
        });
      }
    }
    for (const entry of weightEntries) {
      const recorded = new Date(entry.recordedAt);
      if (Number.isNaN(recorded.getTime())) continue;
      const dayKey = toDayKey(recorded);
      const startMinute = Math.max(0, Math.min(1439, recorded.getHours() * 60 + recorded.getMinutes()));
      pushTimelineEvent(dayKey, {
        type: "weight",
        startMinute,
        endMinute: startMinute,
        label: `Weight (${entry.weightKg.toFixed(1)}kg)`,
        color: "#10b981",
      });
    }
    let totalFocusMinutes = 0;
    let totalFocusSessions = 0;
    const rows = summary.rows.map((row) => {
      const focus = focusByDay.get(row.dayKey) ?? { minutes: 0, sessions: 0 };
      totalFocusMinutes += focus.minutes;
      totalFocusSessions += focus.sessions;
      const timelineEvents = (timelineByDay.get(row.dayKey) ?? []).sort((a, b) => a.startMinute - b.startMinute);
      return {
        ...row,
        focusMinutes: Math.round(focus.minutes),
        focusSessions: focus.sessions,
        timelineEvents,
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
