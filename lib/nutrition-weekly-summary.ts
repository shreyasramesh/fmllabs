export type WeeklySummaryTranscriptRow = {
  sourceType?: "youtube" | "journal";
  journalCategory?: "nutrition" | "exercise";
  journalEntryYear?: number;
  journalEntryMonth?: number;
  journalEntryDay?: number;
  journalEntryHour?: number;
  journalEntryMinute?: number;
  createdAt?: string | Date;
  transcriptText?: string;
};

export type NutritionFatLossMethod = "calorie_counting" | "intermittent_fasting" | "diet_based";
export type NutritionDietTemplate = "balanced" | "low_carb" | "high_protein" | "low_fat";
export type NutritionMethodConfig = {
  intermittentFastingEatingWindowHours?: number;
  dietBasedTemplate?: NutritionDietTemplate;
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
  methodAdherenceScore: number;
  methodAdherent: boolean;
  methodLabel: string;
  methodDetail: string;
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
  methodProgress: {
    method: NutritionFatLossMethod;
    selectedMethods: NutritionFatLossMethod[];
    methodLabel: string;
    summaryText: string;
    adherenceScore: number;
    adherentDays: number;
    trackedMethodDays: number;
    detailNote: string;
    visualizations: Array<{
      method: NutritionFatLossMethod;
      title: string;
      subtitle: string;
      eatingPct: number;
      maintenancePct: number;
      segments: Array<{
        label: string;
        pct: number;
        color: string;
      }>;
      timeline?: {
        startHour: number;
        endHour: number;
        windowHours: number;
        meals: Array<{
          label: string;
          hour: number;
          color: string;
          inWindow: boolean;
        }>;
        entryTimestamps: Array<{
          dayKey: string;
          weekdayLabel: string;
          monthDayLabel: string;
          hour: number;
          minute: number;
        }>;
      };
    }>;
  };
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

function normalizeMethod(value: unknown): NutritionFatLossMethod {
  if (value === "intermittent_fasting" || value === "diet_based") return value;
  return "calorie_counting";
}

function normalizeMethods(
  singleValue: unknown,
  multiValue: unknown
): { selectedMethods: NutritionFatLossMethod[]; primaryMethod: NutritionFatLossMethod } {
  const multi = Array.isArray(multiValue)
    ? multiValue
        .filter(
          (m): m is NutritionFatLossMethod =>
            m === "calorie_counting" || m === "intermittent_fasting" || m === "diet_based"
        )
        .slice(0, 3)
    : [];
  if (multi.length > 0) return { selectedMethods: multi, primaryMethod: multi[0] };
  const primaryMethod = normalizeMethod(singleValue);
  return { selectedMethods: [primaryMethod], primaryMethod };
}

function normalizeMethodConfig(value: unknown): Required<NutritionMethodConfig> {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fastingRaw = typeof obj.intermittentFastingEatingWindowHours === "number"
    ? obj.intermittentFastingEatingWindowHours
    : Number(obj.intermittentFastingEatingWindowHours);
  const fastingHours = Number.isFinite(fastingRaw)
    ? Math.max(4, Math.min(16, Math.round(fastingRaw)))
    : 8;
  const template =
    obj.dietBasedTemplate === "low_carb" ||
    obj.dietBasedTemplate === "high_protein" ||
    obj.dietBasedTemplate === "low_fat" ||
    obj.dietBasedTemplate === "balanced"
      ? obj.dietBasedTemplate
      : "balanced";
  return {
    intermittentFastingEatingWindowHours: fastingHours,
    dietBasedTemplate: template,
  };
}

function getDietTemplatePercents(template: NutritionDietTemplate): { carbs: number; protein: number; fat: number } {
  if (template === "low_carb") return { carbs: 25, protein: 35, fat: 40 };
  if (template === "high_protein") return { carbs: 30, protein: 40, fat: 30 };
  if (template === "low_fat") return { carbs: 50, protein: 30, fat: 20 };
  return { carbs: 40, protein: 30, fat: 30 };
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function normalizeHour(value: number): number {
  const normalized = value % 24;
  return normalized < 0 ? normalized + 24 : normalized;
}

function isHourWithinWindow(hour: number, startHour: number, windowHours: number): boolean {
  const h = normalizeHour(hour);
  const start = normalizeHour(startHour);
  const boundedWindow = Math.max(0, Math.min(24, windowHours));
  if (boundedWindow >= 24) return true;
  const endRaw = start + boundedWindow;
  if (endRaw <= 24) {
    return h >= start && h <= endRaw;
  }
  const wrappedEnd = endRaw - 24;
  return h >= start || h <= wrappedEnd;
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
  methodInput: unknown,
  methodsInput: unknown,
  methodConfigInput: unknown,
  weekOffset = 0,
  now = new Date()
): WeeklySummaryResult {
  const { selectedMethods, primaryMethod: method } = normalizeMethods(methodInput, methodsInput);
  const methodConfig = normalizeMethodConfig(methodConfigInput);
  const normalizedOffset = Number.isFinite(weekOffset) ? Math.max(0, Math.floor(weekOffset)) : 0;
  const currentWeekStart = startOfWeekSunday(now);
  const weekStart = new Date(currentWeekStart);
  weekStart.setDate(currentWeekStart.getDate() - normalizedOffset * 7);
  const rows: WeeklySummaryDayRow[] = [];
  const byDayKey = new Map<string, WeeklySummaryDayRow>();
  let breakfastCount = 0;
  let lunchCount = 0;
  let dinnerCount = 0;
  let otherMealCount = 0;
  const breakfastMarkers: number[] = [];
  const lunchMarkers: number[] = [];
  const dinnerMarkers: number[] = [];
  const nutritionEntryTimestamps: Array<{
    dayKey: string;
    weekdayLabel: string;
    monthDayLabel: string;
    hour: number;
    minute: number;
  }> = [];

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
      methodAdherenceScore: 0,
      methodAdherent: false,
      methodLabel: "",
      methodDetail: "",
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
      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const fallbackHour =
        createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getHours() : null;
      const fallbackMinute =
        createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getMinutes() : 0;
      const hour =
        typeof row.journalEntryHour === "number" && row.journalEntryHour >= 0 && row.journalEntryHour <= 23
          ? row.journalEntryHour
          : fallbackHour;
      const minute =
        typeof row.journalEntryMinute === "number" && row.journalEntryMinute >= 0 && row.journalEntryMinute <= 59
          ? row.journalEntryMinute
          : fallbackMinute;
      const marker = hour == null ? null : hour + minute / 60;
      if (marker !== null) {
        const safeHour = Math.max(0, Math.min(23, Math.floor(hour ?? 0)));
        const safeMinute = Math.max(0, Math.min(59, Math.floor(minute)));
        nutritionEntryTimestamps.push({
          dayKey: day.dayKey,
          weekdayLabel: day.weekdayLabel,
          monthDayLabel: day.monthDayLabel,
          hour: safeHour,
          minute: safeMinute,
        });
        day.methodDetail = day.methodDetail
          ? `${day.methodDetail},${marker.toFixed(2)}`
          : marker.toFixed(2);
        const mealHour = hour;
        if (mealHour != null && mealHour >= 5 && mealHour <= 10) {
          breakfastCount += 1;
          breakfastMarkers.push(marker);
        } else if (mealHour != null && mealHour >= 11 && mealHour <= 15) {
          lunchCount += 1;
          lunchMarkers.push(marker);
        } else if (mealHour != null && mealHour >= 16 && mealHour <= 21) {
          dinnerCount += 1;
          dinnerMarkers.push(marker);
        }
        else otherMealCount += 1;
      }
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
    if (!row.tracked) {
      row.methodLabel = method === "intermittent_fasting" ? "Intermittent fasting" : method === "diet_based" ? "Diet-based" : "Calorie counting";
      row.methodDetail = "No tracked entries";
      continue;
    }
    const markers = row.methodDetail
      ? row.methodDetail
          .split(",")
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v))
      : [];

    const perMethodScores: number[] = [];
    const perMethodDetails: string[] = [];
    for (const selectedMethod of selectedMethods) {
      if (selectedMethod === "intermittent_fasting") {
        const windowHours = methodConfig.intermittentFastingEatingWindowHours;
        const eatingStartHour = 12;
        const eatingEndHour = normalizeHour(eatingStartHour + windowHours);
        const totalMarkers = markers.length;
        const inWindow = markers.filter((h) => isHourWithinWindow(h, eatingStartHour, windowHours)).length;
        // If timestamps are unavailable, keep a neutral score instead of hard-zero.
        const score = totalMarkers > 0 ? Math.round((inWindow / totalMarkers) * 100) : 55;
        perMethodScores.push(score);
        perMethodDetails.push(
          totalMarkers > 0
            ? `IF ${inWindow}/${totalMarkers} in ${windowHours}h window`
            : "IF: no meal timestamps"
        );
        continue;
      }
      if (selectedMethod === "diet_based") {
        const template = methodConfig.dietBasedTemplate;
        const target = getDietTemplatePercents(template);
        const totalMacroCals = row.carbsGrams * 4 + row.proteinGrams * 4 + row.fatGrams * 9;
        if (totalMacroCals <= 0) {
          perMethodScores.push(45);
          perMethodDetails.push("Diet: limited macro data");
          continue;
        }
        const actual = {
          carbs: Math.round((row.carbsGrams * 4 * 100) / totalMacroCals),
          protein: Math.round((row.proteinGrams * 4 * 100) / totalMacroCals),
          fat: Math.max(
            0,
            100 -
              Math.round((row.carbsGrams * 4 * 100) / totalMacroCals) -
              Math.round((row.proteinGrams * 4 * 100) / totalMacroCals)
          ),
        };
        const distance =
          Math.abs(actual.carbs - target.carbs) +
          Math.abs(actual.protein - target.protein) +
          Math.abs(actual.fat - target.fat);
        const score = Math.max(0, Math.min(100, Math.round(100 - distance * 0.6)));
        perMethodScores.push(score);
        perMethodDetails.push(`Diet: ${template.replace("_", " ")} match`);
        continue;
      }
      // Calorie counting: compare food intake to target (exercise shown separately),
      // with a wider tolerance so partial-but-good days still register signal.
      const tolerance = Math.max(180, Math.round(caloriesTargetPerDay * 0.22));
      const delta = Math.abs(row.caloriesFood - caloriesTargetPerDay);
      const score = Math.max(0, Math.min(100, Math.round(100 - (delta / (tolerance * 2)) * 100)));
      perMethodScores.push(score);
      perMethodDetails.push(`Calories within ±${tolerance} kcal`);
    }

    const avgScore =
      perMethodScores.length > 0
        ? Math.round(perMethodScores.reduce((sum, v) => sum + v, 0) / perMethodScores.length)
        : 0;
    row.methodAdherenceScore = avgScore;
    row.methodAdherent = avgScore >= 65;
    row.methodLabel =
      selectedMethods.length > 1
        ? `Combined (${selectedMethods.length} methods)`
        : method === "intermittent_fasting"
          ? "Intermittent fasting"
          : method === "diet_based"
            ? "Diet-based"
            : "Calorie counting";
    row.methodDetail =
      selectedMethods.length > 1
        ? `${perMethodDetails[0] ?? "Combined score"}; +${Math.max(0, perMethodDetails.length - 1)} method signal(s)`
        : perMethodDetails[0] ?? "No method detail";
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
  const trackedMethodDays = rows.filter((row) => row.tracked).length;
  const adherentDays = rows.filter((row) => row.methodAdherent).length;
  const adherenceScore =
    trackedMethodDays > 0
      ? Math.round(
          rows
            .filter((row) => row.tracked)
            .reduce((sum, row) => sum + row.methodAdherenceScore, 0) / trackedMethodDays
        )
      : 0;
  const methodLabel =
    method === "intermittent_fasting"
      ? "Intermittent fasting"
      : method === "diet_based"
        ? "Diet-based"
        : "Calorie counting";
  const detailNote =
    selectedMethods.length > 1
      ? "Combined score averages your selected method signals per day."
      : method === "intermittent_fasting"
        ? `Eating window target: ${methodConfig.intermittentFastingEatingWindowHours} hours`
        : method === "diet_based"
          ? `Template: ${methodConfig.dietBasedTemplate.replace("_", " ")}`
          : "Daily adherence compares food calories against your target tolerance band.";
  const trackedDaysSafe = Math.max(1, trackedDays);
  const avgDailyFoodCalories = totals.caloriesFood / trackedDaysSafe;
  const markerScale = Math.max(
    1,
    caloriesTargetPerDay * 1.18,
    avgDailyFoodCalories * 1.08
  );
  const eatingPct = clampPct((avgDailyFoodCalories / markerScale) * 100);
  const maintenancePct = clampPct((caloriesTargetPerDay / markerScale) * 100);
  const totalMealSignals = breakfastCount + lunchCount + dinnerCount + otherMealCount;
  const breakfastShare = totalMealSignals > 0 ? breakfastCount / totalMealSignals : 0;
  const lunchShare = totalMealSignals > 0 ? lunchCount / totalMealSignals : 0;
  const dinnerShare = totalMealSignals > 0 ? dinnerCount / totalMealSignals : 0;
  const otherShare = totalMealSignals > 0 ? otherMealCount / totalMealSignals : 0;
  const totalMacroCals = totals.carbsGrams * 4 + totals.proteinGrams * 4 + totals.fatGrams * 9;
  const fatShare = totalMacroCals > 0 ? (totals.fatGrams * 9) / totalMacroCals : 0;
  const proteinShare = totalMacroCals > 0 ? (totals.proteinGrams * 4) / totalMacroCals : 0;
  const carbShare = totalMacroCals > 0 ? (totals.carbsGrams * 4) / totalMacroCals : 0;
  const avgDailyNetCalories = (totals.caloriesFood - totals.caloriesExercise) / trackedDaysSafe;
  const avgDailyFatCalories = (totals.fatGrams * 9) / trackedDaysSafe;
  const avgDailyProteinCalories = (totals.proteinGrams * 4) / trackedDaysSafe;
  const avgDailyCarbCalories = (totals.carbsGrams * 4) / trackedDaysSafe;
  const netCaloriesBaseline = Math.max(1, avgDailyNetCalories);
  const calorieCountingEatingPct = 100;
  const calorieCountingMaintenancePct = clampNonNegative(
    (caloriesTargetPerDay / netCaloriesBaseline) * 100
  );
  const calorieCountingFatPct = clampNonNegative((avgDailyFatCalories / netCaloriesBaseline) * 100);
  const calorieCountingProteinPct = clampNonNegative(
    (avgDailyProteinCalories / netCaloriesBaseline) * 100
  );
  const calorieCountingCarbPct = clampNonNegative((avgDailyCarbCalories / netCaloriesBaseline) * 100);
  const visualizations = selectedMethods.map((selectedMethod) => {
    if (selectedMethod === "intermittent_fasting") {
      const segments = [
        { label: "Breakfast", pct: clampPct(eatingPct * breakfastShare), color: "#9ca3af" },
        { label: "Lunch", pct: clampPct(eatingPct * lunchShare), color: "#facc15" },
        { label: "Dinner", pct: clampPct(eatingPct * dinnerShare), color: "#22c55e" },
      ];
      if (otherShare > 0) {
        segments.push({
          label: "Other",
          pct: clampPct(eatingPct * otherShare),
          color: "#94a3b8",
        });
      }
      return {
        method: selectedMethod,
        title: "Intermittent fasting",
        subtitle: `Daily timeline (${methodConfig.intermittentFastingEatingWindowHours}h eating window)`,
        eatingPct,
        maintenancePct,
        segments,
        timeline: {
          startHour: 12,
          endHour: normalizeHour(12 + methodConfig.intermittentFastingEatingWindowHours),
          windowHours: methodConfig.intermittentFastingEatingWindowHours,
          meals: [
            {
              label: "Breakfast",
              hour:
                breakfastMarkers.length > 0
                  ? breakfastMarkers.reduce((sum, h) => sum + h, 0) / breakfastMarkers.length
                  : 8,
              color: "#9ca3af",
              inWindow: isHourWithinWindow(
                breakfastMarkers.length > 0
                  ? breakfastMarkers.reduce((sum, h) => sum + h, 0) / breakfastMarkers.length
                  : 8,
                12,
                methodConfig.intermittentFastingEatingWindowHours
              ),
            },
            {
              label: "Lunch",
              hour: lunchMarkers.length > 0 ? lunchMarkers.reduce((sum, h) => sum + h, 0) / lunchMarkers.length : 13,
              color: "#facc15",
              inWindow: isHourWithinWindow(
                lunchMarkers.length > 0
                  ? lunchMarkers.reduce((sum, h) => sum + h, 0) / lunchMarkers.length
                  : 13,
                12,
                methodConfig.intermittentFastingEatingWindowHours
              ),
            },
            {
              label: "Dinner",
              hour:
                dinnerMarkers.length > 0
                  ? dinnerMarkers.reduce((sum, h) => sum + h, 0) / dinnerMarkers.length
                  : 19,
              color: "#22c55e",
              inWindow: isHourWithinWindow(
                dinnerMarkers.length > 0
                  ? dinnerMarkers.reduce((sum, h) => sum + h, 0) / dinnerMarkers.length
                  : 19,
                12,
                methodConfig.intermittentFastingEatingWindowHours
              ),
            },
          ],
          entryTimestamps: nutritionEntryTimestamps
            .slice()
            .sort((a, b) => {
              if (a.dayKey === b.dayKey) {
                if (a.hour === b.hour) return a.minute - b.minute;
                return a.hour - b.hour;
              }
              return a.dayKey.localeCompare(b.dayKey);
            }),
        },
      };
    }
    if (selectedMethod === "diet_based") {
      return {
        method: selectedMethod,
        title: "Diet-based",
        subtitle: `Macro split (${methodConfig.dietBasedTemplate.replace("_", " ")})`,
        eatingPct,
        maintenancePct,
        segments: [
          { label: "Fat", pct: clampPct(eatingPct * fatShare), color: "#d946ef" },
          { label: "Protein", pct: clampPct(eatingPct * proteinShare), color: "#facc15" },
          { label: "Carbs", pct: clampPct(eatingPct * carbShare), color: "#38bdf8" },
        ],
      };
    }
    return {
      method: selectedMethod,
      title: "Calorie counting",
      subtitle: "100% = average net calories/day (can exceed 100%)",
      eatingPct: calorieCountingEatingPct,
      maintenancePct: calorieCountingMaintenancePct,
      segments: [
        { label: "Fat", pct: calorieCountingFatPct, color: "#d946ef" },
        { label: "Protein", pct: calorieCountingProteinPct, color: "#facc15" },
        { label: "Carbs", pct: calorieCountingCarbPct, color: "#38bdf8" },
      ],
    };
  });

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
    methodProgress: {
      method,
      selectedMethods,
      methodLabel,
      summaryText: `${adherentDays}/${trackedMethodDays} tracked days aligned`,
      adherenceScore,
      adherentDays,
      trackedMethodDays,
      detailNote,
      visualizations,
    },
    totals,
  };
}
