import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
} from "@/components/landing/types";
import { computeNutritionScore } from "@/lib/nutrition-score";

export interface DayScoreResult {
  overall: number;
  nutritionScore: number;
  exerciseScore: number;
  focusScore: number;
  habitsScore: number;
  sleepScore: number;
  label: string;
  empty: boolean;
}

export interface DayScoreInput {
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  focusMinutes: number;
  focusSessions: number;
  heroHabitCount: number;
  heroHabitsCompletedToday: number;
  sleepHours: number | null;
  sleepScore: number | null;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "optimal";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needs work";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nutritionSubScore(nutrition: LandingNutritionSummary, goals: LandingNutritionGoals): number | null {
  const result = computeNutritionScore(nutrition, goals);
  if (result.empty) return null;
  return clamp(Math.round(result.overall / 10), 0, 10);
}

/**
 * Exercise sub-score: ramps linearly from 0 at 0 kcal burned to 10 at 300 kcal.
 * Returns null when no exercise is logged.
 */
function exerciseSubScore(caloriesExercise: number): number | null {
  if (caloriesExercise <= 0) return null;
  const TARGET_KCAL = 300;
  return clamp(Math.round((caloriesExercise / TARGET_KCAL) * 10), 0, 10);
}

/**
 * Focus sub-score: ramps from 0 at 0 min to 10 at 120 min.
 * Returns null when no focus sessions are logged.
 */
function focusSubScore(minutes: number, sessions: number): number | null {
  if (sessions <= 0 || minutes <= 0) return null;
  const TARGET_MINUTES = 120;
  return clamp(Math.round((minutes / TARGET_MINUTES) * 10), 0, 10);
}

/**
 * Habits sub-score: completion rate of hero habits for the day.
 * Returns null when no hero habits are defined.
 */
function habitsSubScore(total: number, completed: number): number | null {
  if (total <= 0) return null;
  return clamp(Math.round((completed / total) * 10), 0, 10);
}

/**
 * Sleep sub-score: 7–9h is optimal (10). Degrades outside that range.
 * If a device-reported sleepScore (0–100) is available, blend it in.
 * Returns null when no sleep data is logged.
 */
function sleepSubScore(hours: number | null, sleepScoreRaw: number | null): number | null {
  if (hours == null || hours <= 0) return null;

  let hoursScore: number;
  if (hours >= 7 && hours <= 9) {
    hoursScore = 10;
  } else if (hours < 7) {
    hoursScore = clamp(Math.round((hours / 7) * 10), 0, 10);
  } else {
    const overHours = hours - 9;
    hoursScore = clamp(Math.round(10 - overHours * 2.5), 0, 10);
  }

  if (sleepScoreRaw != null && sleepScoreRaw > 0) {
    const deviceScore = clamp(Math.round(sleepScoreRaw / 10), 0, 10);
    return clamp(Math.round(0.6 * hoursScore + 0.4 * deviceScore), 0, 10);
  }

  return hoursScore;
}

const WEIGHTS = {
  nutrition: 0.25,
  exercise: 0.15,
  focus: 0.25,
  habits: 0.20,
  sleep: 0.15,
} as const;

export function computeDayScore(input: DayScoreInput): DayScoreResult {
  const ns = nutritionSubScore(input.nutrition, input.nutritionGoals);
  const es = exerciseSubScore(input.nutrition.caloriesExercise);
  const fs = focusSubScore(input.focusMinutes, input.focusSessions);
  const hs = habitsSubScore(input.heroHabitCount, input.heroHabitsCompletedToday);
  const ss = sleepSubScore(input.sleepHours, input.sleepScore);

  const dimensions: Array<{ score: number; weight: number }> = [];
  if (ns != null) dimensions.push({ score: ns, weight: WEIGHTS.nutrition });
  if (es != null) dimensions.push({ score: es, weight: WEIGHTS.exercise });
  if (fs != null) dimensions.push({ score: fs, weight: WEIGHTS.focus });
  if (hs != null) dimensions.push({ score: hs, weight: WEIGHTS.habits });
  if (ss != null) dimensions.push({ score: ss, weight: WEIGHTS.sleep });

  if (dimensions.length === 0) {
    return {
      overall: 0,
      nutritionScore: 0,
      exerciseScore: 0,
      focusScore: 0,
      habitsScore: 0,
      sleepScore: 0,
      label: "",
      empty: true,
    };
  }

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0);
  const overall = clamp(Math.round(weightedSum * 10), 0, 100);

  return {
    overall,
    nutritionScore: ns ?? 0,
    exerciseScore: es ?? 0,
    focusScore: fs ?? 0,
    habitsScore: hs ?? 0,
    sleepScore: ss ?? 0,
    label: scoreLabel(overall),
    empty: false,
  };
}
