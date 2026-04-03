"use client";

import React from "react";

import type {
  LandingFocusSummaryRow,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingTabId,
} from "@/components/landing/types";

function clampRatio(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

interface LandingFocusCanvasProps {
  mode: LandingTabId;
  eyebrow: string;
  title: string;
  subtitle: string;
  journalingModeLabel: string;
  pomodoroModeLabel: string;
  deepThinkingModeLabel: string;
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
  mode,
  eyebrow,
  title,
  subtitle,
  journalingModeLabel,
  pomodoroModeLabel,
  deepThinkingModeLabel,
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
  const proteinRatio = clampRatio(nutrition.proteinGrams, nutritionGoals.proteinGrams);
  const modeLabel =
    mode === "pomodoro"
      ? pomodoroModeLabel
      : mode === "deepThinking"
        ? deepThinkingModeLabel
        : journalingModeLabel;

  return (
    <section className="w-full rounded-[2.2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.09)] backdrop-blur dark:border-white/10 dark:bg-neutral-950/85 sm:p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {subtitle}
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-[#E9D5C2] bg-[#FBF4EC] px-3 py-1 text-xs font-semibold text-[#7C522D] dark:border-[#6A4A33] dark:bg-[#241a14] dark:text-[#E8C3A0]">
            {modeLabel}
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_1fr]">
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenNutrition}
              className="w-full rounded-[1.7rem] border border-neutral-200/80 bg-[#FFF8F1] p-4 text-left transition-colors hover:bg-[#FDF0E2] dark:border-neutral-800 dark:bg-[#1D1712] dark:hover:bg-[#261D17]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B87B51] dark:text-[#D6A67E]">
                {nutritionLabel}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{nutrition.caloriesRemaining}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {caloriesRemainingLabel} / {nutritionGoals.caloriesTarget}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{nutrition.caloriesFood}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{foodLoggedLabel}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{nutrition.carbsGrams}g</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{carbsLabel}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{nutrition.proteinGrams}g</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{proteinLabel}</p>
                </div>
              </div>
            </button>

            <div className="rounded-[1.7rem] border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                    {focusSummaryLabel}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{focusSummaryMinutes} min</p>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {focusSummarySessions} session{focusSummarySessions === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {focusSummaryRows.length > 0 ? (
                  focusSummaryRows.slice(0, 4).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <span className="truncate text-sm text-foreground">{row.label}</span>
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {row.minutes} min
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {noFocusLoggedLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-[#ECD9C8] bg-[radial-gradient(circle_at_top,#FFF7F0,transparent_62%),linear-gradient(180deg,#FFFDFB_0%,#FFF3E8_100%)] p-5 dark:border-[#60402B] dark:bg-[radial-gradient(circle_at_top,#2A1E16,transparent_62%),linear-gradient(180deg,#17110D_0%,#120D09_100%)]">
            <div className="flex justify-center">
              <div
                className="relative flex h-[18rem] w-[18rem] max-w-full items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#B87B51 0deg ${Math.round(caloriesRatio * 150)}deg, #E4D3C2 ${Math.round(
                    caloriesRatio * 150
                  )}deg 180deg, #6D7F60 180deg ${180 + Math.round(focusRatio * 110)}deg, #D8C4F2 ${180 + Math.round(
                    focusRatio * 110
                  )}deg ${180 + Math.round(focusRatio * 180)}deg, #D946EF ${180 + Math.round(focusRatio * 180)}deg ${
                    180 + Math.round((focusRatio + proteinRatio) * 90)
                  }deg, #EEE2D6 ${180 + Math.round((focusRatio + proteinRatio) * 90)}deg 360deg)`,
                }}
              >
                <div className="absolute inset-[16px] rounded-full bg-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:bg-neutral-950/92" />
                <div className="relative z-10 flex flex-col items-center text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500 dark:text-neutral-400">
                    {liveFocusLabel}
                  </p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl">
                    {pomodoroClockLabel}
                  </p>
                  <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    Protein {nutrition.proteinGrams}/{nutritionGoals.proteinGrams}g
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={pomodoroSessionActive ? (pomodoroRunning ? onPausePomodoro : onStartPomodoro) : onStartPomodoro}
                      disabled={focusTrackerSaving}
                      className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {pomodoroSessionActive ? (pomodoroRunning ? "Pause" : "Resume") : "Start"}
                    </button>
                    <button
                      type="button"
                      onClick={onResetPomodoro}
                      disabled={focusTrackerSaving}
                      className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
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
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {[30, 60, 90].map((minutes) => (
                <button
                  key={`focus-canvas-duration-${minutes}`}
                  type="button"
                  onClick={() => onSelectPomodoroDuration(minutes)}
                  disabled={focusTrackerSaving || pomodoroSessionActive}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    pomodoroDurationMinutes === minutes
                      ? "border-[#B87B51] bg-[#FBF4EC] text-[#7C522D] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
                      : "border-neutral-300 text-neutral-600 hover:bg-white dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  } disabled:opacity-50`}
                >
                  {minutes}m
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="text"
                value={focusSessionTagInput}
                onChange={(event) => onFocusSessionTagInputChange(event.target.value)}
                placeholder="Tag this focus session"
                disabled={focusTrackerSaving}
                className="w-full rounded-2xl border border-neutral-300 bg-white/90 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950/85"
              />
              <div className="grid grid-cols-[96px_auto] gap-2 sm:grid-cols-[110px_auto]">
                <input
                  type="number"
                  min={1}
                  max={600}
                  step={1}
                  value={pomodoroCustomMinutesInput}
                  onChange={(event) => onPomodoroCustomMinutesInputChange(event.target.value)}
                  disabled={focusTrackerSaving || pomodoroSessionActive}
                  className="w-full rounded-2xl border border-neutral-300 bg-white/90 px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950/85"
                />
                <button
                  type="button"
                  onClick={onApplyCustomPomodoroMinutes}
                  disabled={focusTrackerSaving || pomodoroSessionActive}
                  className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Set
                </button>
              </div>
            </div>

            {(focusTrackerError || pomodoroJustLogged) && (
              <p
                className={`mt-3 text-sm ${
                  focusTrackerError
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {focusTrackerError ?? "Focus session logged."}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.7rem] border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                {quickCaptureTitle}
              </p>
              <div className="mt-3 space-y-2">
                {quickCaptures.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 rounded-[1.25rem] border border-neutral-200 px-3 py-3 text-left transition-colors hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                        {item.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                {manualFocusLogTitle}
              </p>
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={customFocusTagInput}
                  onChange={(event) => onCustomFocusTagInputChange(event.target.value)}
                  placeholder="e.g. Deep work, Reading"
                  disabled={focusTrackerSaving}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    step={1}
                    value={customFocusMinutesInput}
                    onChange={(event) => onCustomFocusMinutesInputChange(event.target.value)}
                    disabled={focusTrackerSaving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    placeholder="Minutes"
                  />
                  <input
                    type="time"
                    value={customFocusTimeInput}
                    onChange={(event) => onCustomFocusTimeInputChange(event.target.value)}
                    disabled={focusTrackerSaving}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
                <button
                  type="button"
                  onClick={onAddCustomFocusEntry}
                  disabled={focusTrackerSaving}
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-950"
                >
                  Add focus entry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
