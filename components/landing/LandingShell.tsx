"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { LandingCaffeineChart } from "@/components/landing/LandingCaffeineChart";
import { LandingDateStrip } from "@/components/landing/LandingDateStrip";
import { LandingFocusCanvas } from "@/components/landing/LandingFocusCanvas";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import { LandingThoughtOfTheDayBanner } from "@/components/landing/LandingThoughtOfTheDay";
import { LandingTimelineCard } from "@/components/landing/LandingTimelineCard";
import type {
  CaffeineFocusWindow,
  CaffeineIntake,
  FocusDurationSuggestion,
  LandingActivityGroupSummary,
  LandingDateItem,
  LandingFigureSummary,
  LandingFocusSummaryRow,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingSleepEntry,
  LandingThoughtOfTheDay,
  LandingTimelineEvent,
  LandingWeeklySummaryPreview,
  LandingWeightPoint,
} from "@/components/landing/types";

const SCROLLSPY_SECTIONS = [
  { id: "sec-focus", label: "Focus" },
  { id: "sec-mentor", label: "Mentor Hub" },
  { id: "sec-summary", label: "Summary" },
  { id: "sec-activity", label: "Activity" },
  { id: "sec-timeline", label: "Timeline" },
  { id: "sec-caffeine", label: "Caffeine" },
  { id: "sec-sleep", label: "Sleep" },
] as const;

