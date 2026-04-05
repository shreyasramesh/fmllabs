import type { LandingSleepEntry } from "@/components/landing/types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface SleepScoreResult {
  score: number;
  label: string;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * Compute a 0-100 sleep score. If a user-provided sleepScore exists, use it
 * directly. Otherwise derive from hours slept and optional HRV.
 */
export function computeSleepScore(sleepHours: number, hrvMs: number | null, sleepScore?: number | null): SleepScoreResult {
  if (sleepScore != null && sleepScore >= 1 && sleepScore <= 100) {
    return { score: Math.round(sleepScore), label: scoreLabel(Math.round(sleepScore)) };
  }
  let hoursScore: number;
  if (sleepHours >= 7 && sleepHours <= 9) {
    hoursScore = 100;
  } else if (sleepHours < 7) {
    hoursScore = clamp((sleepHours / 7) * 100, 0, 100);
  } else {
    hoursScore = clamp(100 - ((sleepHours - 9) / 3) * 40, 60, 100);
  }

  let score: number;
  if (hrvMs != null && hrvMs > 0) {
    const hrvScore = clamp((hrvMs / 80) * 100, 0, 100);
    score = Math.round(0.7 * hoursScore + 0.3 * hrvScore);
  } else {
    score = Math.round(hoursScore);
  }

  return { score: clamp(score, 0, 100), label: scoreLabel(score) };
}

export interface SleepInsight {
  message: string;
  trend: "improving" | "declining" | "stable";
}

export function computeSleepInsight(entries: LandingSleepEntry[]): SleepInsight | null {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const last7 = sorted.slice(-7);
  const avg = last7.reduce((sum, e) => sum + e.sleepHours, 0) / last7.length;
  const avgH = Math.floor(avg);
  const avgM = Math.round((avg - avgH) * 60);

  const firstHalf = last7.slice(0, Math.floor(last7.length / 2));
  const secondHalf = last7.slice(Math.floor(last7.length / 2));
  const avgFirst = firstHalf.reduce((s, e) => s + e.sleepHours, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((s, e) => s + e.sleepHours, 0) / (secondHalf.length || 1);

  let trend: SleepInsight["trend"] = "stable";
  let trendText = "staying consistent";
  if (avgSecond - avgFirst > 0.3) {
    trend = "improving";
    trendText = "trending upward";
  } else if (avgFirst - avgSecond > 0.3) {
    trend = "declining";
    trendText = "trending downward";
  }

  const qualifier = avg >= 7 ? "above" : "below";
  const hrvPart = last7.some((e) => e.hrvMs != null)
    ? " Your resting heart rate variability suggests room for deeper recovery."
    : "";

  return {
    message: `Over the past week, you averaged ${avgH}h ${avgM}m of sleep, which is ${qualifier} the recommended 7-9 hour range and ${trendText}.${hrvPart}`,
    trend,
  };
}

export interface SleepBankResult {
  totalMinutes: number;
  label: string;
  type: "surplus" | "deficit" | "balanced";
}

export function computeSleepBank(entries: LandingSleepEntry[], targetHours = 8): SleepBankResult {
  const sorted = [...entries].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const last7 = sorted.slice(-7);
  const totalDiff = last7.reduce((sum, e) => sum + (e.sleepHours - targetHours), 0);
  const totalMinutes = Math.round(Math.abs(totalDiff) * 60);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hLabel = hours > 0 ? `${hours}h ` : "";
  const mLabel = `${mins}m`;

  if (Math.abs(totalDiff) < 0.15) {
    return { totalMinutes: 0, label: "Balanced", type: "balanced" };
  }
  if (totalDiff > 0) {
    return { totalMinutes, label: `${hLabel}${mLabel} Surplus`, type: "surplus" };
  }
  return { totalMinutes, label: `${hLabel}${mLabel} Deficit`, type: "deficit" };
}
