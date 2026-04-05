"use client";

import React, { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { ScoreRing } from "@/components/landing/ScoreRing";
import { computeDayScore } from "@/lib/day-score";
import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingWeeklySummaryPreview,
} from "@/components/landing/types";

function rawPct(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, (current / target) * 100);
}

interface LandingFocusCanvasProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  nutritionLabel: string;
  carbsLabel: string;
  proteinLabel: string;
  foodLoggedLabel: string;
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  weeklySummary: LandingWeeklySummaryPreview | null;
  focusMinutes: number;
  focusSessions: number;
  heroHabitCount: number;
  heroHabitsCompletedToday: number;
  sleepHours: number | null;
  sleepScore: number | null;
  onOpenNutrition: () => void;
  onSearchFood: () => void;
  onCaptureFood: () => void;
  onDescribeFood: () => void;
}

const MACROS = [
  { key: "calories", color: "#9A8872", overColor: "#6B5A46", trackColor: "rgba(154,136,114,0.15)" },
  { key: "protein", color: "#5A9E8A", overColor: "#3B6E5E", trackColor: "rgba(90,158,138,0.15)" },
  { key: "carbs", color: "#D49A42", overColor: "#A0712A", trackColor: "rgba(212,154,66,0.15)" },
  { key: "fat", color: "#C4705E", overColor: "#8E4438", trackColor: "rgba(196,112,94,0.15)" },
] as const;

function MacroIcon({ macroKey, color }: { macroKey: string; color: string }) {
  switch (macroKey) {
    case "calories":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={color} className="w-4 h-4 shrink-0">
          <path d="M12 23c-3.866 0-7-3.358-7-7.5 0-3.072 2.456-6.727 4.535-9.067A1.5 1.5 0 0 1 12 6.5c0 1-.5 2-1.5 3 2-1.5 3.5-4 4-6.5a1 1 0 0 1 1.735-.5C18.538 5.262 19 8.986 19 11.5c0 2.073-.493 4.14-1.692 5.69C15.87 19.195 14.085 21 12 23Zm0-5a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1-3-2.5-4-1.5 1-2.5 2.5-2.5 4A2.5 2.5 0 0 0 12 18Z" />
        </svg>
      );
    case "protein":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M12 2c-3 0-5.5 4.5-5.5 9.5S8.5 22 12 22s5.5-5.5 5.5-10.5S15 2 12 2Z" />
        </svg>
      );
    case "carbs":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M2 22 16 8" />
          <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
          <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
        </svg>
      );
    case "fat":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15.5v.01" />
          <path d="M12 12v.01" />
          <path d="M11 17v.01" />
          <path d="M7 14v.01" />
        </svg>
      );
    default:
      return null;
  }
}

