"use client";

import type { ReactNode } from "react";

export type LandingTabId = "journaling" | "pomodoro" | "deepThinking";

export interface LandingDateItem {
  key: string;
  weekdayLabel: string;
  dateLabel: string;
  selected: boolean;
  struck: boolean;
  onSelect: () => void;
}

export interface LandingQuickCaptureItem {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}

export interface LandingActivityGroupSummary {
  key: string;
  label: string;
  count: number;
  onClick: () => void;
}

export interface LandingFigureSummary {
  id: string;
  name: string;
  description?: string;
  initials: string;
  hue: number;
}

export interface LandingTimelineEvent {
  type: "nutrition" | "weight" | "exercise" | "focus";
  startMinute: number;
  endMinute: number;
  label: string;
  color: string;
}

export interface LandingNutritionSummary {
  caloriesFood: number;
  caloriesExercise: number;
  caloriesRemaining: number;
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
}

export interface LandingNutritionGoals {
  caloriesTarget: number;
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
}

export interface CaffeineIntake {
  minuteOfDay: number;
  mg: number;
}

export interface CaffeineFocusWindow {
  startMinute: number;
  endMinute: number;
}

export interface LandingFocusSummaryRow {
  id: string;
  label: string;
  minutes: number;
}

export interface LandingWeeklySummaryPreview {
  weekStartLabel: string;
  weekEndLabel: string;
  trackedDays: number;
  caloriesUnderBudget: number;
  foodEntries: number;
  exerciseEntries: number;
  focusMinutes: number;
  rows: Array<{
    dayKey: string;
    weekdayLabel: string;
    tracked: boolean;
    foodEntries: number;
    exerciseEntries: number;
    focusMinutes: number;
  }>;
}

export interface LandingSleepEntry {
  sleepHours: number;
  hrvMs: number | null;
  dayKey: string;
}

export interface FocusDurationSuggestion {
  minutes: number;
  reason: string;
}

export interface LandingThoughtOfTheDay {
  conceptId: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
  reviewedToday: boolean;
  daysSinceLastReview: number | null;
  totalReviews: number;
  streak: number;
}
