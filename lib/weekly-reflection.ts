import type { SavedTranscript } from "@/lib/db";

export const WEEKLY_REFLECTION_TIMEZONE = "America/New_York";

export type WeeklyReflectionAggregate = {
  weekKey: string;
  weekStartDayKey: string;
  weekEndDayKey: string;
  weekStartLabel: string;
  weekEndLabel: string;
  journalEntries: Array<{
    id: string;
    dayKey: string;
    text: string;
    createdAt?: string;
  }>;
  emotionSignals: string[];
  behaviorSignals: string[];
  followedMentorReflections: Array<{
    figureId: string;
    figureName: string;
    reflection: string;
    dayKey: string;
  }>;
};

function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDayKey(dayKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return dayKey;
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return toDayKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function getTimeZoneDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: weekdayMap[values.weekday ?? "Sun"] ?? 0,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function getCurrentWeekWindow(
  now: Date,
  timeZone = WEEKLY_REFLECTION_TIMEZONE
): {
  weekKey: string;
  weekStartDayKey: string;
  weekEndDayKey: string;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = getTimeZoneDateParts(now, timeZone);
  const currentDayKey = toDayKey(parts.year, parts.month, parts.day);
  const weekStartDayKey = shiftDayKey(currentDayKey, -parts.weekday);
  const weekEndDayKey = shiftDayKey(weekStartDayKey, 6);
  return {
    weekKey: `${weekStartDayKey}_${weekEndDayKey}`,
    weekStartDayKey,
    weekEndDayKey,
    weekday: parts.weekday,
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function isSundayTenAmInTimeZone(
  now: Date,
  timeZone = WEEKLY_REFLECTION_TIMEZONE
): boolean {
  const parts = getTimeZoneDateParts(now, timeZone);
  return parts.weekday === 0 && parts.hour === 10;
}

function dayKeyFromTranscript(
  row: Pick<SavedTranscript, "journalEntryYear" | "journalEntryMonth" | "journalEntryDay" | "createdAt">,
  timeZone = WEEKLY_REFLECTION_TIMEZONE
): string | null {
  if (
    typeof row.journalEntryYear === "number" &&
    typeof row.journalEntryMonth === "number" &&
    typeof row.journalEntryDay === "number"
  ) {
    return toDayKey(row.journalEntryYear, row.journalEntryMonth, row.journalEntryDay);
  }
  if (row.createdAt) {
    const date = new Date(row.createdAt);
    if (!Number.isNaN(date.getTime())) {
      const parts = getTimeZoneDateParts(date, timeZone);
      return toDayKey(parts.year, parts.month, parts.day);
    }
  }
  return null;
}

function collectSignals(texts: string[]): { emotionSignals: string[]; behaviorSignals: string[] } {
  const emotionPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: "stress or overwhelm", pattern: /\b(stress|stressed|overwhelm|anxious|anxiety)\b/i },
    { label: "sadness or low mood", pattern: /\b(sad|down|low|depressed|lonely)\b/i },
    { label: "motivation and optimism", pattern: /\b(motivated|excited|hopeful|optimistic|energized)\b/i },
    { label: "frustration", pattern: /\b(frustrated|annoyed|irritated|angry)\b/i },
  ];
  const behaviorPatterns: Array<{ label: string; pattern: RegExp }> = [
    { label: "routine building", pattern: /\b(routine|habit|consistent|daily|morning)\b/i },
    { label: "planning and organization", pattern: /\b(plan|planning|schedule|organized|priority)\b/i },
    { label: "avoidance or procrastination", pattern: /\b(procrastinat|avoid|delay|stuck)\b/i },
    { label: "reflection and learning", pattern: /\b(reflect|learn|realized|insight|journal)\b/i },
  ];

  const emotionSignals = emotionPatterns
    .filter(({ pattern }) => texts.some((text) => pattern.test(text)))
    .map(({ label }) => label);
  const behaviorSignals = behaviorPatterns
    .filter(({ pattern }) => texts.some((text) => pattern.test(text)))
    .map(({ label }) => label);
  return { emotionSignals, behaviorSignals };
}

export function buildWeeklyReflectionAggregate(args: {
  transcripts: (SavedTranscript & { _id: string })[];
  followedFigureIds: string[];
  now?: Date;
  timeZone?: string;
}): WeeklyReflectionAggregate {
  const now = args.now ?? new Date();
  const timeZone = args.timeZone ?? WEEKLY_REFLECTION_TIMEZONE;
  const week = getCurrentWeekWindow(now, timeZone);
  const journals = args.transcripts.filter(
    (row) => row.sourceType === "journal" && typeof row.transcriptText === "string"
  );

  const journalEntries = journals
    .map((row) => {
      const dayKey = dayKeyFromTranscript(row, timeZone);
      if (!dayKey) return null;
      if (dayKey < week.weekStartDayKey || dayKey > week.weekEndDayKey) return null;
      const text = row.transcriptText?.trim() ?? "";
      if (!text) return null;
      return {
        id: row._id,
        dayKey,
        text,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      };
    })
    .filter((row): row is { id: string; dayKey: string; text: string; createdAt?: string } => row !== null)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const followedSet = new Set(args.followedFigureIds.filter(Boolean));
  const followedMentorReflections = journals.flatMap((row) => {
    const dayKey = dayKeyFromTranscript(row, timeZone);
    if (!dayKey) return [];
    if (dayKey < week.weekStartDayKey || dayKey > week.weekEndDayKey) return [];
    return (row.journalMentorReflections ?? [])
      .filter((item) => followedSet.has(item.figureId))
      .map((item) => ({
        figureId: item.figureId,
        figureName: item.figureName,
        reflection: item.reflection,
        dayKey,
      }));
  });

  const signals = collectSignals(journalEntries.map((entry) => entry.text));
  const formatLabel = (dayKey: string): string => {
    const parsed = parseDayKey(dayKey);
    if (!parsed) return dayKey;
    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  };

  return {
    weekKey: week.weekKey,
    weekStartDayKey: week.weekStartDayKey,
    weekEndDayKey: week.weekEndDayKey,
    weekStartLabel: formatLabel(week.weekStartDayKey),
    weekEndLabel: formatLabel(week.weekEndDayKey),
    journalEntries,
    emotionSignals: signals.emotionSignals,
    behaviorSignals: signals.behaviorSignals,
    followedMentorReflections,
  };
}