function SectionPicker() {
  const [activeId, setActiveId] = useState<string>(SCROLLSPY_SECTIONS[0].id);

  useEffect(() => {
    const els = SCROLLSPY_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let topmost: { id: string; top: number } | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            if (!topmost || rect.top < topmost.top) {
              topmost = { id: entry.target.id, top: rect.top };
            }
          }
        }
        if (topmost) setActiveId(topmost.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto scrollbar-none"
      aria-label="Page sections"
    >
      {SCROLLSPY_SECTIONS.map((s) => {
        const isActive = activeId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-[#FBF4EC] text-[#7C522D] dark:bg-[#241a14] dark:text-[#D6A67E]"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

const WeightSparkline = React.memo(function WeightSparkline({
  points,
  targetKg,
}: {
  points: LandingWeightPoint[];
  targetKg: number | null;
}) {
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
                text: `Target ${targetKg} kg`,
                align: "right",
                style: { color: "#16a34a", fontSize: "9px", fontWeight: "600" },
                x: -4,
                y: -4,
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
        lineColor: "#e5e5e5",
        tickColor: "transparent",
        labels: { enabled: false },
      },
      yAxis: {
        title: { text: "kg", style: { color: "#a3a3a3", fontSize: "10px" } },
        labels: { style: { color: "#a3a3a3", fontSize: "10px" } },
        min: yMin - padding,
        max: yMax + padding,
        gridLineColor: "#f0f0f0",
        plotLines,
      },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e5e5e5",
        borderRadius: 8,
        shadow: false,
        style: { fontSize: "12px" },
        pointFormat: "<b>{point.y:.1f} kg</b>",
      },
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
            lineColor: "#fff",
            lineWidth: 2,
          },
        },
      ],
    };
  }, [points, targetKg]);

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
    <section className="overflow-hidden rounded-2xl border border-white/60 bg-white/50 px-3 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
      <h3 className="truncate text-[13px] font-semibold text-foreground">{eyebrow}</h3>
      {description && (
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}

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
    <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-100 p-px dark:border-neutral-700 dark:bg-neutral-800">
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
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

interface LandingShellProps {
  dashboardEyebrow: string;
  title: string;
  subtitle: string;
  selectedDateLabel: string;
  dateItems: LandingDateItem[];
  dateStripLabel: string;
  dateStripHint: string;
  onOpenCalendar: () => void;
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
  sleepFocusSuggestion: FocusDurationSuggestion | null;
  sleepSaving: boolean;
  onSaveSleepEntry: (sleepHours: number, hrvMs: number | null) => void;
  thoughtOfTheDay: LandingThoughtOfTheDay | null;
  thoughtReviewing: boolean;
  onReviewThought: () => void;
  onOpenThoughtConcept: () => void;
}

export function LandingShell({
  dashboardEyebrow,
  title,
  subtitle,
  selectedDateLabel,
  dateItems,
  dateStripLabel,
  dateStripHint,
  onOpenCalendar,
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
  sleepFocusSuggestion,
  sleepSaving,
  onSaveSleepEntry,
  thoughtOfTheDay,
  thoughtReviewing,
  onReviewThought,
  onOpenThoughtConcept,
}: LandingShellProps) {
  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

  const [sleepHoursInput, setSleepHoursInput] = useState("7.5");
  const [hrvInput, setHrvInput] = useState("");
  const [sleepFormOpen, setSleepFormOpen] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);

  const lastSleep = sleepEntries.length > 0 ? sleepEntries[0] : null;

  function handleSaveSleep() {
    const hours = parseFloat(sleepHoursInput);
    if (isNaN(hours) || hours < 0.5 || hours > 24) return;
    const hrv = hrvInput.trim() ? parseFloat(hrvInput) : null;
    if (hrv != null && (isNaN(hrv) || hrv < 1 || hrv > 300)) return;
    onSaveSleepEntry(Math.round(hours * 10) / 10, hrv != null ? Math.round(hrv) : null);
  }

  return (
    <div className="w-full max-w-[88rem] min-w-0 overflow-hidden space-y-4 animate-fade-in-up">
      <section className="sticky top-0 z-30 w-full overflow-hidden rounded-[2rem] border border-white/60 bg-white/55 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
                {dashboardEyebrow}
              </p>
              <SectionPicker />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <button
              type="button"
              onClick={onOpenCalendar}
              className="inline-flex items-center justify-between gap-3 rounded-full border border-[#E9D5C2] bg-[#FBF4EC] px-4 py-2 text-sm font-medium text-[#7C522D] transition-colors hover:bg-[#F8EBDD] dark:border-[#6A4A33] dark:bg-[#241a14] dark:text-[#E8C3A0] dark:hover:bg-[#2B2019]"
            >
              <span>{selectedDateLabel}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <LandingDateStrip label={dateStripLabel} hint={dateStripHint} items={dateItems} />

      <div id="sec-focus" className="grid gap-4 xl:grid-cols-2">
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
          onOpenNutrition={onOpenNutrition}
        />

        {/* Right column: Focus Timer + Quick Capture stacked */}
        <div className="flex flex-col gap-4">
        {/* Focus Timer Module */}
        <section className="flex w-full flex-1 flex-col overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/50 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            Focus Timer
          </p>
          <p className="landing-focus-timer-clock mt-2 font-black text-foreground">
            {pomodoroClockLabel}
          </p>

          <div className="mt-4 flex flex-col gap-3">
            {/* Duration pills + tag */}
            <div className="flex flex-wrap items-center gap-2">
              {[30, 60, 90].map((minutes) => (
                <button
                  key={`focus-timer-dur-${minutes}`}
                  type="button"
                  onClick={() => onSelectPomodoroDuration(minutes)}
                  disabled={focusTrackerSaving || pomodoroSessionActive}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    pomodoroDurationMinutes === minutes
                      ? "border-[#B87B51] bg-[#FBF4EC] text-[#7C522D] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
                      : "border-neutral-300 bg-white/80 text-neutral-700 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
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
              className="w-full rounded-full border border-neutral-300 bg-white/88 px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />

            {/* Start / Pause / Resume */}
            <button
              type="button"
              onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
              disabled={focusTrackerSaving}
              className="w-full rounded-full border border-[#B87B51] bg-[#FBF4EC] px-5 py-2.5 text-sm font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
            >
              {pomodoroSessionActive ? (pomodoroRunning ? "Pause" : "Resume") : "Start Focus Session"}
            </button>

            {/* Custom minutes + Reset + End */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={600}
                step={1}
                value={pomodoroCustomMinutesInput}
                onChange={(event) => onPomodoroCustomMinutesInputChange(event.target.value)}
                disabled={focusTrackerSaving || pomodoroSessionActive}
                className="w-24 rounded-full border border-neutral-300 bg-white/88 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={onApplyCustomPomodoroMinutes}
                disabled={focusTrackerSaving || pomodoroSessionActive}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Set minutes
              </button>
              <button
                type="button"
                onClick={onResetPomodoro}
                disabled={focusTrackerSaving}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Reset
              </button>
              {pomodoroSessionActive && (
                <button
                  type="button"
                  onClick={onEndPomodoro}
                  disabled={focusTrackerSaving}
                  className="rounded-full border border-[#DDAA7C] px-4 py-2 text-sm font-medium text-[#7C522D] transition-colors hover:bg-[#FBF4EC] disabled:opacity-50 dark:border-[#6A4A33] dark:text-[#E8C3A0] dark:hover:bg-[#241a14]"
                >
                  End
                </button>
              )}
            </div>

            {/* Status message */}
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

            {/* Conversation toggles + start */}
            <div className="rounded-[1.35rem] border border-neutral-200/80 bg-neutral-50/75 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
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
            </div>
          </div>

          {/* Hidden inputs preserved for custom focus entry */}
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

        {/* Quick Capture — below Focus Timer */}
        <section className="overflow-hidden rounded-2xl border border-white/60 bg-white/50 px-3 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
          <h3 className="truncate text-[13px] font-semibold text-foreground">Quick Capture</h3>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {quickCaptures.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 px-1.5 py-2 transition-colors hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                  {item.icon}
                </span>
                <span className="text-[11px] font-medium text-foreground">{item.label}</span>
              </button>
            ))}
            {/* Sleep & Recovery quick capture button */}
            <button
              type="button"
              onClick={() => setSleepFormOpen((prev) => !prev)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors ${
                sleepFormOpen
                  ? "border-[#DDB691] bg-[#FBF4EC] dark:border-[#6A4A33] dark:bg-[#241a14]"
                  : "border-neutral-200 hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
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

          {/* Inline sleep entry form */}
          {sleepFormOpen && (
            <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Log last night
              </p>
              <div className="grid grid-cols-2 gap-2">
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
                    className="mt-0.5 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#B87B51] dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    HRV (ms, optional)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="300"
                    placeholder="—"
                    value={hrvInput}
                    onChange={(e) => setHrvInput(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#B87B51] dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={sleepSaving}
                onClick={handleSaveSleep}
                className="w-full rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
              >
                {sleepSaving ? "Saving…" : "Log last night"}
              </button>
              {lastSleep && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Last: {lastSleep.sleepHours}h sleep
                  {lastSleep.hrvMs != null ? ` · ${lastSleep.hrvMs} ms HRV` : ""}
                  {" · "}
                  {lastSleep.dayKey}
                </p>
              )}
            </div>
          )}
        </section>
        </div>
      </div>

      {/* Thought of the Day banner */}
      {thoughtOfTheDay && (
        <LandingThoughtOfTheDayBanner
          thought={thoughtOfTheDay}
          onReview={onReviewThought}
          onOpenConcept={onOpenThoughtConcept}
          reviewing={thoughtReviewing}
        />
      )}

      {/* Mentor Hub — full width */}
      <div id="sec-mentor">
      <ModuleCard eyebrow="Mentor Hub" title={mentorHubTitle}>
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Left: mentors + 1:1 + mind lab links */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
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
                        : "border-neutral-200 bg-neutral-50 hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
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
                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{followMentorsHint}</p>
              )}
            </div>

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
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Browse all mentors
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            {featuredMentalModelName && (
              <button
                type="button"
                onClick={onOpenMentalModels}
                className="flex w-full items-center justify-between gap-2 rounded-lg border-l-[3px] border-neutral-300 bg-neutral-50 px-2.5 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800"
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

            {conversationCount > 0 && (
              <button
                type="button"
                onClick={onOpenConversations}
                className="flex w-full items-center justify-between border-t border-neutral-100 pt-2 text-left transition-colors hover:opacity-70 dark:border-neutral-800"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Conversations
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {conversationCount} item{conversationCount !== 1 ? "s" : ""}, tap to view
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: Ask mentors inline form */}
          <div>{askMentorsContent}</div>
        </div>
      </ModuleCard>
      </div>

      {/* Row 2: Weekly Summary · Weight · Activity */}
      <div id="sec-summary" className="grid gap-4 xl:grid-cols-3">
        <ModuleCard eyebrow="Weekly Summary" title={weeklySummaryLabel}>
          {weeklySummary ? (
            <>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {weeklySummary.weekStartLabel} – {weeklySummary.weekEndLabel}
              </p>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                {weeklySummary.rows.map((row) => {
                  const hasActivity = row.foodEntries > 0 || row.exerciseEntries > 0 || row.focusMinutes > 0;
                  return (
                    <div key={row.dayKey} className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500">
                        {row.weekdayLabel.slice(0, 1)}
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
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

              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-lg font-semibold text-foreground">{weeklySummary.trackedDays}<span className="text-[11px] font-normal text-neutral-400">/7</span></p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Days tracked</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className={`text-lg font-semibold ${weeklySummary.caloriesUnderBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {Math.abs(weeklySummary.caloriesUnderBudget).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {weeklySummary.caloriesUnderBudget >= 0 ? "Under budget" : "Over budget"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-lg font-semibold text-foreground">{weeklySummary.foodEntries}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Meals logged</p>
                </div>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={onOpenWeeklySummary}
                  className="w-full rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                >
                  View full report
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

        <ModuleCard
          eyebrow="Weight"
          title={weightTitle}
          description={weightDescription}
        >
          {/* Sparkline chart */}
          {weightWeekPoints.length >= 2 ? (
            <WeightSparkline points={weightWeekPoints} targetKg={weightTargetKg} />
          ) : (
            <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
              {weightWeekPoints.length === 1 ? "Log one more entry to see your trend." : "No entries this week."}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-base font-semibold text-foreground">
                {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)} kg`}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{currentWeightLabel}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
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

        <div id="sec-activity">
        <ModuleCard
          eyebrow="Activity"
          title={activityTitle}
          description={activityDescription}
        >
          <div className="space-y-1.5">
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
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">{group.label}</span>
                    <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                      {tapToInspectLabel}
                    </span>
                  </span>
                  <span className="rounded-full border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    {group.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </ModuleCard>
        </div>
      </div>

      <div id="sec-timeline">
        <LandingTimelineCard eyebrow={timelineEyebrow} dayLabel={timelineLabel} events={timelineEvents} />
      </div>

      <div id="sec-caffeine">
        <LandingCaffeineChart intakes={caffeineIntakes} focusWindow={caffeineFocusWindow} />
      </div>

      <div id="sec-sleep">
        <LandingSleepRecoveryChart entries={sleepEntries} focusSuggestion={sleepFocusSuggestion} />
      </div>

    </div>
  );
}
