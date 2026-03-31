import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getDailyLifeReport,
  getFocusEntries,
  getLongTermMemories,
  getMessages,
  getSavedTranscripts,
  getSessions,
  getUserSettings,
  upsertDailyLifeReport,
} from "@/lib/db";
import { getFigureById } from "@/lib/famous-figures";
import { generateDailyLifeReport } from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(dayKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function dayKeyFromTranscriptRow(row: {
  journalEntryYear?: number;
  journalEntryMonth?: number;
  journalEntryDay?: number;
  createdAt?: string | Date;
}): string | null {
  if (
    typeof row.journalEntryYear === "number" &&
    typeof row.journalEntryMonth === "number" &&
    typeof row.journalEntryDay === "number"
  ) {
    return toDayKey(new Date(row.journalEntryYear, row.journalEntryMonth - 1, row.journalEntryDay));
  }
  if (row.createdAt) {
    const created = new Date(row.createdAt);
    if (!Number.isNaN(created.getTime())) return toDayKey(created);
  }
  return null;
}

function extractEstimatedNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function summarizeText(text: string, max = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trimEnd()}...`;
}

function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDailyMentor(userId: string, dayKey: string, followedFigureIds: string[]): string | null {
  if (followedFigureIds.length === 0) return null;
  const seed = hashStringToSeed(`${userId}:${dayKey}:daily_report_mentor`);
  const idx = seed % followedFigureIds.length;
  return followedFigureIds[idx] ?? null;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const url = new URL(request.url);
    const rawDayKey = url.searchParams.get("dayKey");
    const dayKey = rawDayKey && dateFromDayKey(rawDayKey) ? rawDayKey : toDayKey(new Date());
    const saved = await getDailyLifeReport(userId, dayKey);
    if (!saved) {
      return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
    }
    return NextResponse.json({
      dayKey: saved.dayKey,
      dayLabel: saved.dayLabel,
      mentorFigureId: saved.mentorFigureId ?? "",
      mentorFigureName: saved.mentorFigureName ?? "",
      report: saved.report,
      snapshot: saved.snapshot,
      generatedAt: saved.generatedAt,
      saved: true,
    });
  } catch (err) {
    console.error("Daily report fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch daily report" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dayScope?: unknown;
      selectedDayKey?: unknown;
    };
    const scope = body.dayScope === "selected_day" ? "selected_day" : "today";
    const todayKey = toDayKey(new Date());
    const selectedDayKey =
      typeof body.selectedDayKey === "string" && dateFromDayKey(body.selectedDayKey)
        ? body.selectedDayKey
        : null;
    const targetDayKey = scope === "selected_day" && selectedDayKey ? selectedDayKey : todayKey;
    const targetDate = dateFromDayKey(targetDayKey) ?? new Date();
    const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
      targetDate
    );

    const [savedTranscripts, settings, focusEntries, longTermMemories, sessions] = await Promise.all([
      getSavedTranscripts(userId),
      getUserSettings(userId),
      getFocusEntries(userId, {
        day: targetDate.getDate(),
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear(),
        limit: 500,
      }),
      getLongTermMemories(userId),
      getSessions(userId),
    ]);

    const dayJournals = savedTranscripts.filter((row) => {
      if (row.sourceType !== "journal" || !row.transcriptText) return false;
      const dayKey = dayKeyFromTranscriptRow(row);
      return dayKey === targetDayKey;
    });
    const nutritionRows = dayJournals.filter((row) => row.journalCategory === "nutrition");
    const exerciseRows = dayJournals.filter((row) => row.journalCategory === "exercise");
    const generalJournalRows = dayJournals.filter((row) => !row.journalCategory);

    let caloriesFood = 0;
    let caloriesExercise = 0;
    let carbsGrams = 0;
    let proteinGrams = 0;
    let fatGrams = 0;
    for (const row of dayJournals) {
      if (row.journalCategory === "nutrition") {
        const calories = extractEstimatedNumber(row.transcriptText, /- Calories:\s*([\d.]+)\s*kcal/i);
        const carbs = extractEstimatedNumber(row.transcriptText, /- Carbs:\s*([\d.]+)\s*g/i);
        const protein = extractEstimatedNumber(row.transcriptText, /- Protein:\s*([\d.]+)\s*g/i);
        const fat = extractEstimatedNumber(row.transcriptText, /- Fat:\s*([\d.]+)\s*g/i);
        if (calories !== null) caloriesFood += calories;
        if (carbs !== null) carbsGrams += carbs;
        if (protein !== null) proteinGrams += protein;
        if (fat !== null) fatGrams += fat;
      }
      if (row.journalCategory === "exercise") {
        const burned = extractEstimatedNumber(
          row.transcriptText,
          /- Calories burned:\s*([\d.]+)\s*kcal/i
        );
        if (burned !== null) caloriesExercise += burned;
      }
    }

    const memoryRows = longTermMemories.filter((m) => {
      const updatedAt = new Date(m.updatedAt);
      if (Number.isNaN(updatedAt.getTime())) return false;
      return toDayKey(updatedAt) === targetDayKey;
    });
    const daySessions = sessions.filter((session) => {
      const updatedAt = new Date(session.updatedAt);
      if (Number.isNaN(updatedAt.getTime())) return false;
      return toDayKey(updatedAt) === targetDayKey;
    });
    const sampledSessions = daySessions.slice(0, 16);
    const dayMessagesBySession = await Promise.all(
      sampledSessions.map(async (session) => {
        const id = session._id;
        if (!id) return [];
        return getMessages(id).catch(() => []);
      })
    );
    const conversationMessagesCount = dayMessagesBySession.reduce((sum, list) => sum + list.length, 0);
    const conversationSnippets = dayMessagesBySession
      .flat()
      .filter((msg) => typeof msg.content === "string" && msg.content.trim().length > 0)
      .slice(-8)
      .map((msg) => summarizeText(msg.content, 140));

    const focusMinutes = focusEntries.reduce((sum, entry) => sum + (Number.isFinite(entry.minutes) ? entry.minutes : 0), 0);
    const focusTags = Array.from(
      new Set(
        focusEntries
          .map((entry) => (typeof entry.tag === "string" ? entry.tag.trim() : ""))
          .filter(Boolean)
          .slice(0, 8)
      )
    );

    const snapshot = {
      conversationsCount: daySessions.length,
      conversationMessagesCount,
      memoriesTouchedCount: memoryRows.length,
      focusSessionsCount: focusEntries.length,
      focusMinutes: Math.max(0, Math.round(focusMinutes)),
      nutritionEntriesCount: nutritionRows.length,
      exerciseEntriesCount: exerciseRows.length,
      journalEntriesCount: generalJournalRows.length,
      caloriesFood: Math.round(caloriesFood),
      caloriesExercise: Math.round(caloriesExercise),
      carbsGrams: Math.round(carbsGrams),
      proteinGrams: Math.round(proteinGrams),
      fatGrams: Math.round(fatGrams),
    };

    const hasMeaningfulData =
      snapshot.conversationsCount > 0 ||
      snapshot.conversationMessagesCount > 0 ||
      snapshot.memoriesTouchedCount > 0 ||
      snapshot.focusSessionsCount > 0 ||
      snapshot.nutritionEntriesCount > 0 ||
      snapshot.exerciseEntriesCount > 0 ||
      snapshot.journalEntriesCount > 0 ||
      snapshot.caloriesFood > 0 ||
      snapshot.caloriesExercise > 0;
    if (!hasMeaningfulData) {
      return NextResponse.json({ error: "No daily activity found for that day." }, { status: 400 });
    }

    const mentorFigureIds = Array.isArray(settings?.followedFigureIds)
      ? settings.followedFigureIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const selectedMentorId = pickDailyMentor(userId, targetDayKey, mentorFigureIds);
    const mentorFigure = selectedMentorId ? getFigureById(selectedMentorId) : null;

    const report = await generateDailyLifeReport(
      {
        dayLabel,
        mentorStyle: mentorFigure
          ? {
              figureId: mentorFigure.id,
              figureName: mentorFigure.name,
              figureDescription: mentorFigure.description,
            }
          : null,
        snapshot,
        excerpts: {
          journal: dayJournals.slice(0, 6).map((row) => summarizeText(row.transcriptText, 180)),
          memories: memoryRows.slice(0, 5).map((row) => summarizeText(row.summary || row.title || "", 160)),
          conversations: conversationSnippets,
          focusTags,
        },
      },
      { userId, eventType: "daily_life_report" }
    );

    await upsertDailyLifeReport(userId, {
      dayKey: targetDayKey,
      dayLabel,
      mentorFigureId: mentorFigure?.id ?? "",
      mentorFigureName: mentorFigure?.name ?? "",
      report,
      snapshot,
      generatedAt: new Date(),
    });

    return NextResponse.json({
      dayKey: targetDayKey,
      dayLabel,
      mentorFigureId: mentorFigure?.id ?? "",
      mentorFigureName: mentorFigure?.name ?? "",
      report,
      snapshot,
      saved: true,
    });
  } catch (err) {
    console.error("Daily report generation error:", err);
    return NextResponse.json({ error: "Failed to generate daily report" }, { status: 500 });
  }
}
