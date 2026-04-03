"use client";

import React, { useState, useCallback } from "react";

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

function degToRad(deg: number): number {
  return (deg - 90) * (Math.PI / 180);
}

function pointOnCircle(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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
  const ringMetrics = [
    {
      key: "calories",
      radius: 140,
      strokeWidth: 18,
      ratio: caloriesRatio,
      gradientStart: "#5BA3D9",
      gradientEnd: "#A8D4F5",
      glow: "rgba(91,163,217,0.45)",
      track: "rgba(220, 210, 198, 0.5)",
      rotation: -90,
      label: nutritionLabel,
      displayValue: `${caloriesConsumed}`,
      displayUnit: `/ ${nutritionGoals.caloriesTarget}`,
      labelAngle: 45,
      fontSize: 11,
    },
    {
      key: "focus",
      radius: 116,
      strokeWidth: 16,
      ratio: focusRatio,
      gradientStart: "#4DA065",
      gradientEnd: "#A8DCAF",
      glow: "rgba(77,160,101,0.4)",
      track: "rgba(224, 214, 202, 0.45)",
      rotation: -90,
      label: focusSummaryLabel,
      displayValue: `${focusSummaryMinutes}`,
      displayUnit: "m",
      labelAngle: 135,
      fontSize: 10,
    },
    {
      key: "protein",
      radius: 94,
      strokeWidth: 14,
      ratio: proteinRatio,
      gradientStart: "#9B5FD6",
      gradientEnd: "#D4B0F5",
      glow: "rgba(155,95,214,0.38)",
      track: "rgba(228, 218, 206, 0.4)",
      rotation: -90,
      label: proteinLabel,
      displayValue: `${nutrition.proteinGrams}`,
      displayUnit: `/ ${nutritionGoals.proteinGrams}g`,
      labelAngle: 225,
      fontSize: 9.5,
    },
    {
      key: "carbs",
      radius: 74,
      strokeWidth: 12,
      ratio: carbsRatio,
      gradientStart: "#E5A030",
      gradientEnd: "#F5D78A",
      glow: "rgba(229,160,48,0.35)",
      track: "rgba(230, 220, 208, 0.38)",
      rotation: -90,
      label: carbsLabel,
      displayValue: `${nutrition.carbsGrams}`,
      displayUnit: `/ ${nutritionGoals.carbsGrams}g`,
      labelAngle: 315,
      fontSize: 9,
    },
    {
      key: "fat",
      radius: 56,
      strokeWidth: 11,
      ratio: fatRatio,
      gradientStart: "#D96050",
      gradientEnd: "#F5A898",
      glow: "rgba(217,96,80,0.32)",
      track: "rgba(232, 222, 210, 0.35)",
      rotation: -90,
      label: "Fat",
      displayValue: `${nutrition.fatGrams}`,
      displayUnit: `/ ${nutritionGoals.fatGrams}g`,
      labelAngle: 180,
      fontSize: 8.5,
    },
  ] as const;
  const [activeRing, setActiveRing] = useState<string | null>(null);
  const handleRingClick = useCallback((key: string) => {
    setActiveRing((prev) => (prev === key ? null : key));
  }, []);

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
          <div className="mx-auto flex max-w-[64rem] items-center justify-center">
            <div className="min-w-0 flex-1">
              <div className="mx-auto flex max-w-[30rem] flex-col items-center">
                <div className="relative flex h-[20rem] w-[20rem] items-center justify-center overflow-visible sm:h-[24rem] sm:w-[24rem]">
                  <svg
                    viewBox="0 0 320 320"
                    className="absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    <defs>
                      {ringMetrics.map((ring) => (
                        <React.Fragment key={`defs-${ring.key}`}>
                          <linearGradient id={`grad-${ring.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={ring.gradientStart} />
                            <stop offset="100%" stopColor={ring.gradientEnd} />
                          </linearGradient>
                          <filter id={`glow-${ring.key}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                            <feFlood floodColor={ring.glow} result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="shadow" />
                            <feMerge>
                              <feMergeNode in="shadow" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </React.Fragment>
                      ))}
                    </defs>
                    {ringMetrics.map((ring) => {
                      const circumference = circleCircumference(ring.radius);
                      const isActive = activeRing === ring.key;
                      const labelPos = pointOnCircle(160, 160, ring.radius, ring.labelAngle);
                      return (
                        <g key={ring.key} style={{ cursor: "pointer" }} onClick={() => handleRingClick(ring.key)}>
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={ring.strokeWidth + 10}
                          />
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke={ring.track}
                            strokeWidth={ring.strokeWidth}
                            opacity={activeRing && !isActive ? 0.35 : 1}
                          />
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke={`url(#grad-${ring.key})`}
                            strokeWidth={isActive ? ring.strokeWidth + 4 : ring.strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - ring.ratio)}
                            transform={`rotate(${ring.rotation} 160 160)`}
                            filter={`url(#glow-${ring.key})`}
                            opacity={activeRing && !isActive ? 0.4 : 1}
                            style={{ transition: "stroke-width 0.2s ease, opacity 0.2s ease" }}
                          />
                          {isActive && (
                            <g>
                              <rect
                                x={labelPos.x - 28}
                                y={labelPos.y - 16}
                                width="56"
                                height="32"
                                rx="10"
                                fill="white"
                                fillOpacity="0.95"
                                stroke={ring.gradientStart}
                                strokeWidth="1.4"
                                strokeOpacity="0.55"
                              />
                              <text
                                x={labelPos.x}
                                y={labelPos.y - 3}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fill={ring.gradientStart}
                                fontSize={ring.fontSize + 1}
                                fontWeight="700"
                                fontFamily="system-ui, sans-serif"
                              >
                                {ring.displayValue}
                              </text>
                              <text
                                x={labelPos.x}
                                y={labelPos.y + ring.fontSize}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fill="rgba(120,110,100,0.75)"
                                fontSize={ring.fontSize * 0.72}
                                fontWeight="500"
                                fontFamily="system-ui, sans-serif"
                              >
                                {ring.label} {ring.displayUnit}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <div className="absolute inset-[7rem] rounded-full border border-[#EADFD3]/60 bg-[radial-gradient(circle,rgba(255,250,240,0.97),rgba(255,245,228,0.94)_70%,rgba(255,240,218,0.88)_100%)] shadow-[inset_0_0_30px_rgba(255,230,190,0.3)] dark:border-[#5F4634]/50 dark:bg-[radial-gradient(circle,rgba(55,40,28,0.97),rgba(42,30,22,0.94)_70%,rgba(32,24,18,0.9)_100%)] sm:inset-[8.5rem]" />


                  <button
                    type="button"
                    onClick={onOpenNutrition}
                    className="relative z-10 flex flex-col items-center gap-1.5 text-center transition-opacity hover:opacity-80"
                  >
                    {/* Calories */}
                    <div className="flex items-baseline gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#5BA3D9" className="h-3.5 w-3.5 self-center shrink-0" aria-hidden>
                        <path d="M12.556 3.252c-.155-.07-.326-.07-.48 0a12.764 12.764 0 0 0-4.1 3.26C6.32 8.39 5 10.76 5 13.5a5 5 0 0 0 10 0c0-2.74-1.32-5.11-2.976-6.988a12.764 12.764 0 0 0-1.468-1.26Zm-2.433 6.212a.75.75 0 0 1 1.354 0l.04.088c.427.93.713 1.636.713 2.448a1.98 1.98 0 1 1-3.96 0c0-.812.286-1.518.713-2.448l.04-.088a.755.755 0 0 1 1.1 0Z"/>
                      </svg>
                      <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{caloriesConsumed}</span>
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">/ {nutritionGoals.caloriesTarget}</span>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">kcal</span>

                    {/* Macros row */}
                    <div className="mt-1 flex items-center gap-3">
                      {/* Protein */}
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#9B5FD6" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.proteinGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">P</span>
                      </div>
                      {/* Carbs */}
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#E5A030" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.carbsGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">C</span>
                      </div>
                      {/* Fat */}
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#D96050" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.fatGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">F</span>
                      </div>
                    </div>
                  </button>
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
