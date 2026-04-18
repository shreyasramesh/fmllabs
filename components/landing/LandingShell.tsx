"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Skeleton } from "boneyard-js/react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { LandingCaffeineChart } from "@/components/landing/LandingCaffeineChart";
import { LandingDateStrip } from "@/components/landing/LandingDateStrip";
import { LandingFocusCanvas } from "@/components/landing/LandingFocusCanvas";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import { LandingThoughtOfTheDayBanner } from "@/components/landing/LandingThoughtOfTheDay";
import { LandingTimelineCard } from "@/components/landing/LandingTimelineCard";
import { LandingHeroHabits } from "@/components/landing/LandingHeroHabits";
import { LandingMobileTabBar, type MobileBottomTab } from "@/components/landing/LandingMobileTabBar";
import { LandingAnonymousFeatureGrid } from "@/components/landing/LandingAnonymousFeatureGrid";
import { LandingMobileNutritionTab } from "@/components/landing/LandingMobileNutritionTab";
import { LandingMobileExerciseTab } from "@/components/landing/LandingMobileExerciseTab";
import { LandingMobileWeightTab } from "@/components/landing/LandingMobileWeightTab";
import { LandingMobileSleepTab } from "@/components/landing/LandingMobileSleepTab";
import { LandingMobileSpendTab } from "@/components/landing/LandingMobileSpendTab";
import { LandingMobileLifeTab } from "@/components/landing/LandingMobileLifeTab";
import { SleepDurationPicker } from "@/components/landing/SleepDurationPicker";
import { formatSleepDuration, roundSleepHoursToMinute } from "@/lib/sleep-duration";
import { useTheme } from "@/components/ThemeProvider";
import type { HabitBucket } from "@/lib/habit-buckets";
import type {
  CaffeineFocusWindow,
  CaffeineIntake,
  FireTrackerData,
  LifeCalendarData,
  LifeCountdown,
  LandingActivityGroupSummary,
  LandingDateItem,
  LandingFigureSummary,
  LandingFocusSummaryRow,
  LandingHabitCompletionMap,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingSpendDaySummary,
  LandingSleepEntry,
  LandingThoughtOfTheDay,
  LandingTimelineEvent,
  LandingWeeklySummaryPreview,
  LandingWeightPoint,
  YearProgressData,
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

    const muted = isDark ? "#87867f" : "#5e5d59";
    const grid = isDark ? "rgba(250,249,245,0.08)" : "#f0eee6";
    const axisLine = isDark ? "#3d3d3a" : "#e8e6dc";
    const dataLabelOutline = isDark ? "1px rgba(20,20,19,0.75)" : "none";
    const markerRing = isDark ? "rgba(250,249,245,0.9)" : "#faf9f5";

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
  const hasDistinctTitle = title.trim().toLowerCase() !== eyebrow.trim().toLowerCase();
  return (
    <section className="landing-module-glass overflow-hidden rounded-[2rem] border p-4 sm:p-5">
      <h3 className="truncate text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">{eyebrow}</h3>
      {title && hasDistinctTitle && (
        <p className="mt-0.5 font-serif text-base font-medium text-[#141413] dark:text-[#faf9f5]">{title}</p>
      )}
      {description && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#5e5d59] dark:text-[#87867f]">{description}</p>
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
          <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-[#c96442]" : "bg-[#d1cfc5] dark:bg-[#4d4c48]"
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
    <div className="inline-flex rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] p-px dark:border-[#3d3d3a] dark:bg-[#30302e]">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-[9px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === opt.key
              ? "bg-[#faf9f5] text-[#141413] shadow-[0px_0px_0px_1px_#d1cfc5] dark:bg-[#4d4c48] dark:text-[#faf9f5]"
              : "text-[#87867f] hover:text-[#4d4c48] dark:text-[#5e5d59] dark:hover:text-[#b0aea5]"
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
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#e8e6dc] px-2.5 py-1.5 text-left text-[13px] font-medium text-[#4d4c48] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
    >
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-[#87867f]">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

interface LandingShellProps {
  dateItems: LandingDateItem[];
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
  onOpenExercise: () => void;
  onSearchFood: () => void;
  onCaptureFood: () => void;
  onDescribeFood: () => void;
  recentFoodEntries: Array<{ id: string; label: string; calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; time: string }>;
  onRecentFoodEntryClick?: (id: string) => void;
  onRecentFoodEntryDelete?: (id: string) => void;
  recentExerciseEntries: Array<{ id: string; label: string; caloriesBurned: number; durationMinutes: number; time: string }>;
  onRecentExerciseEntryClick?: (id: string) => void;
  onRecentExerciseEntryDelete?: (id: string) => void;
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
  spendDaySummary: LandingSpendDaySummary;
  onOpenSpend: () => void;
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
  cavemanMode: boolean;
  onCavemanModeChange: (value: boolean) => void;
  onStartMindLabConversation: () => void;
  onOpenConversations: () => void;
  weeklySummary: LandingWeeklySummaryPreview | null;
  sleepEntries: LandingSleepEntry[];
  /** Calendar day (YYYY-MM-DD) for sleep quick capture — matches the date strip selection. */
  sleepEntryDayKey: string;
  sleepHabitInsight: string | null;
  sleepHabitInsightLoading?: boolean;
  sleepSaving: boolean;
  sleepSaveError: string | null;
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
  /** Mobile exercise tab: daily calorie burn target (derived from nutrition intake goal). */
  exerciseBurnGoalKcal: number;
  /** Mobile exercise tab: target duration for each exercise session. */
  exerciseSessionGoalMinutes: number;
  /** Mobile exercise tab: cadence target active days before rest. */
  exerciseGoalDaysOn: number;
  /** Mobile exercise tab: cadence target rest days after active streak. */
  exerciseGoalDaysOff: number;
  /** Mobile sleep tab: nightly sleep hour target (e.g. 8). */
  sleepHoursGoal: number;
  /** Mobile spend tab: optional USD daily cap from settings; null shows hint to set in Goals. */
  spendBudgetUsd: number | null;
  /** Scroll container for the dashboard (e.g. chat messages column) — powers section scroll-spy. */
  dashboardScrollRootRef?: React.RefObject<HTMLElement | null>;
  /** Mobile first tab: full-screen quick capture (brain dump) UI. */
  mobileQuickNote?: React.ReactNode;
  /** Mobile commonplace book tab. */
  mobileCommonplace?: React.ReactNode;
  /** Mobile "More" tab — library / sidebar body (signed-in nav or anonymous upsell). */
  mobileAndMore?: React.ReactNode;
  /** When set, parent can call ref.current to switch to the And More tab (e.g. feature tour). */
  mobileLibraryTabOpenerRef?: React.MutableRefObject<(() => void) | null>;
  /** Mobile landing: point feature tour "menu" step at More tab instead of header hamburger. */
  menuTourOnAndMoreTab?: boolean;
  /**
   * When true, the mobile landing body is replaced with a feature grid that
   * prompts the visitor to sign in. The bottom tab bar is also hidden since
   * every feature surfaces the same sign-in CTA via {@link onAnonymousFeatureClick}.
   */
  isAnonymous?: boolean;
  /** Called when an anonymous visitor taps a feature card — host opens a sign-in modal. */
  onAnonymousFeatureClick?: () => void;
  /** Pre-computed life-in-weeks calendar data for the Life tab. */
  lifeCalendarData: LifeCalendarData;
  /** Current year progress data. */
  yearProgressData: YearProgressData;
  /** Custom countdowns (up to 5). */
  lifeCountdowns: LifeCountdown[];
  /** FIRE tracker data; null when unconfigured. */
  fireTrackerData: FireTrackerData | null;
  /** Add a new custom countdown. */
  onAddLifeCountdown: (label: string, targetDate: string) => void;
  /** Delete a custom countdown by id. */
  onDeleteLifeCountdown: (id: string) => void;
  /** Set the user's birthday (ISO date string). */
  onSetBirthday: (birthday: string) => void;
}

export function LandingShell({
  dateItems,
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
  onOpenExercise,
  onSearchFood,
  onCaptureFood,
  onDescribeFood,
  recentFoodEntries,
  onRecentFoodEntryClick,
  onRecentFoodEntryDelete,
  recentExerciseEntries,
  onRecentExerciseEntryClick,
  onRecentExerciseEntryDelete,
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
  spendDaySummary,
  onOpenSpend,
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
  cavemanMode,
  onCavemanModeChange,
  onStartMindLabConversation,
  onOpenConversations,
  weeklySummary,
  sleepEntries,
  sleepEntryDayKey,
  sleepHabitInsight,
  sleepHabitInsightLoading = false,
  sleepSaving,
  sleepSaveError,
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
  exerciseBurnGoalKcal,
  exerciseSessionGoalMinutes,
  exerciseGoalDaysOn,
  exerciseGoalDaysOff,
  sleepHoursGoal,
  spendBudgetUsd,
  dashboardScrollRootRef,
  mobileQuickNote,
  mobileCommonplace,
  mobileAndMore,
  mobileLibraryTabOpenerRef,
  menuTourOnAndMoreTab = false,
  isAnonymous = false,
  onAnonymousFeatureClick,
  lifeCalendarData,
  yearProgressData,
  lifeCountdowns,
  fireTrackerData,
  onAddLifeCountdown,
  onDeleteLifeCountdown,
  onSetBirthday,
}: LandingShellProps) {
  const { theme } = useTheme();
  const chartDark = theme === "dark";
  const [activeMobileTab, setActiveMobileTab] = useState<MobileBottomTab>("quickNote");

  useEffect(() => {
    if (!mobileLibraryTabOpenerRef) return;
    mobileLibraryTabOpenerRef.current = () => setActiveMobileTab("andMore");
    return () => {
      mobileLibraryTabOpenerRef.current = null;
    };
  }, [mobileLibraryTabOpenerRef]);

  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

  const [sleepHoursInput, setSleepHoursInput] = useState(7.5);
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
      setSleepHoursInput(roundSleepHoursToMinute(sleepForSelectedDay.sleepHours));
      setHrvInput(sleepForSelectedDay.hrvMs != null ? String(sleepForSelectedDay.hrvMs) : "");
      setSleepScoreInput(sleepForSelectedDay.sleepScore != null ? String(sleepForSelectedDay.sleepScore) : "");
    } else {
      setSleepHoursInput(7.5);
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
    const hours = sleepHoursInput;
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) return;
    const hrv = hrvInput.trim() ? parseFloat(hrvInput) : null;
    if (hrv != null && (isNaN(hrv) || hrv < 1 || hrv > 300)) return;
    const score = sleepScoreInput.trim() ? parseFloat(sleepScoreInput) : null;
    if (score != null && (isNaN(score) || score < 1 || score > 100)) return;
    onSaveSleepEntry(
      roundSleepHoursToMinute(hours),
      hrv != null ? Math.round(hrv) : null,
      score != null ? Math.round(score) : null,
    );
  }

  const inlineChartBase: Highcharts.Options = useMemo(() => {
    const label = chartDark ? "#87867f" : "#5e5d59";
    const line = chartDark ? "#3d3d3a" : "#e8e6dc";
    const grid = chartDark ? "rgba(250,249,245,0.08)" : "#f0eee6";
    const legend = chartDark ? "#b0aea5" : "#4d4c48";
    const chartBackground = chartDark ? "transparent" : "transparent";
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
      tooltip: { backgroundColor: "#30302e", borderColor: "#3d3d3a", style: { color: "#faf9f5" }, shared: true },
    };
  }, [chartDark]);

  const weeklyDayLetters = useMemo(
    () => weeklySummary?.rows.map((r) => r.weekdayLabel.slice(0, 1)) ?? [],
    [weeklySummary],
  );

  const weeklyChartTitleStyle = useMemo(
    () => ({ color: chartDark ? "#faf9f5" : "#141413", fontSize: "13px", fontWeight: "500" as const, fontFamily: "Lora, Georgia, serif" }),
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
      case "quickNote":
        return mobileQuickNote ?? null;
      case "commonplace":
        return mobileCommonplace ?? null;
      case "nutrition":
        return (
          <LandingMobileNutritionTab
            nutrition={nutrition}
            nutritionGoals={nutritionGoals}
            weeklySummary={weeklySummary}
            onOpenNutrition={onOpenNutrition}
            onOpenGoals={onOpenGoals}
            recentFoodEntries={recentFoodEntries}
            onRecentFoodEntryClick={onRecentFoodEntryClick}
            onRecentFoodEntryDelete={onRecentFoodEntryDelete}
          />
        );
      case "exercise":
        return (
          <LandingMobileExerciseTab
            caloriesBurned={nutrition?.caloriesExercise ?? 0}
            exerciseBurnGoalKcal={exerciseBurnGoalKcal}
            exerciseSessionGoalMinutes={exerciseSessionGoalMinutes}
            exerciseGoalDaysOn={exerciseGoalDaysOn}
            exerciseGoalDaysOff={exerciseGoalDaysOff}
            recentExerciseEntries={recentExerciseEntries}
            onRecentExerciseEntryClick={onRecentExerciseEntryClick}
            onRecentExerciseEntryDelete={onRecentExerciseEntryDelete}
            onOpenExercise={onOpenExercise}
            onOpenGoals={onOpenGoals}
            weeklySummary={weeklySummary}
          />
        );
      case "spend":
        return (
          <LandingMobileSpendTab
            spendDaySummary={spendDaySummary}
            selectedDayLabel={selectedDayLabel}
            onOpenSpend={onOpenSpend}
            spendBudgetUsd={spendBudgetUsd}
            onOpenGoals={onOpenGoals}
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
            onOpenGoals={onOpenGoals}
          />
        );
      case "sleep":
        return (
          <LandingMobileSleepTab
            selectedDayLabel={selectedDayLabel}
            sleepEntries={sleepEntries}
            sleepEntryDayKey={sleepEntryDayKey}
            sleepHabitInsight={sleepHabitInsight}
            sleepHabitInsightLoading={sleepHabitInsightLoading}
            sleepSaving={sleepSaving}
            sleepSaveError={sleepSaveError}
            onSaveSleepEntry={onSaveSleepEntry}
            onViewSleepInsights={onViewSleepInsights}
            sleepHoursGoal={sleepHoursGoal}
            onOpenGoals={onOpenGoals}
          />
        );
      case "metacognition":
        return null;
      case "life":
        return (
          <LandingMobileLifeTab
            lifeCalendar={lifeCalendarData}
            yearProgress={yearProgressData}
            countdowns={lifeCountdowns}
            fireTracker={fireTrackerData}
            onOpenGoals={onOpenGoals}
            onAddCountdown={onAddLifeCountdown}
            onDeleteCountdown={onDeleteLifeCountdown}
            onSetBirthday={onSetBirthday}
          />
        );
      case "andMore":
        return mobileAndMore ?? null;
    }
  })();

  return (
    <>
      {/* ===== Mobile tabbed layout ===== */}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col animate-fade-in-up md:hidden">
        <div
          className={`flex min-h-0 flex-1 flex-col ${isAnonymous ? "" : "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"}`}
        >
          {isAnonymous ? (
            <LandingAnonymousFeatureGrid
              onFeatureClick={() => onAnonymousFeatureClick?.()}
            />
          ) : activeMobileTab !== "metacognition" ? (
            mobileTabContent
          ) : (
            <div className="space-y-4 px-4 pb-8">
              {/* Thought of the Day */}
              {thoughtOfTheDay && (
                <LandingThoughtOfTheDayBanner
                  thought={thoughtOfTheDay}
                  onReview={onReviewThought}
                  onOpenConcept={onOpenThoughtConcept}
                  reviewing={thoughtReviewing}
                />
              )}

              {/* Caffeine */}
              <LandingCaffeineChart intakes={caffeineIntakes} focusWindow={caffeineFocusWindow} />

              {/* Mentor Hub */}
              <ModuleCard eyebrow="Mentor Hub" title={mentorHubTitle}>
                <div className="space-y-4">
                  <div className="module-nested p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                      1:1 Mentor Chat
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
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
                                ? "border-[#c96442] bg-[#f5f4ed] ring-1 ring-[#c96442]/30 dark:border-[#d97757] dark:bg-[#30302e] dark:ring-[#d97757]/20"
                                : "border-[#e8e6dc] bg-[#faf9f5] hover:border-[#d1cfc5] hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:hover:border-[#4d4c48] dark:hover:bg-[#3d3d3a]"
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
                        <p className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">{followMentorsHint}</p>
                      )}
                    </div>
                    <div className="mt-2">
                      {selectedMentorId ? (
                        <button
                          type="button"
                          onClick={() => onSelectMentor(selectedMentorId)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c96442] bg-[#f5f4ed] px-3 py-1.5 text-[13px] font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
                        >
                          Chat with {mentors.find((m) => m.id === selectedMentorId)?.name ?? "mentor"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenOneOnOneMentor}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e8e6dc] px-3 py-1.5 text-[13px] font-medium text-[#4d4c48] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
                        >
                          Browse all mentors
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="module-nested p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                      New Conversation
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                      Start a metacognition session with optional settings.
                    </p>
                    <div className="mt-2 divide-y divide-[#e8e6dc] dark:divide-[#3d3d3a]">
                      <ToggleRow
                        label="Show citations"
                        checked={secondOrderCitationsEnabled}
                        onChange={onToggleSecondOrderCitations}
                      />
                      <ToggleRow
                        label="Detailed responses"
                        checked={responseVerbosity === "detailed"}
                        onChange={() => {
                          const next = responseVerbosity === "detailed" ? "compact" : "detailed";
                          onResponseVerbosityChange(next);
                          if (next === "detailed" && cavemanMode) onCavemanModeChange(false);
                        }}
                      />
                      <ToggleRow
                        label="Caveman mode"
                        checked={cavemanMode}
                        onChange={() => {
                          const next = !cavemanMode;
                          onCavemanModeChange(next);
                          if (next && responseVerbosity === "detailed") onResponseVerbosityChange("compact");
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onStartMindLabConversation}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c96442] bg-[#f5f4ed] px-3 py-1.5 text-[13px] font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
                        <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                          {conversationCount} past conversation{conversationCount !== 1 ? "s" : ""}
                        </p>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="module-nested p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                      Ask Mentors
                    </p>
                    <p className="mt-0.5 mb-2 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                      Get recommendations from multiple mentors at once.
                    </p>
                    {askMentorsContent}
                  </div>
                </div>
              </ModuleCard>
            </div>
          )}
        </div>
        {!isAnonymous && (
          <LandingMobileTabBar
            activeTab={activeMobileTab}
            onTabChange={setActiveMobileTab}
            menuTourOnAndMore={menuTourOnAndMoreTab}
          />
        )}
      </div>

      {/* ===== Desktop stacked layout (unchanged) ===== */}
    <div className="hidden md:block w-full max-w-[88rem] min-w-0 space-y-4 animate-fade-in-up">
      <LandingDateStrip hint={dateStripHint} items={dateItems} />

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
            <h3 className="truncate text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">Quick Capture</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {quickCaptures.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="module-nested flex flex-col items-center gap-1 px-1.5 py-2 text-center transition-shadow hover:shadow-md active:scale-[0.98] dark:hover:brightness-110"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f4ed] text-[#c96442] dark:bg-[#30302e] dark:text-[#E8C3A0]">
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
                    ? "ring-2 ring-[#c96442]/50 ring-offset-2 ring-offset-transparent dark:ring-[#d97757]/55"
                    : ""
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5f4ed] text-[#c96442] dark:bg-[#30302e] dark:text-[#E8C3A0]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-[11px] font-medium text-foreground">Sleep</span>
              </button>
            </div>

            {sleepFormOpen && (
              <div className={`module-nested-muted mt-2 space-y-2 p-2.5 transition-opacity ${sleepSaving ? "opacity-[0.72]" : ""}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5d59] dark:text-[#87867f]">
                  Sleep · {selectedDayLabel}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                      Sleep duration
                    </label>
                    <div className="mt-0.5 w-full rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
                      <SleepDurationPicker
                        valueHours={sleepHoursInput}
                        onChangeHours={setSleepHoursInput}
                        disabled={sleepSaving}
                        className="w-full justify-center"
                        selectClassName="min-w-[3.5rem] appearance-none bg-transparent text-center text-[13px] font-medium tabular-nums text-foreground outline-none"
                        separatorClassName="text-[13px] font-medium tabular-nums text-[#5e5d59] dark:text-[#87867f]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
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
                      disabled={sleepSaving}
                      className="mt-0.5 w-full rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
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
                      disabled={sleepSaving}
                      className="mt-0.5 w-full rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sleepSaving}
                  onClick={handleSaveSleep}
                  className="w-full rounded-lg border border-[#c96442] bg-[#f5f4ed] px-3 py-1.5 text-[13px] font-medium text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] disabled:opacity-50 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
                >
                  {sleepSaving ? "Saving…" : sleepForSelectedDay ? "Update sleep" : "Save sleep"}
                </button>
                {sleepSaveError ? (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{sleepSaveError}</p>
                ) : null}
                {sleepForSelectedDay ? (
                  <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                    Logged: {formatSleepDuration(sleepForSelectedDay.sleepHours)} sleep
                    {sleepForSelectedDay.hrvMs != null ? ` · ${sleepForSelectedDay.hrvMs} ms HRV` : ""}
                    {sleepForSelectedDay.sleepScore != null ? ` · ${sleepForSelectedDay.sleepScore}/100` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                    No sleep logged for this day yet.
                  </p>
                )}
              </div>
            )}
            <div className="module-nested-muted mt-3 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">Spent today</p>
                <button
                  type="button"
                  onClick={onOpenSpend}
                  className="shrink-0 rounded-lg border border-[#c96442]/60 bg-[#f5f4ed] px-2.5 py-1 text-[11px] font-medium text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
                >
                  Log
                </button>
              </div>
              {Object.keys(spendDaySummary.totalsByCurrency).length === 0 &&
              spendDaySummary.recentEntries.length === 0 ? (
                <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                  No purchases logged for {selectedDayLabel}.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(spendDaySummary.totalsByCurrency).map(([code, total]) => (
                      <p key={code} className="text-sm font-semibold tabular-nums text-foreground">
                        {total.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {code}
                      </p>
                    ))}
                  </div>
                  {spendDaySummary.recentEntries.length > 0 ? (
                    <ul className="space-y-1 border-t border-[#e8e6dc] pt-2 dark:border-[#3d3d3a]">
                      {spendDaySummary.recentEntries.slice(0, 3).map((e) => (
                        <li
                          key={e.id}
                          className="flex justify-between gap-2 text-[11px] text-[#5e5d59] dark:text-[#87867f]"
                        >
                          <span className="min-w-0 truncate">{e.label}</span>
                          <span className="shrink-0 tabular-nums">
                            {e.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {e.currency}
                            {e.time ? ` · ${e.time}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
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
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[#87867f] dark:text-[#87867f]">
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
                      ? "border-[#d1cfc5] bg-[#f5f4ed] text-[#4d4c48] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5]"
                      : "border-[#e8e6dc] bg-[#faf9f5]/70 text-[#5e5d59] hover:border-[#d1cfc5] hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#b0aea5] dark:hover:border-[#4d4c48] dark:hover:bg-[#30302e]"
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
            className="mt-2.5 w-full rounded-full border border-[#d1cfc5] bg-[#f5f4ed] py-2.5 text-xs font-semibold text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c96442] dark:text-[#d97757]">
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
                    ? "border-[#c96442] bg-[#f5f4ed] text-[#4d4c48] ring-1 ring-[#c96442]/25 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:ring-[#d97757]/20"
                    : "border-[#e8e6dc] bg-[#faf9f5]/90 text-neutral-800 hover:shadow-md dark:border-[#3d3d3a] dark:bg-[#30302e]/95 dark:text-[#faf9f5] dark:hover:bg-neutral-700 dark:hover:brightness-110"
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
            className="w-full rounded-full border border-[#e8e6dc] bg-[#faf9f5]/95 px-4 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e] dark:shadow-none"
          />

          <button
            type="button"
            onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
            disabled={focusTrackerSaving}
            className="w-full rounded-full border-2 border-[#c96442] bg-[#f5f4ed] px-5 py-2.5 text-sm font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] disabled:opacity-50 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
              className="w-24 rounded-full border border-[#e8e6dc] bg-[#faf9f5]/95 px-4 py-2 text-sm text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
            />
            <button
              type="button"
              onClick={onApplyCustomPomodoroMinutes}
              disabled={focusTrackerSaving || pomodoroSessionActive}
              className="rounded-full border border-[#e8e6dc] bg-[#faf9f5]/90 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:shadow-md disabled:opacity-50 dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#faf9f5] dark:hover:bg-[#3d3d3a]"
            >
              Set minutes
            </button>
            <button
              type="button"
              onClick={onResetPomodoro}
              disabled={focusTrackerSaving}
              className="rounded-full border border-[#e8e6dc] bg-[#faf9f5]/90 px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:shadow-md disabled:opacity-50 dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#faf9f5] dark:hover:bg-[#3d3d3a]"
            >
              Reset
            </button>
            {pomodoroSessionActive && (
              <button
                type="button"
                onClick={onEndPomodoro}
                disabled={focusTrackerSaving}
                className="rounded-full border-2 border-[#DDAA7C] px-4 py-2 text-sm font-medium text-[#4d4c48] shadow-sm transition-colors hover:bg-[#f5f4ed] disabled:opacity-50 dark:border-[#C4A070] dark:text-[#E8C3A0] dark:hover:bg-[#30302e]"
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
          <Skeleton name="weekly-summary" loading={!weeklySummary}>
            {weeklySummary && <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                  {weeklySummary.weekStartLabel} – {weeklySummary.weekEndLabel}
                </p>
                <button
                  type="button"
                  onClick={onOpenWeeklySummary}
                  className="rounded-full border border-[#e8e6dc] px-2 py-0.5 text-[11px] font-medium text-[#4d4c48] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
                        <span className="text-[9px] font-medium text-[#87867f] dark:text-neutral-500">
                          {row.weekdayLabel.slice(0, 1)}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                            hasActivity
                              ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300"
                              : "bg-[#e8e6dc] text-[#87867f] dark:bg-[#3d3d3a] dark:text-[#5e5d59]"
                          }`}
                        >
                          {row.foodEntries + row.exerciseEntries || "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-1 gap-1.5 min-w-0">
                  <div className="flex-1 rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1 dark:border-[#3d3d3a] dark:bg-[#30302e] text-center">
                    <p className="text-base font-semibold text-foreground">{weeklySummary.trackedDays}<span className="text-[10px] font-normal text-neutral-400">/7</span></p>
                    <p className="text-[9px] text-[#5e5d59] dark:text-[#87867f]">Days</p>
                  </div>
                  <div className="flex-1 rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1 dark:border-[#3d3d3a] dark:bg-[#30302e] text-center">
                    <p className={`text-base font-semibold ${weeklySummary.caloriesUnderBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {Math.abs(weeklySummary.caloriesUnderBudget).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-[#5e5d59] dark:text-[#87867f]">
                      {weeklySummary.caloriesUnderBudget >= 0 ? "Under" : "Over"}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2 py-1 dark:border-[#3d3d3a] dark:bg-[#30302e] text-center">
                    <p className="text-base font-semibold text-foreground">{weeklySummary.foodEntries}</p>
                    <p className="text-[9px] text-[#5e5d59] dark:text-[#87867f]">Meals</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-[#e8e6dc] dark:border-[#3d3d3a] p-2 bg-[#faf9f5] dark:bg-[#30302e] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer">
                  <HighchartsReact highcharts={Highcharts} options={weeklyCaloriesOpts} />
                </button>
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-[#e8e6dc] dark:border-[#3d3d3a] p-2 bg-[#faf9f5] dark:bg-[#30302e] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer">
                  <HighchartsReact highcharts={Highcharts} options={weeklyMacrosOpts} />
                </button>
                <button type="button" onClick={onOpenWeeklySummary} className="rounded-xl border border-[#e8e6dc] dark:border-[#3d3d3a] p-2 bg-[#faf9f5] dark:bg-[#30302e] dark:text-foreground text-left transition-shadow hover:shadow-md cursor-pointer lg:col-span-2 xl:col-span-1">
                  <HighchartsReact highcharts={Highcharts} options={weeklyFocusOpts} />
                </button>
              </div>
            </>}
          </Skeleton>
        </ModuleCard>
      </div>

      {/* Life Calendar — memento mori & FIRE tracker */}
      <div id="sec-life" className={SECTION_SCROLL_MARGIN}>
        <ModuleCard eyebrow="Life Calendar" title="Life Calendar" description="Visualize your time. Make every week count.">
          {lifeCalendarData.birthday ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div
                  className="mx-auto"
                  style={{ maxWidth: (3 + 1) * 52 + "px" }}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(52, 3px)`,
                      gap: "1px",
                    }}
                  >
                    {Array.from({ length: Math.ceil(lifeCalendarData.weeksTotal / 52) * 52 }, (_, i) => {
                      if (i >= lifeCalendarData.weeksTotal) return <span key={i} />;
                      const lived = i < lifeCalendarData.weeksLived;
                      return (
                        <span
                          key={i}
                          className={`block rounded-full ${
                            lived
                              ? "bg-[#c96442] dark:bg-[#d97757]"
                              : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
                          }`}
                          style={{ width: 3, height: 3 }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                <span>{lifeCalendarData.weeksLived.toLocaleString()} weeks lived</span>
                <span>{(lifeCalendarData.weeksTotal - lifeCalendarData.weeksLived).toLocaleString()} remaining</span>
                <span>{lifeCalendarData.percentLived.toFixed(1)}%</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] p-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {yearProgressData.percentElapsed.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[#5e5d59] dark:text-[#87867f]">
                    {new Date().getFullYear()} Progress · Day {yearProgressData.dayOfYear}
                  </span>
                </div>
                {fireTrackerData && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] p-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
                    <span className="text-lg font-bold tabular-nums text-accent">
                      {fireTrackerData.percentComplete.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-[#5e5d59] dark:text-[#87867f]">
                      FIRE{fireTrackerData.projectedYearsToTarget != null ? ` · ~${fireTrackerData.projectedYearsToTarget.toFixed(1)} yr` : ""}
                    </span>
                  </div>
                )}
              </div>
              {lifeCountdowns.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">Countdowns</p>
                  {lifeCountdowns.map((cd) => (
                    <div key={cd.id} className="flex items-center justify-between rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-1.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
                      <span className="truncate text-[12px] font-medium text-foreground">{cd.label}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[#5e5d59] dark:text-[#87867f]">
                        {cd.isPast ? `${Math.abs(cd.daysRemaining)}d ago` : `${cd.daysRemaining}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-[13px] text-[#87867f] dark:text-neutral-500">
              Set your birthday in Goals to visualize your life in weeks.
            </p>
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
            <p className="text-[13px] text-[#87867f] dark:text-neutral-500">
              {weightWeekPoints.length === 1 ? "Log one more entry to see your trend." : "No entries this week."}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-2.5 py-1.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
              <p className="text-base font-semibold text-foreground">
                {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)} kg`}
              </p>
              <p className="text-[10px] text-[#5e5d59] dark:text-[#87867f]">{currentWeightLabel}</p>
            </div>
            <div className="rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-2.5 py-1.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
              <p className="text-base font-semibold text-foreground">
                {weightTargetKg == null ? "--" : `${weightTargetKg.toFixed(1)} kg`}
              </p>
              <p className="text-[10px] text-[#5e5d59] dark:text-[#87867f]">{targetWeightLabel}</p>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
              {distanceToTarget == null ? noTargetYetLabel : `${distanceToTarget} kg to target`}
              {" · "}
              {weightEntryCount} entr{weightEntryCount === 1 ? "y" : "ies"}
            </p>
            <button
              type="button"
              onClick={onOpenWeight}
              className="rounded-full border border-[#e8e6dc] px-2 py-0.5 text-[11px] font-medium text-[#4d4c48] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
              <p className="text-[13px] text-[#5e5d59] dark:text-[#87867f]">
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
                    <span className="block text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                      {tapToInspectLabel}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[#e8e6dc] bg-[#faf9f5]/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#4d4c48] ring-1 ring-[#141413]/[0.05] dark:border-[#3d3d3a] dark:bg-[#30302e]/50 dark:text-[#b0aea5] dark:ring-[#faf9f5]/[0.08]">
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
          habitInsight={sleepHabitInsight}
          habitInsightLoading={sleepHabitInsightLoading}
          onViewSleepInsights={onViewSleepInsights}
          targetHours={sleepHoursGoal}
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                1:1 Mentor Chat
              </p>
              <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
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
                          ? "border-[#c96442] bg-[#f5f4ed] ring-1 ring-[#c96442]/30 dark:border-[#d97757] dark:bg-[#30302e] dark:ring-[#d97757]/20"
                          : "border-[#e8e6dc] bg-[#faf9f5] hover:border-[#d1cfc5] hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:hover:border-[#4d4c48] dark:hover:bg-[#3d3d3a]"
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
                  <p className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">{followMentorsHint}</p>
                )}
              </div>
              <div className="mt-2">
                {selectedMentorId ? (
                  <button
                    type="button"
                    onClick={() => onSelectMentor(selectedMentorId)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c96442] bg-[#f5f4ed] px-3 py-1.5 text-[13px] font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e8e6dc] px-3 py-1.5 text-[13px] font-medium text-[#4d4c48] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                New Conversation
              </p>
              <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                Start a metacognition session with optional settings.
              </p>
              <div className="mt-2 divide-y divide-[#e8e6dc] dark:divide-[#3d3d3a]">
                <ToggleRow
                  label="Show citations"
                  checked={secondOrderCitationsEnabled}
                  onChange={onToggleSecondOrderCitations}
                />
                <ToggleRow
                  label="Detailed responses"
                  checked={responseVerbosity === "detailed"}
                  onChange={() => {
                    const next = responseVerbosity === "detailed" ? "compact" : "detailed";
                    onResponseVerbosityChange(next);
                    if (next === "detailed" && cavemanMode) onCavemanModeChange(false);
                  }}
                />
                <ToggleRow
                  label="Caveman mode"
                  checked={cavemanMode}
                  onChange={() => {
                    const next = !cavemanMode;
                    onCavemanModeChange(next);
                    if (next && responseVerbosity === "detailed") onResponseVerbosityChange("compact");
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onStartMindLabConversation}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c96442] bg-[#f5f4ed] px-3 py-1.5 text-[13px] font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
                  <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                  Explore
                </p>
                <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                  Mental models, frameworks, and interactive learning.
                </p>
                <div className="mt-2 space-y-1.5">
                  {featuredMentalModelName && (
                    <button
                      type="button"
                      onClick={onOpenMentalModels}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2.5 py-2 text-left transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:hover:bg-[#3d3d3a]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">{featuredMentalModelName}</p>
                        <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">Interactive mental model</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c96442] dark:text-[#d97757]">
                Ask Mentors
              </p>
              <p className="mt-0.5 mb-2 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
                Get recommendations from multiple mentors at once.
              </p>
              {askMentorsContent}
            </div>
          </div>
        </div>
      </ModuleCard>
      </div>

      <div className="border-t border-[#e8e6dc] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 dark:border-[#3d3d3a] lg:hidden">
        <button
          type="button"
          onClick={() => {
            dashboardScrollRootRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="module-nested w-full py-2.5 text-center text-[12px] font-semibold text-[#141413] dark:text-[#faf9f5]"
        >
          Back to top
        </button>
      </div>

    </div>
    </>
  );
}
