import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
} from "@/components/landing/types";

export interface NutritionScoreResult {
  overall: number;
  calorieAdherence: number;
  macroBalance: number;
  label: string;
  /** True when no food has been logged yet — UI should show a prompt instead of a score. */
  empty: boolean;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "optimal";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needs work";
}

/**
 * Pacing-aware adherence: compares current intake against the fraction of the
 * daily goal expected by the current time of day.
 *
 * At 8 AM (start-of-eating ~8 AM assumed) you're expected to have eaten ~0% of
 * your goal; by 8 PM you should be close to 100%. Going over the full-day
 * target is always penalised.
 */
function pacedAdherence(current: number, dailyTarget: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(dailyTarget) || dailyTarget <= 0) return 0;

  if (current > dailyTarget) {
    const overPct = ((current - dailyTarget) / dailyTarget) * 100;
    return Math.max(0, 100 - overPct);
  }

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const EATING_START = 7;
  const EATING_END = 21;
  const dayProgress = Math.max(0, Math.min(1, (hour - EATING_START) / (EATING_END - EATING_START)));
  const expectedSoFar = dailyTarget * dayProgress;

  if (expectedSoFar <= 0) return 100;

  const ratio = current / expectedSoFar;
  if (ratio >= 0.7 && ratio <= 1.3) return 100;
  if (ratio < 0.7) {
    return Math.max(0, 100 - ((0.7 - ratio) / 0.7) * 100);
  }
  return Math.max(0, 100 - ((ratio - 1.3) / 1.3) * 60);
}

/**
 * Macro balance: how evenly distributed protein/carbs/fat are relative to
 * their target ratios. A perfect distribution scores 100.
 */
function macroBalanceScore(
  nutrition: LandingNutritionSummary,
  goals: LandingNutritionGoals,
): number {
  const totalActual = nutrition.proteinGrams + nutrition.carbsGrams + nutrition.fatGrams;
  const totalTarget = goals.proteinGrams + goals.carbsGrams + goals.fatGrams;
  if (totalActual <= 0 || totalTarget <= 0) return 0;

  const actualRatios = [
    nutrition.proteinGrams / totalActual,
    nutrition.carbsGrams / totalActual,
    nutrition.fatGrams / totalActual,
  ];
  const targetRatios = [
    goals.proteinGrams / totalTarget,
    goals.carbsGrams / totalTarget,
    goals.fatGrams / totalTarget,
  ];

  let deviation = 0;
  for (let i = 0; i < 3; i++) {
    deviation += Math.abs(actualRatios[i] - targetRatios[i]);
  }
  return Math.round(Math.max(0, 100 - deviation * 150));
}

export function computeNutritionScore(
  nutrition: LandingNutritionSummary,
  goals: LandingNutritionGoals,
): NutritionScoreResult {
  const hasData =
    nutrition.caloriesFood > 0 ||
    nutrition.proteinGrams > 0 ||
    nutrition.carbsGrams > 0 ||
    nutrition.fatGrams > 0;

  if (!hasData) {
    return { overall: 0, calorieAdherence: 0, macroBalance: 0, label: "", empty: true };
  }

  const calAdh = pacedAdherence(nutrition.caloriesFood, goals.caloriesTarget);
  const protAdh = pacedAdherence(nutrition.proteinGrams, goals.proteinGrams);
  const carbAdh = pacedAdherence(nutrition.carbsGrams, goals.carbsGrams);
  const fatAdh = pacedAdherence(nutrition.fatGrams, goals.fatGrams);
  const macroAvg = Math.round((protAdh + carbAdh + fatAdh) / 3);

  const balance = macroBalanceScore(nutrition, goals);

  const calorieAdherence = Math.round(calAdh);
  const macroScore = Math.round(0.6 * macroAvg + 0.4 * balance);
  const overall = Math.round(0.5 * calAdh + 0.5 * macroScore);

  return {
    overall,
    calorieAdherence,
    macroBalance: macroScore,
    label: scoreLabel(overall),
    empty: false,
  };
}
