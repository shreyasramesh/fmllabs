export type WeeklySummaryTranscriptRow = {
  sourceType?: "youtube" | "journal";
  journalCategory?: "nutrition" | "exercise";
  journalEntryYear?: number;
  journalEntryMonth?: number;
  journalEntryDay?: number;
  createdAt?: string | Date;
  transcriptText?: string;
};

export type WeeklySummaryDayRow = {
  dayKey: string;
  weekdayLabel: string;
  monthDayLabel: string;
  caloriesFood: number;
  caloriesExercise: number;
  caloriesRemaining: number;
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
  tracked: boolean;
  foodEntries: number;
  exerciseEntries: number;
};

export type WeeklySummaryResult = {
  weekOffset: number;
  weekStartDayKey: string;
  weekEndDayKey: string;
  weekStartLabel: string;
  weekEndLabel: string;
  caloriesTargetPerDay: number;
  caloriesUnderBudget: number;
  trackedDays: number;
  foodEntries: number;
  exerciseEntries: number;
  rows: WeeklySummaryDayRow[];
  totals: {
    caloriesFood: number;
    caloriesExercise: number;
    caloriesRemaining: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
  };
};

function extractEstimatedNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeyFromTranscriptRow(row: WeeklySummaryTranscriptRow): string | null {
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

function startOfWeekSunday(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = local.getDay();
  local.setDate(local.getDate() - dayOfWeek);
  local.setHours(0, 0, 0, 0);
  return local;
}

export function buildWeeklySummary(
  transcripts: WeeklySummaryTranscriptRow[],
  caloriesTargetPerDay: number,
  weekOffset = 0,
  now = new Date()
): WeeklySummaryResult {
  const normalizedOffset = Number.isFinite(weekOffset) ? Math.max(0, Math.floor(weekOffset)) : 0;
  const currentWeekStart = startOfWeekSunday(now);
  const weekStart = new Date(currentWeekStart);
  weekStart.setDate(currentWeekStart.getDate() - normalizedOffset * 7);
  const rows: WeeklySummaryDayRow[] = [];
  const byDayKey = new Map<string, WeeklySummaryDayRow>();

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dayKey = toDayKey(date);
    const row: WeeklySummaryDayRow = {
      dayKey,
      weekdayLabel: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
      monthDayLabel: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date),
      caloriesFood: 0,
      caloriesExercise: 0,
      caloriesRemaining: 0,
      carbsGrams: 0,
      proteinGrams: 0,
      fatGrams: 0,
      tracked: false,
      foodEntries: 0,
      exerciseEntries: 0,
    };
    rows.push(row);
    byDayKey.set(dayKey, row);
  }

  for (const row of transcripts) {
    if (row.sourceType !== "journal" || !row.transcriptText) continue;
    if (row.journalCategory !== "nutrition" && row.journalCategory !== "exercise") continue;
    const dayKey = dayKeyFromTranscriptRow(row);
    if (!dayKey) continue;
    const day = byDayKey.get(dayKey);
    if (!day) continue;

    day.tracked = true;
    if (row.journalCategory === "nutrition") {
      day.foodEntries += 1;
      const calories = extractEstimatedNumber(row.transcriptText, /- Calories:\s*([\d.]+)\s*kcal/i);
      const carbs = extractEstimatedNumber(row.transcriptText, /- Carbs:\s*([\d.]+)\s*g/i);
      const protein = extractEstimatedNumber(row.transcriptText, /- Protein:\s*([\d.]+)\s*g/i);
      const fat = extractEstimatedNumber(row.transcriptText, /- Fat:\s*([\d.]+)\s*g/i);
      if (calories !== null) day.caloriesFood += calories;
      if (carbs !== null) day.carbsGrams += carbs;
      if (protein !== null) day.proteinGrams += protein;
      if (fat !== null) day.fatGrams += fat;
    } else {
      day.exerciseEntries += 1;
      const burned = extractEstimatedNumber(
        row.transcriptText,
        /- Calories burned:\s*([\d.]+)\s*kcal/i
      );
      if (burned !== null) day.caloriesExercise += burned;
    }
  }

  for (const row of rows) {
    row.caloriesFood = Math.round(row.caloriesFood);
    row.caloriesExercise = Math.round(row.caloriesExercise);
    row.carbsGrams = Math.round(row.carbsGrams);
    row.proteinGrams = Math.round(row.proteinGrams);
    row.fatGrams = Math.round(row.fatGrams);
    row.caloriesRemaining = Math.round(caloriesTargetPerDay - row.caloriesFood + row.caloriesExercise);
  }

  const totals = rows.reduce(
    (acc, row) => ({
      caloriesFood: acc.caloriesFood + row.caloriesFood,
      caloriesExercise: acc.caloriesExercise + row.caloriesExercise,
      caloriesRemaining: acc.caloriesRemaining + row.caloriesRemaining,
      carbsGrams: acc.carbsGrams + row.carbsGrams,
      proteinGrams: acc.proteinGrams + row.proteinGrams,
      fatGrams: acc.fatGrams + row.fatGrams,
    }),
    {
      caloriesFood: 0,
      caloriesExercise: 0,
      caloriesRemaining: 0,
      carbsGrams: 0,
      proteinGrams: 0,
      fatGrams: 0,
    }
  );

  const trackedDays = rows.filter((row) => row.tracked).length;
  const foodEntries = rows.reduce((sum, row) => sum + row.foodEntries, 0);
  const exerciseEntries = rows.reduce((sum, row) => sum + row.exerciseEntries, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    weekOffset: normalizedOffset,
    weekStartDayKey: toDayKey(weekStart),
    weekEndDayKey: toDayKey(weekEnd),
    weekStartLabel: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
      weekStart
    ),
    weekEndLabel: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
      weekEnd
    ),
    caloriesTargetPerDay: Math.round(caloriesTargetPerDay),
    caloriesUnderBudget: Math.round(caloriesTargetPerDay * 7 - (totals.caloriesFood - totals.caloriesExercise)),
    trackedDays,
    foodEntries,
    exerciseEntries,
    rows,
    totals,
  };
}