function ScorePill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}14`, color }}
    >
      {icon}
      {label}
      <span className="ml-0.5 tabular-nums">{value}</span>
    </span>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="module-nested flex flex-1 flex-col items-center gap-1.5 px-3 py-3 text-center transition-all hover:shadow-md active:scale-[0.97] dark:hover:bg-neutral-800/90"
    >
      <span className="text-neutral-600 dark:text-neutral-300">{icon}</span>
      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">{label}</span>
    </button>
  );
}

export function LandingFocusCanvas({
  eyebrow,
  title,
  subtitle,
  nutritionLabel: _nutritionLabel,
  carbsLabel,
  proteinLabel,
  foodLoggedLabel: _foodLoggedLabel,
  nutrition,
  nutritionGoals,
  weeklySummary,
  focusMinutes,
  focusSessions,
  heroHabitCount,
  heroHabitsCompletedToday,
  sleepHours,
  sleepScore: sleepScoreProp,
  onOpenNutrition,
  onSearchFood,
  onCaptureFood,
  onDescribeFood,
}: LandingFocusCanvasProps) {
  const caloriesConsumed = nutrition.caloriesFood;
  const score = useMemo(
    () =>
      computeDayScore({
        nutrition,
        nutritionGoals,
        focusMinutes,
        focusSessions,
        heroHabitCount,
        heroHabitsCompletedToday,
        sleepHours,
        sleepScore: sleepScoreProp,
      }),
    [nutrition, nutritionGoals, focusMinutes, focusSessions, heroHabitCount, heroHabitsCompletedToday, sleepHours, sleepScoreProp],
  );

  function makebar(
    key: string, label: string, current: number, target: number, unit: string,
    macro: { color: string; overColor: string; trackColor: string },
  ) {
    const raw = rawPct(current, target);
    const over = raw > 100;
    const cappedRaw = Math.min(raw, 200);
    const diff = target - current;
    return {
      key, label, current, target, unit, diff,
      color: macro.color,
      overColor: macro.overColor,
      trackColor: macro.trackColor,
      fillPct: over ? 100 : Math.min(raw, 100),
      targetMarkerPct: over ? (100 / cappedRaw) * 100 : 0,
      overflow: over,
    };
  }

  const bars = [
    makebar("calories", "Calories", caloriesConsumed, nutritionGoals.caloriesTarget, "kcal", MACROS[0]),
    makebar("protein", proteinLabel, nutrition.proteinGrams, nutritionGoals.proteinGrams, "g", MACROS[1]),
    makebar("carbs", carbsLabel, nutrition.carbsGrams, nutritionGoals.carbsGrams, "g", MACROS[2]),
    makebar("fat", "Fat", nutrition.fatGrams, nutritionGoals.fatGrams, "g", MACROS[3]),
  ];

  const trendOptions = useMemo<Highcharts.Options | null>(() => {
    if (!weeklySummary || weeklySummary.rows.length === 0) return null;
    const rows = weeklySummary.rows;
    const categories = rows.map((r) => r.weekdayLabel);
    const data = rows.map((r) => r.caloriesFood);
    const target = nutritionGoals.caloriesTarget;

    return {
      chart: {
        backgroundColor: "transparent",
        height: 100,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [4, 0, 4, 0],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { enabled: false },
      xAxis: {
        categories,
        lineColor: "transparent",
        tickColor: "transparent",
        labels: { style: { color: "#a3a3a3", fontSize: "9px" } },
      },
      yAxis: {
        title: { text: undefined },
        labels: { enabled: false },
        gridLineWidth: 0,
        min: 0,
        plotLines: [
          {
            value: target,
            color: "#B87B5180",
            width: 1.5,
            dashStyle: "Dash",
            zIndex: 3,
          },
        ],
      },
      tooltip: {
        backgroundColor: "#1c1917",
        borderColor: "#44403c",
        style: { color: "#fafaf9", fontSize: "11px" },
        pointFormat: "{point.y} kcal",
        headerFormat: "<b>{point.key}</b><br/>",
      },
      plotOptions: {
        column: {
          groupPadding: 0.08,
          pointPadding: 0.04,
          borderRadius: 3,
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "column",
          data: data.map((val) => ({
            y: val,
            color: val > target
              ? { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(196,112,94,0.8)"], [1, "rgba(196,112,94,0.35)"]] }
              : { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(154,136,114,0.8)"], [1, "rgba(154,136,114,0.3)"]] },
          })),
        },
      ],
    };
  }, [weeklySummary, nutritionGoals.caloriesTarget]);

  return (
    <section className="landing-module-glass w-full overflow-hidden rounded-[2rem] border p-4 sm:p-5">
      <div className="flex flex-col gap-5">
        {/* header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>

        {/* score ring or empty prompt */}
        {score.empty ? (
          <button
            type="button"
            onClick={onDescribeFood}
            className="flex flex-col items-center gap-2 py-4"
          >
            <div className="flex h-[148px] w-[148px] items-center justify-center rounded-full border-[11px] border-neutral-400/65 dark:border-neutral-500/55">
              <div className="flex flex-col items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-neutral-400 dark:text-neutral-500">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Start logging</span>
              </div>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Log food, focus, habits, or sleep to see your day score
            </p>
          </button>
        ) : (
          <>
            <div className="flex justify-center">
              <ScoreRing score={score.overall} label={score.label} size={148} strokeWidth={11} />
            </div>

            {/* sub-score pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ScorePill
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M12 23c-3.866 0-7-3.358-7-7.5 0-3.072 2.456-6.727 4.535-9.067A1.5 1.5 0 0 1 12 6.5c0 1-.5 2-1.5 3 2-1.5 3.5-4 4-6.5a1 1 0 0 1 1.735-.5C18.538 5.262 19 8.986 19 11.5c0 2.073-.493 4.14-1.692 5.69C15.87 19.195 14.085 21 12 23Z" />
                  </svg>
                }
                label="Nutrition"
                value={score.nutritionScore}
                color="#9A8872"
              />
              <ScorePill
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M18 20V6.5a2.5 2.5 0 0 0-5 0V20" />
                    <path d="M2 20h20" />
                    <path d="M6 20V9a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v11" />
                  </svg>
                }
                label="Exercise"
                value={score.exerciseScore}
                color="#f97316"
              />
              <ScorePill
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
                label="Focus"
                value={score.focusScore}
                color="#14b8a6"
              />
              <ScorePill
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                }
                label="Habits"
                value={score.habitsScore}
                color="#5A9E8A"
              />
              <ScorePill
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                }
                label="Sleep"
                value={score.sleepScore}
                color="#6366f1"
              />
            </div>
          </>
        )}

        {/* action buttons */}
        <div className="flex gap-2">
          <ActionButton
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            }
            label="Search"
            onClick={onSearchFood}
          />
          <ActionButton
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            }
            label="Capture"
            onClick={onCaptureFood}
          />
          <ActionButton
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
              </svg>
            }
            label="Describe"
            onClick={onDescribeFood}
          />
        </div>

        {/* macro bars */}
        <button
          type="button"
          onClick={onOpenNutrition}
          className="relative rounded-[2rem] border border-[#ECD9C8] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.96)_58%,rgba(255,244,236,0.92)_100%)] px-4 py-5 text-left transition-opacity hover:opacity-90 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800 sm:px-6"
        >
          <div className="mx-auto max-w-[32rem] space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
              Goals
            </p>
            {bars.map((bar) => (
              <div key={bar.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5">
                    <MacroIcon macroKey={bar.key} color={bar.color} />
                    <span className="text-xs font-semibold text-foreground">
                      {bar.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: bar.overflow ? bar.overColor : bar.color }}
                    >
                      {bar.current}
                    </span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      / {bar.target} {bar.unit}
                    </span>
                  </div>
                </div>

                <div
                  className="relative h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: bar.trackColor }}
                >
                  {!bar.overflow ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${bar.fillPct}%`,
                        backgroundColor: bar.color,
                        boxShadow: bar.fillPct > 0 ? `0 0 8px ${bar.color}40` : undefined,
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${bar.targetMarkerPct}%`,
                          backgroundColor: bar.color,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 rounded-r-full transition-[width] duration-500 ease-out"
                        style={{
                          left: `${bar.targetMarkerPct}%`,
                          width: `${100 - bar.targetMarkerPct}%`,
                          backgroundColor: bar.overColor,
                          boxShadow: `0 0 8px ${bar.overColor}40`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 w-[2px] -translate-x-[1px]"
                        style={{
                          left: `${bar.targetMarkerPct}%`,
                          backgroundColor: "rgba(255,255,255,0.7)",
                        }}
                      />
                    </>
                  )}
                </div>

                {/* left / over indicator */}
                <p className="text-[11px] font-medium tabular-nums">
                  {bar.overflow ? (
                    <span style={{ color: bar.overColor }}>
                      {Math.abs(Math.round(bar.diff))}{bar.unit === "kcal" ? " kcal" : bar.unit} over
                    </span>
                  ) : bar.diff > 0 ? (
                    <span style={{ color: bar.color }}>
                      {Math.round(bar.diff)}{bar.unit === "kcal" ? " kcal" : bar.unit} left
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </button>

        {/* 7-day calorie trend mini-chart */}
        {trendOptions && (
          <div className="module-chart-inset px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
              Calories — 7 Day Trend
            </p>
            <HighchartsReact highcharts={Highcharts} options={trendOptions} />
          </div>
        )}
      </div>
    </section>
  );
}
