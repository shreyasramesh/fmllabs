"use client";

import React from "react";

import type {
  LandingFocusSummaryRow,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
} from "@/components/landing/types";

function clampRatio(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function circleCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

const ORB_STYLES = [
  "bg-sky-100/85 text-sky-700 shadow-[0_0_28px_rgba(96,165,250,0.45)] ring-sky-200/80 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-700/50",
  "bg-emerald-100/85 text-emerald-700 shadow-[0_0_28px_rgba(52,211,153,0.42)] ring-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-700/50",
  "bg-orange-100/85 text-orange-700 shadow-[0_0_28px_rgba(251,146,60,0.42)] ring-orange-200/80 dark:bg-orange-950/70 dark:text-orange-200 dark:ring-orange-700/50",
  "bg-lime-100/85 text-lime-700 shadow-[0_0_28px_rgba(134,239,172,0.38)] ring-lime-200/80 dark:bg-lime-950/70 dark:text-lime-200 dark:ring-lime-700/50",
  "bg-amber-100/85 text-amber-700 shadow-[0_0_28px_rgba(251,191,36,0.38)] ring-amber-200/80 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700/50",
  "bg-rose-100/85 text-rose-700 shadow-[0_0_28px_rgba(251,113,133,0.34)] ring-rose-200/80 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-700/50",
];

interface LandingFocusCanvasProps {
  eyebrow: string;
  title: string;
  subtitle: string;
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
}

export function LandingFocusCanvas({
  eyebrow,
  title,
  subtitle,
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
}: LandingFocusCanvasProps) {
  const caloriesRatio = clampRatio(
    nutritionGoals.caloriesTarget - nutrition.caloriesRemaining,
    nutritionGoals.caloriesTarget
  );
  const focusRatio = Math.max(0, Math.min(1, focusSummaryMinutes / Math.max(30, pomodoroDurationMinutes)));
  const carbsRatio = clampRatio(nutrition.carbsGrams, nutritionGoals.carbsGrams);
  const proteinRatio = clampRatio(nutrition.proteinGrams, nutritionGoals.proteinGrams);
  const fatRatio = clampRatio(nutrition.fatGrams, nutritionGoals.fatGrams);
  const caloriesConsumed = Math.max(0, nutritionGoals.caloriesTarget - nutrition.caloriesRemaining);
  const leftOrbs = quickCaptures.slice(0, 3);
  const rightOrbs = quickCaptures.slice(3, 6);
  const ringMetrics = [
    {
      key: "calories",
      radius: 126,
      strokeWidth: 14,
      ratio: caloriesRatio,
      color: "#7FB1DA",
      track: "rgba(226, 216, 203, 0.95)",
      rotation: 142,
      label: nutritionLabel,
      value: `${caloriesConsumed}/${nutritionGoals.caloriesTarget}`,
    },
    {
      key: "focus",
      radius: 104,
      strokeWidth: 11,
      ratio: focusRatio,
      color: "#84B78E",
      track: "rgba(232, 223, 211, 0.88)",
      rotation: 308,
      label: focusSummaryLabel,
      value: `${focusSummaryMinutes}m`,
    },
    {
      key: "protein",
      radius: 84,
      strokeWidth: 9,
      ratio: proteinRatio,
      color: "#B987E6",
      track: "rgba(234, 225, 214, 0.8)",
      rotation: 334,
      label: proteinLabel,
      value: `${nutrition.proteinGrams}/${nutritionGoals.proteinGrams}g`,
    },
    {
      key: "carbs",
      radius: 68,
      strokeWidth: 8,
      ratio: carbsRatio,
      color: "#F1B562",
      track: "rgba(235, 226, 215, 0.72)",
      rotation: 24,
      label: carbsLabel,
      value: `${nutrition.carbsGrams}/${nutritionGoals.carbsGrams}g`,
    },
  ] as const;
  const topLegendPills = [
    { key: "nutrition", label: nutritionLabel, color: "#7FB1DA" },
    { key: "focus", label: focusSummaryLabel, color: "#84B78E" },
  ] as const;
  const metricPills = [
    {
      key: "calories",
      label: caloriesRemainingLabel,
      value: `${nutrition.caloriesRemaining}`,
      tint: "border-sky-200/95 bg-white/92 text-sky-800 shadow-[0_0_35px_rgba(96,165,250,0.22)] dark:border-sky-800/60 dark:bg-sky-950/55 dark:text-sky-200",
      position: "left-[-0.75rem] top-[29%] lg:left-[-1.5rem]",
      width: "w-[12rem]",
      valueClassName: "text-[2.05rem]",
      paddingClassName: "px-4 py-3",
    },
    {
      key: "focus",
      label: focusSummaryLabel,
      value: `${focusSummaryMinutes}m`,
      tint: "border-emerald-200/95 bg-white/92 text-emerald-800 shadow-[0_0_35px_rgba(52,211,153,0.2)] dark:border-emerald-800/60 dark:bg-emerald-950/55 dark:text-emerald-200",
      position: "left-1/2 top-[16%] -translate-x-1/2",
      width: "w-[16.5rem]",
      valueClassName: "text-[2.35rem]",
      paddingClassName: "px-5 py-2.5",
    },
    {
      key: "protein",
      label: proteinLabel,
      value: `${nutrition.proteinGrams}g`,
      tint: "border-violet-200/95 bg-white/92 text-violet-800 shadow-[0_0_32px_rgba(185,135,230,0.18)] dark:border-violet-800/60 dark:bg-violet-950/55 dark:text-violet-200",
      position: "left-[1.75rem] bottom-[12%] lg:left-[2.5rem]",
      width: "w-[9.5rem]",
      valueClassName: "text-[1.9rem]",
      paddingClassName: "px-4 py-2.5",
    },
    {
      key: "fat",
      label: "Fat",
      value: `${nutrition.fatGrams}g`,
      tint: "border-amber-200/95 bg-white/92 text-amber-800 shadow-[0_0_32px_rgba(251,191,36,0.18)] dark:border-amber-800/60 dark:bg-amber-950/55 dark:text-amber-200",
      position: "right-[1.25rem] bottom-[12%] lg:right-[2rem]",
      width: "w-[9.5rem]",
      valueClassName: "text-[1.9rem]",
      paddingClassName: "px-4 py-2.5",
    },
  ] as const;

  return (
    <section className="w-full rounded-[2.2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.09)] backdrop-blur dark:border-white/10 dark:bg-neutral-950/85 sm:p-5">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h2>
          <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
        </div>

        <div className="relative rounded-[2.2rem] border border-[#ECD9C8] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.96)_58%,rgba(255,244,236,0.92)_100%)] px-4 py-6 dark:border-[#60402B] dark:bg-[radial-gradient(circle_at_top,rgba(42,30,22,0.98),rgba(24,19,15,0.96)_58%,rgba(20,15,12,0.92)_100%)] sm:px-6">
          <div className="mx-auto flex max-w-[64rem] items-center justify-center gap-3 sm:gap-6">
            <div className="hidden md:flex min-w-[72px] flex-col items-center gap-6">
              {leftOrbs.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  title={item.label}
                  className={`flex h-16 w-16 items-center justify-center rounded-full ring-1 backdrop-blur transition-transform hover:scale-105 ${ORB_STYLES[index % ORB_STYLES.length]}`}
                >
                  <span className="scale-110">{item.icon}</span>
                </button>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mx-auto flex max-w-[30rem] flex-col items-center">
                <div className="relative flex h-[20rem] w-[20rem] items-center justify-center sm:h-[24rem] sm:w-[24rem]">
                  <svg
                    viewBox="0 0 320 320"
                    className="absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    {ringMetrics.map((ring) => {
                      const circumference = circleCircumference(ring.radius);
                      return (
                        <g key={ring.key}>
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke={ring.track}
                            strokeWidth={ring.strokeWidth}
                          />
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke={ring.color}
                            strokeWidth={ring.strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - ring.ratio)}
                            transform={`rotate(${ring.rotation} 160 160)`}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  <div className="absolute top-[1.65rem] flex flex-wrap items-center justify-center gap-2 text-center text-[11px] font-medium leading-tight sm:top-[1.9rem] sm:text-[13px]">
                    {topLegendPills.map((pill) => (
                      <span
                        key={`ring-label-${pill.key}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/88 px-3 py-1 text-foreground shadow-sm ring-1 ring-[#E8DCCE] dark:bg-neutral-900/78 dark:ring-white/10"
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pill.color }} />
                        {pill.label}
                      </span>
                    ))}
                  </div>

                  <div className="absolute inset-[3.1rem] rounded-full border border-[#EADFD3] bg-[radial-gradient(circle,rgba(255,247,230,0.96),rgba(255,239,210,0.94)_70%,rgba(255,232,186,0.88)_100%)] shadow-[0_0_45px_rgba(251,191,36,0.22)] dark:border-[#5F4634] dark:bg-[radial-gradient(circle,rgba(70,51,35,0.96),rgba(52,38,28,0.94)_70%,rgba(38,28,20,0.9)_100%)] sm:inset-[3.7rem]">
                    <div className="absolute inset-[0.7rem] rounded-full border border-[#ECD7BC]/80 dark:border-[#70513A]/70" />
                    <div className="absolute inset-[1.15rem] rounded-full border border-dashed border-[#D7B98C]/80 dark:border-[#8B6C4D]/60" />
                  </div>

                  {metricPills.map((pill) => (
                    <div
                      key={pill.key}
                      className={`absolute z-10 hidden md:flex ${pill.width} flex-col items-center rounded-[1.6rem] border text-center backdrop-blur ${pill.tint} ${pill.position} ${pill.paddingClassName}`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-75">
                        {pill.label}
                      </span>
                      <span className={`mt-1 font-semibold leading-none tracking-[-0.04em] ${pill.valueClassName}`}>
                        {pill.value}
                      </span>
                    </div>
                  ))}

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6 text-neutral-500 dark:text-neutral-400"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 8v4l2.5 1.5" />
                    </svg>
                    <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-foreground sm:text-6xl">
                      {pomodoroClockLabel}
                    </p>
                    <p className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-300">
                      {caloriesRemainingLabel}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenNutrition}
                      className="mt-0.5 text-3xl font-semibold tracking-[-0.04em] text-foreground transition-opacity hover:opacity-80 sm:text-4xl"
                    >
                      {nutrition.caloriesRemaining}
                    </button>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {[
                        {
                          key: "protein-mini",
                          color: "#B987E6",
                          value: `${nutrition.proteinGrams}/${nutritionGoals.proteinGrams}g`,
                        },
                        {
                          key: "carbs-mini",
                          color: "#F1B562",
                          value: `${nutrition.carbsGrams}/${nutritionGoals.carbsGrams}g`,
                        },
                      ].map((ring) => (
                        <span
                          key={`ring-value-${ring.key}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/78 px-3 py-1 ring-1 ring-[#E8DCCE] shadow-sm dark:bg-neutral-900/72 dark:ring-white/10"
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ring.color }} />
                          {ring.value}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="absolute bottom-[1.9rem] left-1/2 -translate-x-1/2 text-center text-[12px] font-semibold text-foreground sm:bottom-[2.35rem] sm:text-[15px]">
                    Pomodoro controls
                  </p>
                </div>

                <div className="mt-4 w-full max-w-[34rem] space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[30, 60, 90].map((minutes) => (
                      <button
                        key={`focus-canvas-duration-${minutes}`}
                        type="button"
                        onClick={() => onSelectPomodoroDuration(minutes)}
                        disabled={focusTrackerSaving || pomodoroSessionActive}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          pomodoroDurationMinutes === minutes
                            ? "border-[#B87B51] bg-[#FBF4EC] text-[#7C522D] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
                            : "border-neutral-300 bg-white/80 text-neutral-700 hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-200 dark:hover:bg-neutral-900"
                        } disabled:opacity-50`}
                      >
                        {minutes}m
                      </button>
                    ))}

                    <input
                      type="text"
                      value={focusSessionTagInput}
                      onChange={(event) => onFocusSessionTagInputChange(event.target.value)}
                      placeholder="Tag this focus session..."
                      disabled={focusTrackerSaving}
                      className="min-w-[15rem] flex-1 rounded-full border border-neutral-300 bg-white/88 px-5 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950/85"
                    />

                    <button
                      type="button"
                      onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
                      disabled={focusTrackerSaving}
                      className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm ring-1 ring-[#E4D8CB] transition-colors hover:bg-white disabled:opacity-50 dark:bg-neutral-900/90 dark:ring-white/10 dark:hover:bg-neutral-900"
                    >
                      {pomodoroSessionActive ? (pomodoroRunning ? "Pause" : "Resume") : "Start"}
                    </button>
                  </div>

                  <div className="grid grid-cols-5 overflow-hidden rounded-[1.35rem] border border-[#E4D8CB] bg-white/86 text-center dark:border-white/10 dark:bg-neutral-900/86">
                    <div className="border-r border-[#EDE2D7] px-3 py-2 dark:border-white/10">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{carbsLabel}</p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className="text-xl font-semibold text-foreground">{nutrition.carbsGrams}</span>
                        <span className="text-[11px] text-neutral-400">/{nutritionGoals.carbsGrams}</span>
                      </div>
                    </div>
                    <div className="border-r border-[#EDE2D7] px-3 py-2 dark:border-white/10">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{proteinLabel}</p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className="text-xl font-semibold text-foreground">{nutrition.proteinGrams}</span>
                        <span className="text-[11px] text-neutral-400">/{nutritionGoals.proteinGrams}</span>
                      </div>
                    </div>
                    <div className="border-r border-[#EDE2D7] px-3 py-2 dark:border-white/10">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Fat</p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className="text-xl font-semibold text-foreground">{nutrition.fatGrams}</span>
                        <span className="text-[11px] text-neutral-400">/{nutritionGoals.fatGrams}</span>
                      </div>
                    </div>
                    <div className="border-r border-[#EDE2D7] px-3 py-2 dark:border-white/10">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Exercise</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{nutrition.caloriesExercise}</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{foodLoggedLabel}</p>
                      <p className="mt-1 text-xl font-semibold text-foreground">{nutrition.caloriesFood}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={600}
                      step={1}
                      value={pomodoroCustomMinutesInput}
                      onChange={(event) => onPomodoroCustomMinutesInputChange(event.target.value)}
                      disabled={focusTrackerSaving || pomodoroSessionActive}
                      className="w-24 rounded-full border border-neutral-300 bg-white/88 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950/85"
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

                  <div className="rounded-[1.35rem] border border-neutral-200/80 bg-white/75 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                          {focusSummaryLabel}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                          {focusSummaryMinutes} min, {focusSummarySessions} session{focusSummarySessions === 1 ? "" : "s"}
                        </p>
                      </div>
                      {focusSummaryRows[0] ? (
                        <p className="max-w-[18rem] truncate text-sm text-neutral-500 dark:text-neutral-400">
                          Latest: {focusSummaryRows[0].label}
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{noFocusLoggedLabel}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:flex min-w-[72px] flex-col items-center gap-6">
              {rightOrbs.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  title={item.label}
                  className={`flex h-16 w-16 items-center justify-center rounded-full ring-1 backdrop-blur transition-transform hover:scale-105 ${ORB_STYLES[(index + 3) % ORB_STYLES.length]}`}
                >
                  <span className="scale-110">{item.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {quickCaptures.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 md:hidden">
              {quickCaptures.slice(0, 6).map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[1.35rem] px-3 py-3 ring-1 backdrop-blur ${ORB_STYLES[index % ORB_STYLES.length]}`}
                >
                  <span>{item.icon}</span>
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="hidden">
            <button type="button" onClick={onOpenNutrition}>
              {nutritionLabel}
            </button>
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
          </div>
        </div>
      </div>
    </section>
  );
}
