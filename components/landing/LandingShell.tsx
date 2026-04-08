"use client";

import React, { useState, useEffect, useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { LandingCaffeineChart } from "@/components/landing/LandingCaffeineChart";
import { LandingDateStrip } from "@/components/landing/LandingDateStrip";
import { LandingFocusCanvas } from "@/components/landing/LandingFocusCanvas";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import { LandingThoughtOfTheDayBanner } from "@/components/landing/LandingThoughtOfTheDay";
import { LandingTimelineCard } from "@/components/landing/LandingTimelineCard";
import { LandingHeroHabits } from "@/components/landing/LandingHeroHabits";
import { LandingMobileTabBar, type MobileTab } from "@/components/landing/LandingMobileTabBar";
import { LandingMobileNutritionTab } from "@/components/landing/LandingMobileNutritionTab";
import { LandingMobileWeightTab } from "@/components/landing/LandingMobileWeightTab";
import { LandingMobileSleepTab } from "@/components/landing/LandingMobileSleepTab";
import { LandingMobileHabitsTab } from "@/components/landing/LandingMobileHabitsTab";
import { useTheme } from "@/components/ThemeProvider";
import type { HabitBucket } from "@/lib/habit-buckets";
import type {
  CaffeineFocusWindow,
  CaffeineIntake,
  FocusDurationSuggestion,
  LandingActivityGroupSummary,
  LandingDateItem,
  LandingFigureSummary,
  LandingFocusSummaryRow,
  LandingFoodSuggestion,
  LandingHabitCompletionMap,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingSleepEntry,
  LandingThoughtOfTheDay,
  LandingTimelineEvent,
  LandingWeeklySummaryPreview,
  LandingWeightPoint,
} from "@/components/landing/types";

/** Scroll offset when jumping to #sec-* (sticky in-app chrome + safe area). */
const SECTION_SCROLL_MARGIN =
  "scroll-mt-[calc(6.5rem+env(safe-area-inset-top,0px))] sm:scroll-mt-[calc(5.5rem+env(safe-area-inset-top,0px))]";

const WeightSparkline = React.memo(function WeightSparkline({
  points,
  targetKg,
}: {
  points: LandingWeightPoint[];
  targetKg: number | null;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const options = React.useMemo<Highcharts.Options>(() => {
    if (points.length < 2) return {};
    const weights = points.map((p) => p.weightKg);
    const categories = points.map((p) => p.dateLabel);
    const first = weights[0]!;
    const last = weights[weights.length - 1]!;
    const lineColor = last < first ? "#16a34a" : last > first ? "#dc2626" : "#2563eb";

    const yMin = Math.min(...weights, ...(targetKg != null ? [targetKg] : []));
    const yMax = Math.max(...weights, ...(targetKg != null ? [targetKg] : []));
    const padding = Math.max(0.5, (yMax - yMin) * 0.15);

    const muted = isDark ? "#9ca3af" : "#a3a3a3";
    const grid = isDark ? "rgba(255,255,255,0.12)" : "#f0f0f0";
    const axisLine = isDark ? "#4b5563" : "#e5e5e5";
    const dataLabelOutline = isDark ? "1px rgba(0,0,0,0.75)" : "none";
    const markerRing = isDark ? "rgba(255,255,255,0.92)" : "#fff";

    const plotLines: Highcharts.YAxisPlotLinesOptions[] =
      targetKg != null
        ? [
            {
              value: targetKg,
              color: "#16a34a",
              width: 2,
              dashStyle: "Dash",
              zIndex: 3,
              label: {
                text: `Target: ${targetKg} kg`,
                align: "left",
                verticalAlign: "bottom",
                style: { color: "#4ade80", fontSize: "9px", fontWeight: "600" },
                x: 2,
                y: -3,
              },
            },
          ]
        : [];

    return {
      chart: {
        backgroundColor: "transparent",
        height: 140,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [8, 8, 4, 8],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { enabled: false },
      xAxis: {
        categories,
        lineColor: axisLine,
        tickColor: "transparent",
        labels: { enabled: false },
      },
      yAxis: {
        title: { text: "kg", style: { color: muted, fontSize: "10px" } },
        labels: { style: { color: muted, fontSize: "10px" } },
        min: yMin - padding,
        max: yMax + padding,
        gridLineColor: grid,
        plotLines,
      },
      tooltip: { enabled: false },
      plotOptions: {
        spline: {
          lineWidth: 2.5,
          states: { hover: { lineWidthPlus: 1 } },
        },
      },
      series: [
        {
          type: "spline",
          name: "Weight",
          data: weights,
          color: lineColor,
          marker: {
            enabled: true,
            symbol: "circle",
            radius: 4.5,
            fillColor: lineColor,
            lineColor: markerRing,
            lineWidth: isDark ? 1.5 : 2,
          },
          dataLabels: {
            enabled: true,
            format: "{y:.1f}",
            style: {
              color: isDark ? "#e5e7eb" : lineColor,
              fontSize: "9px",
              fontWeight: "600",
              textOutline: dataLabelOutline,
            },
            y: -8,
          },
        },
      ],
    };
  }, [points, targetKg, isDark]);

  if (points.length < 2) return null;

  return (
    <div className="w-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
});

function ModuleCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="landing-module-glass overflow-hidden rounded-[2rem] border p-4 sm:p-5">
      <h3 className="truncate text-[13px] font-semibold text-foreground">{eyebrow}</h3>
      {description && (
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}

const HABIT_DISCOVERY_BUCKETS: Array<{
  bucket: HabitBucket;
  /** Short label for compact one-row pills (avoids uneven wrap). */
  label: string;
  examples: string;
}> = [
  { bucket: "creative", label: "Creative", examples: "Art, music, writing" },
  { bucket: "intellectual", label: "Intellectual", examples: "Reading, learning, travel" },
  { bucket: "wellbeing", label: "Wellness", examples: "Yoga, meditation, sports" },
  { bucket: "connection", label: "Connection", examples: "Shared meals, rituals, clubs" },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-[#C87B3A]" : "bg-neutral-300 dark:bg-neutral-600"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-[1.1rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SegmentedPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { key: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-300 bg-neutral-100 p-px dark:border-neutral-700 dark:bg-neutral-800">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === opt.key
              ? "bg-white text-foreground shadow-sm dark:bg-neutral-700"
              : "text-neutral-500 hover:text-foreground dark:text-neutral-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChevronRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

interface LandingShellProps {
  dateItems: LandingDateItem[];
  dateStripLabel: string;
  dateStripHint: string;
  /** Short label for the selected dashboard day (e.g. "Today", "Jan 4"). */
  selectedDayLabel: string;
  focusCanvasEyebrow: string;
  focusCanvasTitle: string;
  focusCanvasSubtitle: string;
  nutritionLabel: string;
  caloriesRemainingLabel: string;
  foodLoggedLabel: string;
  carbsLabel: string;
  proteinLabel: string;
  focusSummaryLabel: string;
  noFocusLoggedLabel: string;
  liveFocusLabel: string;
  quickCaptureTitle: string;
  manualFocusLogTitle: string;
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  focusSummaryMinutes: number;
  focusSummarySessions: number;
  focusSummaryRows: LandingFocusSummaryRow[];
  quickCaptures: LandingQuickCaptureItem[];
  pomodoroClockLabel: string;
  pomodoroRunning: boolean;
  pomodoroSessionActive: boolean;
  pomodoroDurationMinutes: number;
  pomodoroCustomMinutesInput: string;
  focusSessionTagInput: string;
  focusTrackerSaving: boolean;
  focusTrackerError: string | null;
  pomodoroJustLogged: boolean;
  customFocusTagInput: string;
  customFocusMinutesInput: string;
  customFocusTimeInput: string;
  onOpenNutrition: () => void;
  onSearchFood: () => void;
  onCaptureFood: () => void;
  onDescribeFood: () => void;
  /** Inline food input state for the mobile nutrition tab. */
  inlineFoodInput: string;
  onInlineFoodInputChange: (value: string) => void;
  onInlineFoodSubmit: () => void;
  inlineFoodLoading: boolean;
  inlineFoodSuggestions: LandingFoodSuggestion[];
  inlineFoodSuggestionsLoading: boolean;
  onInlineFoodSuggestionSelect: (suggestionId: string) => void;
  recentFoodEntries: Array<{ id: string; label: string; calories: number; time: string }>;
  onPomodoroCustomMinutesInputChange: (value: string) => void;
  onApplyCustomPomodoroMinutes: () => void;
  onSelectPomodoroDuration: (minutes: number) => void;
  onFocusSessionTagInputChange: (value: string) => void;
  onStartPomodoro: () => void;
  onPausePomodoro: () => void;
  onResetPomodoro: () => void;
  onEndPomodoro: () => void;
  onCustomFocusTagInputChange: (value: string) => void;
  onCustomFocusMinutesInputChange: (value: string) => void;
  onCustomFocusTimeInputChange: (value: string) => void;
  onAddCustomFocusEntry: () => void;
  activityGroups: LandingActivityGroupSummary[];
  mentors: LandingFigureSummary[];
  mentorCount: number;
  mentalModelCount: number;
  longTermMemoryCount: number;
  conceptCount: number;
  frameworkCount: number;
  perspectiveCardCount: number;
  conversationCount: number;
  weightCurrentKg: number | null;
  weightTargetKg: number | null;
  weightEntryCount: number;
  weightWeekPoints: LandingWeightPoint[];
  onOpenOneOnOneMentor: () => void;
  onSelectMentor: (mentorId: string) => void;
  onOpenAskMentors: () => void;
  askMentorsContent: React.ReactNode;
  onOpenMentalModels: () => void;
  onOpenLearnMentalModel: () => void;
  onOpenPromptGames: () => void;
  onOpenGoals: () => void;
  onOpenWeeklySummary: () => void;
  onOpenHabits: () => void;
  onOpenWeight: () => void;
  mindLabTitle: string;
  mindLabDescription: string;
  mentalModelsLabel: string;
  savedPerspectiveCardsLabel: string;
  conceptsAndPlaygroundsLabel: string;
  savedMemoriesLabel: string;
  learnMentalModelLabel: string;
  promptGamesLabel: string;
  mentorHubTitle: string;
  mentorHubDescription: string;
  followMentorsHint: string;
  mentorChatLabel: string;
  askMentorsLabel: string;
  experimentsLabel: string;
  savedConversationsLabel: string;
  setGoalsLabel: string;
  weeklySummaryLabel: string;
  weightTitle: string;
  weightDescription: string;
  currentWeightLabel: string;
  targetWeightLabel: string;
  noTargetYetLabel: string;
  openLabel: string;
  activityTitle: string;
  activityDescription: string;
  tapToInspectLabel: string;
  timelineEyebrow: string;
  timelineLabel: string;
  timelineEvents: LandingTimelineEvent[];
  onTimelineEventClick?: (event: LandingTimelineEvent) => void;
  caffeineIntakes: CaffeineIntake[];
  caffeineFocusWindow: CaffeineFocusWindow | null;
  featuredMentalModelName: string | null;
  secondOrderCitationsEnabled: boolean;
  onToggleSecondOrderCitations: () => void;
  responseVerbosity: "compact" | "detailed";
  onResponseVerbosityChange: (value: "compact" | "detailed") => void;
  onStartMindLabConversation: () => void;
  onOpenConversations: () => void;
  weeklySummary: LandingWeeklySummaryPreview | null;
  sleepEntries: LandingSleepEntry[];
  /** Calendar day (YYYY-MM-DD) for sleep quick capture — matches the date strip selection. */
  sleepEntryDayKey: string;
  sleepFocusSuggestion: FocusDurationSuggestion | null;
  sleepSaving: boolean;
  onSaveSleepEntry: (sleepHours: number, hrvMs: number | null, sleepScore: number | null) => void;
  onViewSleepInsights?: () => void;
  thoughtOfTheDay: LandingThoughtOfTheDay | null;
  thoughtReviewing: boolean;
  onReviewThought: () => void;
  onOpenThoughtConcept: () => void;
  heroHabits: Array<{ _id: string; name: string }>;
  experimentalHabits: Array<{ _id: string; name: string }>;
  heroHabitCompletions: LandingHabitCompletionMap;
  heroHabitsLabel: string;
  onToggleHabitCompletion: (habitId: string, dateKey: string) => void;
  onOpenHabitDetail: (habitId: string) => void;
  onReorderHeroHabits: (orderedIds: string[]) => void;
  onFindNewHabit: (bucket: HabitBucket) => void;
  /** Scroll container for the dashboard (e.g. chat messages column) — powers section scroll-spy. */
  dashboardScrollRootRef?: React.RefObject<HTMLElement | null>;
}

export function LandingShell({
  dateItems,
  dateStripLabel,
  dateStripHint,
  selectedDayLabel,
  focusCanvasEyebrow,
  focusCanvasTitle,
  focusCanvasSubtitle,
  nutritionLabel,
  caloriesRemainingLabel,
  foodLoggedLabel,
  carbsLabel,
  proteinLabel,
  focusSummaryLabel,
  noFocusLoggedLabel,
  liveFocusLabel,
  quickCaptureTitle,
  manualFocusLogTitle,
  nutrition,
  nutritionGoals,
  focusSummaryMinutes,
  focusSummarySessions,
  focusSummaryRows,
  quickCaptures,
  pomodoroClockLabel,
  pomodoroRunning,
  pomodoroSessionActive,
  pomodoroDurationMinutes,
  pomodoroCustomMinutesInput,
  focusSessionTagInput,
  focusTrackerSaving,
  focusTrackerError,
  pomodoroJustLogged,
  customFocusTagInput,
  customFocusMinutesInput,
  customFocusTimeInput,
  onOpenNutrition,
  onSearchFood,
  onCaptureFood,
  onDescribeFood,
  inlineFoodInput,
  onInlineFoodInputChange,
  onInlineFoodSubmit,
  inlineFoodLoading,
  inlineFoodSuggestions,
  inlineFoodSuggestionsLoading,
  onInlineFoodSuggestionSelect,
  recentFoodEntries,
  onPomodoroCustomMinutesInputChange,
  onApplyCustomPomodoroMinutes,
  onSelectPomodoroDuration,
  onFocusSessionTagInputChange,
  onStartPomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onEndPomodoro,
  onCustomFocusTagInputChange,
  onCustomFocusMinutesInputChange,
  onCustomFocusTimeInputChange,
  onAddCustomFocusEntry,
  activityGroups,
  mentors,
  mentorCount,
  mentalModelCount,
  longTermMemoryCount,
  conceptCount,
  frameworkCount,
  perspectiveCardCount,
  conversationCount,
  weightCurrentKg,
  weightTargetKg,
  weightEntryCount,
  weightWeekPoints,
  onOpenOneOnOneMentor,
  onSelectMentor,
  onOpenAskMentors,
  askMentorsContent,
  onOpenMentalModels,
  onOpenLearnMentalModel,
  onOpenPromptGames,
  onOpenGoals,
  onOpenWeeklySummary,
  onOpenHabits,
  onOpenWeight,
  mindLabTitle,
  mindLabDescription,
  mentalModelsLabel,
  savedPerspectiveCardsLabel,
  conceptsAndPlaygroundsLabel,
  savedMemoriesLabel,
  learnMentalModelLabel,
  promptGamesLabel,
  mentorHubTitle,
  mentorHubDescription,
  followMentorsHint,
  mentorChatLabel,
  askMentorsLabel,
  experimentsLabel,
  savedConversationsLabel,
  setGoalsLabel,
  weeklySummaryLabel,
  weightTitle,
  weightDescription,
  currentWeightLabel,
  targetWeightLabel,
  noTargetYetLabel,
  openLabel,
  activityTitle,
  activityDescription,
  tapToInspectLabel,
  timelineEyebrow,
  timelineLabel,
  timelineEvents,
  onTimelineEventClick,
  caffeineIntakes,
  caffeineFocusWindow,
  featuredMentalModelName,
  secondOrderCitationsEnabled,
  onToggleSecondOrderCitations,
  responseVerbosity,
  onResponseVerbosityChange,
  onStartMindLabConversation,
  onOpenConversations,
  weeklySummary,
  sleepEntries,
  sleepEntryDayKey,
  sleepFocusSuggestion,
  sleepSaving,
  onSaveSleepEntry,
  onViewSleepInsights,
  thoughtOfTheDay,
  thoughtReviewing,
  onReviewThought,
  onOpenThoughtConcept,
  heroHabits,
  experimentalHabits,
  heroHabitCompletions,
  heroHabitsLabel,
  onToggleHabitCompletion,
  onOpenHabitDetail,
  onReorderHeroHabits,
  onFindNewHabit,
  dashboardScrollRootRef,
}: LandingShellProps) {
  const { theme } = useTheme();
  const chartDark = theme === "dark";
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("nutrition");

  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

  const [sleepHoursInput, setSleepHoursInput] = useState("7.5");
  const [hrvInput, setHrvInput] = useState("");
  const [sleepScoreInput, setSleepScoreInput] = useState("");
  const [sleepFormOpen, setSleepFormOpen] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [selectedHabitDiscoveryBucket, setSelectedHabitDiscoveryBucket] = useState<HabitBucket>("creative");

  const sleepForSelectedDay = useMemo(() => {
    const rows = sleepEntries.filter((e) => e.dayKey === sleepEntryDayKey);
    if (rows.length === 0) return null;
    return rows.slice().sort((a, b) => b.id.localeCompare(a.id))[0]!;
  }, [sleepEntries, sleepEntryDayKey]);

  const heroHabitsCompletedToday = useMemo(() => {
    return heroHabits.filter((h) => {
      const dates = heroHabitCompletions[h._id];
      return dates != null && dates.includes(sleepEntryDayKey);
    }).length;
  }, [heroHabits, heroHabitCompletions, sleepEntryDayKey]);

  useEffect(() => {
    if (sleepForSelectedDay) {
      setSleepHoursInput(String(sleepForSelectedDay.sleepHours));
      setHrvInput(sleepForSelectedDay.hrvMs != null ? String(sleepForSelectedDay.hrvMs) : "");
      setSleepScoreInput(sleepForSelectedDay.sleepScore != null ? String(sleepForSelectedDay.sleepScore) : "");
    } else {
      setSleepHoursInput("7.5");
      setHrvInput("");
      setSleepScoreInput("");
    }
  }, [
    sleepEntryDayKey,
    sleepForSelectedDay?.id,
    sleepForSelectedDay?.sleepHours,
    sleepForSelectedDay?.hrvMs,
    sleepForSelectedDay?.sleepScore,
  ]);

  function handleSaveSleep() {
    const hours = parseFloat(sleepHoursInput);
    if (isNaN(hours) || hours < 0.5 || hours > 24) return;
    const hrv = hrvInput.trim() ? parseFloat(hrvInput) : null;
    if (hrv != null && (isNaN(hrv) || hrv < 1 || hrv > 300)) return;
    const score = sleepScoreInput.trim() ? parseFloat(sleepScoreInput) : null;
    if (score != null && (isNaN(score) || score < 1 || score > 100)) return;
    onSaveSleepEntry(
      Math.round(hours * 10) / 10,
      hrv != null ? Math.round(hrv) : null,
      score != null ? Math.round(score) : null,
    );
  }

  const inlineChartBase: Highcharts.Options = useMemo(() => {
    const label = chartDark ? "#d1d5db" : "#525252";
    const line = chartDark ? "#4b5563" : "#e5e5e5";
    const grid = chartDark ? "rgba(255,255,255,0.14)" : "#e5e5e5";
    const legend = chartDark ? "#e5e7eb" : "#525252";
    const chartBackground = chartDark ? "rgba(10, 10, 10, 0.94)" : "transparent";
    return {
      chart: {
        backgroundColor: chartBackground,
        plotBackgroundColor: chartBackground,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: {
        layout: "horizontal",
        align: "left",
        verticalAlign: "bottom",
        margin: 8,
        symbolRadius: 0,
        symbolWidth: 12,
        symbolHeight: 10,
        itemDistance: 10,
        itemStyle: { color: legend, fontSize: "10px" },
      },
      xAxis: { labels: { style: { color: label, fontSize: "10px" } }, lineColor: line, tickColor: line },
      yAxis: {
        title: { text: undefined },
        gridLineColor: grid,
        labels: { style: { color: label, fontSize: "10px" } },
      },
      tooltip: { backgroundColor: "#111827", borderColor: "#1f2937", style: { color: "#f9fafb" }, shared: true },
    };
  }, [chartDark]);

  const weeklyDayLetters = useMemo(
    () => weeklySummary?.rows.map((r) => r.weekdayLabel.slice(0, 1)) ?? [],
    [weeklySummary],
  );

  const weeklyChartTitleStyle = useMemo(
    () => ({ color: chartDark ? "#f3f4f6" : "#111827", fontSize: "13px", fontWeight: "600" as const }),
    [chartDark],
  );

  const weeklyCaloriesOpts = useMemo<Highcharts.Options>(() => {
    if (!weeklySummary) return inlineChartBase;
    return {
      ...inlineChartBase,
      chart: { ...inlineChartBase.chart, type: "column", height: 240 },
      title: { text: "Calories", align: "left", style: weeklyChartTitleStyle },
      xAxis: { ...inlineChartBase.xAxis, categories: weeklyDayLetters },
      yAxis: { ...inlineChartBase.yAxis, allowDecimals: false },
      plotOptions: { column: { borderRadius: 3, pointPadding: 0.08, groupPadding: 0.12, borderWidth: 0 } },
      series: [
        { type: "column" as const, name: "Food", data: weeklySummary.rows.map((r) => r.tracked ? r.caloriesFood : null), color: "#f59e0b" },
        { type: "column" as const, name: "Exercise", data: weeklySummary.rows.map((r) => r.tracked ? r.caloriesExercise : null), color: "#60a5fa" },
        {
          type: "line" as const, name: "Target", data: weeklySummary.rows.map(() => weeklySummary.caloriesTargetPerDay),
          color: "#ef4444", dashStyle: "ShortDash" as Highcharts.DashStyleValue, lineWidth: 1.5, marker: { enabled: false },
          showInLegend: false, enableMouseTracking: false,
        },
      ],
    };
  }, [inlineChartBase, weeklyChartTitleStyle, weeklyDayLetters, weeklySummary]);

  const weeklyMacrosOpts = useMemo<Highcharts.Options>(() => {
    if (!weeklySummary) return inlineChartBase;
    return {
      ...inlineChartBase,
      chart: { ...inlineChartBase.chart, type: "column", height: 240 },
      title: { text: "Macronutrients", align: "left", style: weeklyChartTitleStyle },
      xAxis: { ...inlineChartBase.xAxis, categories: weeklyDayLetters },
      yAxis: { ...inlineChartBase.yAxis, allowDecimals: false },
      plotOptions: { column: { borderRadius: 3, pointPadding: 0.08, groupPadding: 0.12, borderWidth: 0 } },
      series: [
        { type: "column" as const, name: "Carbs", data: weeklySummary.rows.map((r) => r.tracked ? r.carbsGrams : null), color: "#a78bfa" },
        { type: "column" as const, name: "Protein", data: weeklySummary.rows.map((r) => r.tracked ? r.proteinGrams : null), color: "#f472b6" },
        { type: "column" as const, name: "Fat", data: weeklySummary.rows.map((r) => r.tracked ? r.fatGrams : null), color: "#f97316" },
        ...(nutritionGoals.carbsGrams > 0 ? [{
          type: "line" as const, name: "Carbs target", data: weeklySummary.rows.map(() => nutritionGoals.carbsGrams),
          color: "#6366f1", dashStyle: "ShortDash" as Highcharts.DashStyleValue, lineWidth: 1.5, marker: { enabled: false },
          showInLegend: false, enableMouseTracking: false,
        }] : []),
        ...(nutritionGoals.proteinGrams > 0 ? [{
          type: "line" as const, name: "Protein target", data: weeklySummary.rows.map(() => nutritionGoals.proteinGrams),
          color: "#db2777", dashStyle: "ShortDash" as Highcharts.DashStyleValue, lineWidth: 1.5, marker: { enabled: false },
          showInLegend: false, enableMouseTracking: false,
        }] : []),
        ...(nutritionGoals.fatGrams > 0 ? [{
          type: "line" as const, name: "Fat target", data: weeklySummary.rows.map(() => nutritionGoals.fatGrams),
          color: "#ea580c", dashStyle: "ShortDash" as Highcharts.DashStyleValue, lineWidth: 1.5, marker: { enabled: false },
          showInLegend: false, enableMouseTracking: false,
        }] : []),
      ],
    };
  }, [inlineChartBase, nutritionGoals, weeklyChartTitleStyle, weeklyDayLetters, weeklySummary]);

  const weeklyFocusOpts = useMemo<Highcharts.Options>(() => {
    if (!weeklySummary) return inlineChartBase;
    return {
      ...inlineChartBase,
      chart: { ...inlineChartBase.chart, type: "column", height: 240 },
      title: { text: "Focus Time", align: "left", style: weeklyChartTitleStyle },
      xAxis: { ...inlineChartBase.xAxis, categories: weeklyDayLetters },
      yAxis: { ...inlineChartBase.yAxis, allowDecimals: false, labels: { ...((inlineChartBase.yAxis as Highcharts.YAxisOptions)?.labels ?? {}), format: "{value} min" } },
      plotOptions: { column: { borderRadius: 3, pointPadding: 0.08, groupPadding: 0.12, borderWidth: 0 } },
      series: [
        { type: "column" as const, name: "Focus (min)", data: weeklySummary.rows.map((r) => r.tracked ? r.focusMinutes : null), color: "#14b8a6" },
      ],
    };
  }, [inlineChartBase, weeklyChartTitleStyle, weeklyDayLetters, weeklySummary]);

  const mobileTabContent = (() => {
    switch (activeMobileTab) {
      case "nutrition":
        return (
          <LandingMobileNutritionTab
            nutrition={nutrition}
            nutritionGoals={nutritionGoals}
            weeklySummary={weeklySummary}
            onOpenNutrition={onOpenNutrition}
            onSearchFood={onSearchFood}
            onCaptureFood={onCaptureFood}
            inlineFoodInput={inlineFoodInput}
            onInlineFoodInputChange={onInlineFoodInputChange}
            onInlineFoodSubmit={onInlineFoodSubmit}
            inlineFoodLoading={inlineFoodLoading}
            inlineFoodSuggestions={inlineFoodSuggestions}
            inlineFoodSuggestionsLoading={inlineFoodSuggestionsLoading}
            onInlineFoodSuggestionSelect={onInlineFoodSuggestionSelect}
            recentFoodEntries={recentFoodEntries}
          />
        );
      case "weight":
        return (
          <LandingMobileWeightTab
            weightCurrentKg={weightCurrentKg}
            weightTargetKg={weightTargetKg}
            weightEntryCount={weightEntryCount}
            weightWeekPoints={weightWeekPoints}
            weightTitle={weightTitle}
            weightDescription={weightDescription}
            currentWeightLabel={currentWeightLabel}
            targetWeightLabel={targetWeightLabel}
            noTargetYetLabel={noTargetYetLabel}
            openLabel={openLabel}
            onOpenWeight={onOpenWeight}
          />
        );
      case "sleep":
        return (
          <LandingMobileSleepTab
            selectedDayLabel={selectedDayLabel}
            sleepEntries={sleepEntries}
            sleepEntryDayKey={sleepEntryDayKey}
            sleepFocusSuggestion={sleepFocusSuggestion}
            sleepSaving={sleepSaving}
            onSaveSleepEntry={onSaveSleepEntry}
            onViewSleepInsights={onViewSleepInsights}
          />
        );
      case "habits":
        return (
          <LandingMobileHabitsTab
            heroHabits={heroHabits}
            heroHabitCompletions={heroHabitCompletions}
            onToggleHabitCompletion={onToggleHabitCompletion}
            onOpenHabitDetail={onOpenHabitDetail}
            onReorderHeroHabits={onReorderHeroHabits}
            onOpenHabits={onOpenHabits}
            heroHabitsLabel={heroHabitsLabel}
          />
        );
      case "more":
        return null;
    }
  })();

  return (
    <>
      {/* ===== Mobile tabbed layout ===== */}
      <div className="w-full min-w-0 animate-fade-in-up md:hidden">
        <div className="pb-20">
          {activeMobileTab !== "more" ? (
            mobileTabContent
          ) : (
            <div className="space-y-4 px-4">
              {/* Experiments */}
              <ModuleCard eyebrow="This Month's Experiments" title="This Month's Experiments">
                <LandingHeroHabits
                  habits={experimentalHabits}
                  completions={heroHabitCompletions}
                  onToggle={onToggleHabitCompletion}
                  onOpenHabit={onOpenHabitDetail}
                  emptyStateText="No experiments slated for this month yet. Find a new one below."
                />
                <div className="module-nested mt-3 p-3">
                  <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-300">
                    Find a new habit
                  </p>
                  <div className="mt-2.5 flex w-full gap-1.5 sm:gap-2">
                    {HABIT_DISCOVERY_BUCKETS.map((option) => {
                      const isSelected = option.bucket === selectedHabitDiscoveryBucket;
                      return (
                        <button
                          key={option.bucket}
                          type="button"
                          title={option.examples}
                          onClick={() => setSelectedHabitDiscoveryBucket(option.bucket)}
                          className={`flex min-h-[2.5rem] min-w-0 flex-1 items-center justify-center rounded-full border px-1.5 py-2 text-center text-[10px] font-medium leading-tight transition-colors sm:px-2 sm:text-xs ${
                            isSelected
                              ? "border-[#DDB691] bg-[#FBF4EC] text-[#7C522D] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
                              : "border-neutral-300/80 bg-white/70 text-neutral-600 hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
                          }`}
                        >
                          <span className="whitespace-nowrap">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => onFindNewHabit(selectedHabitDiscoveryBucket)}
                    className="mt-2.5 w-full rounded-full border border-[#DDB691] bg-[#FBF4EC] py-2.5 text-xs font-semibold text-[#7C522D] transition-colors hover:bg-[#F5E8D8] dark:border-[#6A4A33] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                  >
                    Find me a new habit
                  </button>
                </div>
              </ModuleCard>

              {/* Timeline */}
              <LandingTimelineCard
                eyebrow={timelineEyebrow}
                dayLabel={timelineLabel}
                events={timelineEvents}
                onTimelineEventClick={onTimelineEventClick}
              />

              {/* Focus Timer */}
              <section className="landing-module-glass flex w-full flex-col overflow-hidden rounded-[2rem] border p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
                  Focus Timer
                </p>
                <p className="landing-focus-timer-clock mt-2 font-black text-foreground">
                  {pomodoroClockLabel}
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {[30, 60, 90].map((minutes) => (
                      <button
                        key={`mobile-focus-timer-dur-${minutes}`}
                        type="button"
                        onClick={() => onSelectPomodoroDuration(minutes)}
                        disabled={focusTrackerSaving || pomodoroSessionActive}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors shadow-sm ${
                          pomodoroDurationMinutes === minutes
                            ? "border-[#B87B51] bg-[#FBF4EC] text-[#7C522D] ring-1 ring-[#B87B51]/25 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:ring-[#D6A67E]/20"
                            : "border-neutral-400/85 bg-white/90 text-neutral-800 hover:shadow-md dark:border-neutral-500/55 dark:bg-neutral-800/95 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:brightness-110"
                        } disabled:opacity-50`}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={focusSessionTagInput}
                    onChange={(event) => onFocusSessionTagInputChange(event.target.value)}
                    placeholder="Tag this focus session..."
                    disabled={focusTrackerSaving}
                    className="w-full rounded-full border border-neutral-400/85 bg-white/95 px-4 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800 dark:shadow-none"
                  />
                  <button
                    type="button"
                    onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
                    disabled={focusTrackerSaving}
                    className="w-full rounded-full border-2 border-[#B87B51] bg-[#FBF4EC] px-5 py-2.5 text-sm font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                  >
                    {pomodoroSessionActive ? (pomodoroRunning ? "Pause" : "Resume") : "Start Focus Session"}
                  </button>
                </div>
              </section>

              {/* Thought of the Day */}
              {thoughtOfTheDay && (
                <LandingThoughtOfTheDayBanner
                  thought={thoughtOfTheDay}
                  onReview={onReviewThought}
                  onOpenConcept={onOpenThoughtConcept}
                  reviewing={thoughtReviewing}
                />
              )}

              {/* Activity */}
              <ModuleCard eyebrow="Activity" title={activityTitle} description={activityDescription}>
                <div className="space-y-3">
                  {activityGroups.length === 0 ? (
                    <p className="text-[13px] text-neutral-500 dark:text-neutral-400">No activity yet for this day.</p>
                  ) : (
                    activityGroups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={group.onClick}
                        className="module-nested flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-shadow hover:shadow-md active:scale-[0.99] dark:hover:brightness-110"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-foreground">{group.label}</span>
                          <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">{tapToInspectLabel}</span>
                        </span>
                        <span className="shrink-0 rounded-full border border-neutral-400/85 bg-white/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-700 ring-1 ring-neutral-900/[0.05] dark:border-neutral-500/60 dark:bg-neutral-900/50 dark:text-neutral-200 dark:ring-white/[0.08]">
                          {group.count}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </ModuleCard>

              {/* Caffeine */}
              <LandingCaffeineChart intakes={caffeineIntakes} focusWindow={caffeineFocusWindow} />

              {/* Mentor Hub */}
              <ModuleCard eyebrow="Mentor Hub" title={mentorHubTitle}>
                <div className="space-y-4">
                  <div className="module-nested p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                      1:1 Mentor Chat
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Pick a mentor for a private coaching conversation.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {mentors.slice(0, 5).map((mentor) => {
                        const isSelected = selectedMentorId === mentor.id;
                        return (
                          <button
                            key={mentor.id}
                            type="button"
                            onClick={() => setSelectedMentorId(isSelected ? null : mentor.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 transition-colors ${
                              isSelected
                                ? "border-[#B87B51] bg-[#FBF4EC] ring-1 ring-[#B87B51]/30 dark:border-[#D6A67E] dark:bg-[#241a14] dark:ring-[#D6A67E]/20"
                                : "border-neutral-300 bg-white hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
                            }`}
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                              style={{ backgroundColor: `hsl(${mentor.hue} 70% 45%)` }}
                            >
                              {mentor.initials}
                            </span>
                            <span className="truncate text-[12px] font-medium text-foreground">{mentor.name}</span>
                          </button>
                        );
                      })}
                      {mentorCount === 0 && (
                        <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{followMentorsHint}</p>
                      )}
                    </div>
                    <div className="mt-2">
                      {selectedMentorId ? (
                        <button
                          type="button"
                          onClick={() => onSelectMentor(selectedMentorId)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                        >
                          Chat with {mentors.find((m) => m.id === selectedMentorId)?.name ?? "mentor"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenOneOnOneMentor}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        >
                          Browse all mentors
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="module-nested p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                      Ask Mentors
                    </p>
                    <p className="mt-0.5 mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Get recommendations from multiple mentors at once.
                    </p>
                    {askMentorsContent}
                  </div>
                </div>
              </ModuleCard>
            </div>
          )}
        </div>
        <LandingMobileTabBar activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />
      </div>

      {/* ===== Desktop stacked layout (unchanged) ===== */}
    <div className="hidden md:block w-full max-w-[88rem] min-w-0 overflow-hidden space-y-4 animate-fade-in-up">
      <LandingDateStrip label={dateStripLabel} hint={dateStripHint} items={dateItems} />

      {/* 1. Focus Canvas + Hero Habits + Quick Capture */}
      <div
        id="sec-focus"
        className={`${SECTION_SCROLL_MARGIN} flex flex-col gap-4 xl:flex-row xl:items-stretch`}
      >
        {/* Left column: Nutrition */}
        <div className="min-w-0 xl:flex-1">
          <LandingFocusCanvas
            eyebrow={focusCanvasEyebrow}
            title={focusCanvasTitle}
            subtitle={focusCanvasSubtitle}
            nutritionLabel={nutritionLabel}
            carbsLabel={carbsLabel}
            proteinLabel={proteinLabel}
            foodLoggedLabel={foodLoggedLabel}
            nutrition={nutrition}
            nutritionGoals={nutritionGoals}
            weeklySummary={weeklySummary}
            focusMinutes={focusSummaryMinutes}
            focusSessions={focusSummarySessions}
            heroHabitCount={heroHabits.length}
            heroHabitsCompletedToday={heroHabitsCompletedToday}
            sleepHours={sleepForSelectedDay?.sleepHours ?? null}
            sleepScore={sleepForSelectedDay?.sleepScore ?? null}
            onOpenNutrition={onOpenNutrition}
            onSearchFood={onSearchFood}
            onCaptureFood={onCaptureFood}
            onDescribeFood={onDescribeFood}
          />
        </div>

        {/* Right column: Hero Habits + Quick Capture (match left height) */}
        <div className="flex min-w-0 flex-col gap-4 xl:flex-1">
          {heroHabits.length > 0 && (
            <ModuleCard eyebrow={heroHabitsLabel} title={heroHabitsLabel}>
              <LandingHeroHabits
                habits={heroHabits}
                completions={heroHabitCompletions}
                onToggle={onToggleHabitCompletion}
                onOpenHabit={onOpenHabitDetail}
              />
            </ModuleCard>
          )}

          {/* Quick Capture */}
          <section className="landing-module-glass flex-1 overflow-hidden rounded-[2rem] border p-4 sm:p-5">
            <h3 className="truncate text-[13px] font-semibold text-foreground">Quick Capture</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {quickCaptures.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="module-nested flex flex-col items-center gap-1 px-1.5 py-2 text-center transition-shadow hover:shadow-md active:scale-[0.98] dark:hover:brightness-110"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">{item.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSleepFormOpen((prev) => !prev)}
                className={`module-nested flex flex-col items-center gap-1 px-1.5 py-2 transition-shadow hover:shadow-md active:scale-[0.98] dark:hover:brightness-110 ${
                  sleepFormOpen
                    ? "ring-2 ring-[#B87B51]/50 ring-offset-2 ring-offset-transparent dark:ring-[#D6A67E]/55"
                    : ""
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-[11px] font-medium text-foreground">Sleep</span>
              </button>
            </div>

            {sleepFormOpen && (
              <div className="module-nested-muted mt-2 space-y-2 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Sleep · {selectedDayLabel}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Sleep (hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={sleepHoursInput}
                      onChange={(e) => setSleepHoursInput(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-neutral-400/85 bg-white px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      HRV (ms)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="300"
                      placeholder="—"
                      value={hrvInput}
                      onChange={(e) => setHrvInput(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-neutral-400/85 bg-white px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      Score (1-100)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      placeholder="—"
                      value={sleepScoreInput}
                      onChange={(e) => setSleepScoreInput(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-neutral-400/85 bg-white px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sleepSaving}
                  onClick={handleSaveSleep}
                  className="w-full rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                >
                  {sleepSaving ? "Saving…" : sleepForSelectedDay ? "Update sleep" : "Save sleep"}
                </button>
                {sleepForSelectedDay ? (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Logged: {sleepForSelectedDay.sleepHours}h sleep
                    {sleepForSelectedDay.hrvMs != null ? ` · ${sleepForSelectedDay.hrvMs} ms HRV` : ""}
                    {sleepForSelectedDay.sleepScore != null ? ` · ${sleepForSelectedDay.sleepScore}/100` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    No sleep logged for this day yet.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Experiments — separate row below focus */}
      <ModuleCard eyebrow="This Month's Experiments" title="This Month's Experiments">
        <LandingHeroHabits
          habits={experimentalHabits}
          completions={heroHabitCompletions}
          onToggle={onToggleHabitCompletion}
          onOpenHabit={onOpenHabitDetail}
          emptyStateText="No experiments slated for this month yet. Find a new one below."
        />
        <div className="module-nested mt-3 p-3">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-300">
            Find a new habit
          </p>
          <div className="mt-2.5 flex w-full gap-1.5 sm:gap-2">
            {HABIT_DISCOVERY_BUCKETS.map((option) => {
              const isSelected = option.bucket === selectedHabitDiscoveryBucket;
              return (
                <button
                  key={option.bucket}
                  type="button"
                  title={option.examples}
                  onClick={() => setSelectedHabitDiscoveryBucket(option.bucket)}
                  className={`flex min-h-[2.5rem] min-w-0 flex-1 items-center justify-center rounded-full border px-1.5 py-2 text-center text-[10px] font-medium leading-tight transition-colors sm:px-2 sm:text-xs ${
                    isSelected
                      ? "border-[#DDB691] bg-[#FBF4EC] text-[#7C522D] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
                      : "border-neutral-300/80 bg-white/70 text-neutral-600 hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
                  }`}
                >
                  <span className="whitespace-nowrap">{option.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onFindNewHabit(selectedHabitDiscoveryBucket)}
            className="mt-2.5 w-full rounded-full border border-[#DDB691] bg-[#FBF4EC] py-2.5 text-xs font-semibold text-[#7C522D] transition-colors hover:bg-[#F5E8D8] dark:border-[#6A4A33] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
          >
            Find me a new habit
          </button>
        </div>
      </ModuleCard>

      {/* 2. Timeline swim lanes — daily activity overview */}
      <div id="sec-timeline" className={SECTION_SCROLL_MARGIN}>
        <LandingTimelineCard
          eyebrow={timelineEyebrow}
          dayLabel={timelineLabel}
          events={timelineEvents}
          onTimelineEventClick={onTimelineEventClick}
        />
      </div>

      {/* 3. Focus Timer */}
      <section className="landing-module-glass flex w-full flex-col overflow-hidden rounded-[2rem] border p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
          Focus Timer
        </p>
        <p className="landing-focus-timer-clock mt-2 font-black text-foreground">
          {pomodoroClockLabel}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[30, 60, 90].map((minutes) => (
              <button
                key={`focus-timer-dur-${minutes}`}
                type="button"
                onClick={() => onSelectPomodoroDuration(minutes)}
                disabled={focusTrackerSaving || pomodoroSessionActive}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors shadow-sm ${
                  pomodoroDurationMinutes === minutes
                    ? "border-[#B87B51] bg-[#FBF4EC] text-[#7C522D] ring-1 ring-[#B87B51]/25 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:ring-[#D6A67E]/20"
                    : "border-neutral-400/85 bg-white/90 text-neutral-800 hover:shadow-md dark:border-neutral-500/55 dark:bg-neutral-800/95 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:brightness-110"
                } disabled:opacity-50`}
              >
                {minutes}m
              </button>
            ))}
          </div>

          <input
            type="text"
            value={focusSessionTagInput}
            onChange={(event) => onFocusSessionTagInputChange(event.target.value)}
            placeholder="Tag this focus session..."
            disabled={focusTrackerSaving}
            className="w-full rounded-full border border-neutral-400/85 bg-white/95 px-4 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800 dark:shadow-none"
          />

          <button
            type="button"
            onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
            disabled={focusTrackerSaving}
            className="w-full rounded-full border-2 border-[#B87B51] bg-[#FBF4EC] px-5 py-2.5 text-sm font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
          >
            {pomodoroSessionActive ? (pomodoroRunning ? "Pause" : "Resume") : "Start Focus Session"}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              step={1}
              value={pomodoroCustomMinutesInput}
              onChange={(event) => onPomodoroCustomMinutesInputChange(event.target.value)}
              disabled={focusTrackerSaving || pomodoroSessionActive}
              className="w-24 rounded-full border border-neutral-400/85 bg-white/95 px-4 py-2 text-sm text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-500/55 dark:bg-neutral-800"
            />
            <button
              type="button"
              onClick={onApplyCustomPomodoroMinutes}
              disabled={focusTrackerSaving || pomodoroSessionActive}
              className="rounded-full border border-neutral-400/85 bg-white/90 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:shadow-md disabled:opacity-50 dark:border-neutral-500/55 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              Set minutes
            </button>
            <button
              type="button"
              onClick={onResetPomodoro}
              disabled={focusTrackerSaving}
              className="rounded-full border border-neutral-400/85 bg-white/90 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:shadow-md disabled:opacity-50 dark:border-neutral-500/55 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              Reset
            </button>
            {pomodoroSessionActive && (
              <button
                type="button"
                onClick={onEndPomodoro}
                disabled={focusTrackerSaving}
                className="rounded-full border-2 border-[#DDAA7C] px-4 py-2 text-sm font-medium text-[#7C522D] shadow-sm transition-colors hover:bg-[#FBF4EC] disabled:opacity-50 dark:border-[#C4A070] dark:text-[#E8C3A0] dark:hover:bg-[#241a14]"
              >
                End
              </button>
            )}
          </div>

          {(focusTrackerError || pomodoroJustLogged) && (
            <p
              className={`text-center text-sm ${
                focusTrackerError
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {focusTrackerError ?? "Focus session logged."}
            </p>
          )}
        </div>

        <div className="hidden">
          <input
            type="text"
            value={customFocusTagInput}
            onChange={(event) => onCustomFocusTagInputChange(event.target.value)}
          />
          <input
            type="number"
            value={customFocusMinutesInput}
            onChange={(event) => onCustomFocusMinutesInputChange(event.target.value)}
          />
          <input
            type="time"
            value={customFocusTimeInput}
            onChange={(event) => onCustomFocusTimeInputChange(event.target.value)}
          />
          <button type="button" onClick={onAddCustomFocusEntry}>
            {manualFocusLogTitle}
          </button>
          <span>{quickCaptureTitle}</span>
          <span>{liveFocusLabel}</span>
          <span>{caloriesRemainingLabel}</span>
        </div>
      </section>

      {/* 4. Thought of the Day banner */}
      {thoughtOfTheDay && (
        <LandingThoughtOfTheDayBanner
          thought={thoughtOfTheDay}
          onReview={onReviewThought}
          onOpenConcept={onOpenThoughtConcept}
          reviewing={thoughtReviewing}
        />
      )}

      {/* 5. Weekly Summary — full-width with inline charts */}
      <div id="sec-summary" className={SECTION_SCROLL_MARGIN}>
        <ModuleCard eyebrow="Weekly Summary" title={weeklySummaryLabel}>
          {weeklySummary ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {weeklySummary.weekStartLabel} – {weeklySummary.weekEndLabel}
                </p>
                <button
                  type="button"
                  onClick={onOpenWeeklySummary}
                  className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-950"
                >
                  Past weeks
                </button>
              </div>

              <div className="mt-2 flex items-center gap-4">
                <div className="flex gap-1">
                  {weeklySummary.rows.map((row) => {
                    const hasActivity = row.foodEntries > 0 || row.exerciseEntries > 0 || row.focusMinutes > 0;
                    return (
                      <div key={row.dayKey} className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500">
                          {row.weekdayLabel.slice(0, 1)}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                            hasActivity
                              ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300"
                              : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                          }`}
                        >
                          {row.foodEntries + row.exerciseEntries || "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-1 gap-1.5 min-w-0">
                  <div className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900 text-center">
                    <p className="text-base font-semibold text-foreground">{weeklySummary.trackedDays}<span className="text-[10px] font-normal text-neutral-400">/7</span></p>
                    <p className="text-[9px] text-neutral-500 dark:text-neutral-400">Days</p>
                  </div>
                  <div className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900 text-center">
                    <p className={`text-base font-semibold ${weeklySummary.caloriesUnderBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {Math.abs(weeklySummary.caloriesUnderBudget).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-neutral-500 dark:text-neutral-400">
                      {weeklySummary.caloriesUnderBudget >= 0 ? "Under" : "Over"}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900 text-center">
                    <p className="text-base font-semibold text-foreground">{weeklySummary.foodEntries}</p>
                    <p className="text-[9px] text-neutral-500 dark:text-neutral-400">Meals</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-neutral-300 dark:border-neutral-600 p-2 bg-white/70 dark:bg-[#0f0f10] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer">
                  <HighchartsReact highcharts={Highcharts} options={weeklyCaloriesOpts} />
                </button>
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-neutral-300 dark:border-neutral-600 p-2 bg-white/70 dark:bg-[#0f0f10] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer">
                  <HighchartsReact highcharts={Highcharts} options={weeklyMacrosOpts} />
                </button>
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-neutral-300 dark:border-neutral-600 p-2 bg-white/70 dark:bg-[#0f0f10] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer lg:col-span-2 xl:col-span-1">
                  <HighchartsReact highcharts={Highcharts} options={weeklyFocusOpts} />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-6 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            </div>
          )}
        </ModuleCard>
      </div>

      {/* Weight · Activity — side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard
          eyebrow="Weight"
          title={weightTitle}
          description={weightDescription}
        >
          {weightWeekPoints.length >= 2 ? (
            <WeightSparkline points={weightWeekPoints} targetKg={weightTargetKg} />
          ) : (
            <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
              {weightWeekPoints.length === 1 ? "Log one more entry to see your trend." : "No entries this week."}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-base font-semibold text-foreground">
                {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)} kg`}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{currentWeightLabel}</p>
            </div>
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-base font-semibold text-foreground">
                {weightTargetKg == null ? "--" : `${weightTargetKg.toFixed(1)} kg`}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{targetWeightLabel}</p>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {distanceToTarget == null ? noTargetYetLabel : `${distanceToTarget} kg to target`}
              {" · "}
              {weightEntryCount} entr{weightEntryCount === 1 ? "y" : "ies"}
            </p>
            <button
              type="button"
              onClick={onOpenWeight}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-950"
            >
              {openLabel}
            </button>
          </div>
        </ModuleCard>

        <div id="sec-activity" className={SECTION_SCROLL_MARGIN}>
        <ModuleCard
          eyebrow="Activity"
          title={activityTitle}
          description={activityDescription}
        >
          <div className="space-y-3">
            {activityGroups.length === 0 ? (
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                No activity yet for this day.
              </p>
            ) : (
              activityGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={group.onClick}
                  className="module-nested flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-shadow hover:shadow-md active:scale-[0.99] dark:hover:brightness-110"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground">{group.label}</span>
                    <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                      {tapToInspectLabel}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-neutral-400/85 bg-white/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-700 ring-1 ring-neutral-900/[0.05] dark:border-neutral-500/60 dark:bg-neutral-900/50 dark:text-neutral-200 dark:ring-white/[0.08]">
                    {group.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </ModuleCard>
        </div>
      </div>


      {/* 6. Caffeine Decay Curve — reference chart */}
      <div id="sec-caffeine" className={SECTION_SCROLL_MARGIN}>
        <LandingCaffeineChart intakes={caffeineIntakes} focusWindow={caffeineFocusWindow} />
      </div>

      {/* 7. Sleep & Recovery — reference chart */}
      <div id="sec-sleep" className={SECTION_SCROLL_MARGIN}>
        <LandingSleepRecoveryChart
          entries={sleepEntries}
          focusSuggestion={sleepFocusSuggestion}
          onViewSleepInsights={onViewSleepInsights}
        />
      </div>

      {/* 8. Mentor Hub — on-demand, lowest daily frequency */}
      <div id="sec-mentor" className={SECTION_SCROLL_MARGIN}>
      <ModuleCard eyebrow="Mentor Hub" title={mentorHubTitle}>
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Left column: structured action groups */}
          <div className="space-y-4">
            {/* Group 1: 1:1 Mentor Chat */}
            <div className="module-nested p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                1:1 Mentor Chat
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Pick a mentor for a private coaching conversation.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {mentors.slice(0, 5).map((mentor) => {
                  const isSelected = selectedMentorId === mentor.id;
                  return (
                    <button
                      key={mentor.id}
                      type="button"
                      onClick={() => setSelectedMentorId(isSelected ? null : mentor.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 transition-colors ${
                        isSelected
                          ? "border-[#B87B51] bg-[#FBF4EC] ring-1 ring-[#B87B51]/30 dark:border-[#D6A67E] dark:bg-[#241a14] dark:ring-[#D6A67E]/20"
                          : "border-neutral-300 bg-white hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: `hsl(${mentor.hue} 70% 45%)` }}
                      >
                        {mentor.initials}
                      </span>
                      <span className="truncate text-[12px] font-medium text-foreground">{mentor.name}</span>
                    </button>
                  );
                })}
                {mentorCount === 0 && (
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{followMentorsHint}</p>
                )}
              </div>
              <div className="mt-2">
                {selectedMentorId ? (
                  <button
                    type="button"
                    onClick={() => onSelectMentor(selectedMentorId)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                  >
                    Chat with {mentors.find((m) => m.id === selectedMentorId)?.name ?? "mentor"}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenOneOnOneMentor}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    Browse all mentors
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Group 2: New Conversation */}
            <div className="module-nested p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                New Conversation
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Start a metacognition session with optional settings.
              </p>
              <div className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
                <ToggleRow
                  label="Show citations"
                  checked={secondOrderCitationsEnabled}
                  onChange={onToggleSecondOrderCitations}
                />
                <ToggleRow
                  label="Detailed responses"
                  checked={responseVerbosity === "detailed"}
                  onChange={() => onResponseVerbosityChange(responseVerbosity === "detailed" ? "compact" : "detailed")}
                />
              </div>
              <button
                type="button"
                onClick={onStartMindLabConversation}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
              >
                Start conversation
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
              {conversationCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenConversations}
                  className="mt-2 flex w-full items-center justify-between text-left transition-colors hover:opacity-70"
                >
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {conversationCount} past conversation{conversationCount !== 1 ? "s" : ""}
                  </p>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {/* Group 3: Explore — mental models and learning */}
            {(featuredMentalModelName || true) && (
              <div className="module-nested p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                  Explore
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Mental models, frameworks, and interactive learning.
                </p>
                <div className="mt-2 space-y-1.5">
                  {featuredMentalModelName && (
                    <button
                      type="button"
                      onClick={onOpenMentalModels}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">{featuredMentalModelName}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Interactive mental model</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-neutral-400">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <ChevronRow label={learnMentalModelLabel} onClick={onOpenLearnMentalModel} />
                </div>
              </div>
            )}
          </div>

          {/* Right column: Ask Mentors */}
          <div>
            <div className="module-nested p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B87B51] dark:text-[#D6A67E]">
                Ask Mentors
              </p>
              <p className="mt-0.5 mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Get recommendations from multiple mentors at once.
              </p>
              {askMentorsContent}
            </div>
          </div>
        </div>
      </ModuleCard>
      </div>

      <div className="border-t border-neutral-300/60 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 dark:border-neutral-600/45 lg:hidden">
        <button
          type="button"
          onClick={() => {
            dashboardScrollRootRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="module-nested w-full py-2.5 text-center text-[12px] font-semibold text-neutral-800 dark:text-neutral-200"
        >
          Back to top
        </button>
      </div>

    </div>
    </>
  );
}
