"use client";

import React, { useRef, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type {
  LandingFoodSuggestion,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingRecentFoodEntry,
  LandingWeeklySummaryPreview,
} from "@/components/landing/types";

interface LandingMobileNutritionTabProps {
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  weeklySummary: LandingWeeklySummaryPreview | null;
  onOpenNutrition: () => void;
  onSearchFood: () => void;
  onCaptureFood: () => void;
  inlineFoodInput: string;
  onInlineFoodInputChange: (value: string) => void;
  onInlineFoodSubmit: () => void;
  inlineFoodLoading: boolean;
  inlineFoodSuggestions: LandingFoodSuggestion[];
  inlineFoodSuggestionsLoading: boolean;
  onInlineFoodSuggestionSelect: (suggestionId: string) => void;
  recentFoodEntries: LandingRecentFoodEntry[];
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
}

function barColor(current: number, target: number): string {
  if (target <= 0) return "#a3a3a3";
  const ratio = current / target;
  if (ratio > 1.15) return "#EF4444";
  if (ratio < 0.5) return "#EF4444";
  return "#22C55E";
}

const MACRO_ICONS: Record<string, string> = {
  calories: "🔥",
  carbs: "🍎",
  protein: "🐟",
  fat: "💧",
};

export function LandingMobileNutritionTab({
  nutrition,
  nutritionGoals,
  weeklySummary,
  onOpenNutrition,
  onSearchFood,
  onCaptureFood,
  inlineFoodInput,
  onInlineFoodInputChange,
  onInlineFoodSubmit,
  inlineFoodLoading,
  inlineFoodSuggestions,
  inlineFoodSuggestionsLoading,
  onInlineFoodSuggestionSelect,
  recentFoodEntries,
}: LandingMobileNutritionTabProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const totalCalories = nutrition.caloriesFood;

  const showTypeahead =
    inputFocused &&
    inlineFoodInput.trim().length > 0 &&
    inlineFoodSuggestions.length > 0;

  const trendOptions = useMemo<Highcharts.Options | null>(() => {
    if (!weeklySummary || weeklySummary.rows.length === 0) return null;
    const rows = weeklySummary.rows;
    const categories = rows.map((r) => r.weekdayLabel);
    const data = rows.map((r) => r.caloriesFood);
    const target = nutritionGoals.caloriesTarget;

    return {
      chart: {
        backgroundColor: "transparent",
        height: 120,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [6, 4, 6, 4],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { enabled: false },
      xAxis: {
        categories,
        lineColor: "transparent",
        tickColor: "transparent",
        labels: { style: { color: "#a3a3a3", fontSize: "10px" } },
      },
      yAxis: {
        title: { text: undefined },
        labels: { enabled: false },
        gridLineWidth: 0,
        min: 0,
        plotLines: [
          {
            value: target,
            color: "#B87B5160",
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
          groupPadding: 0.06,
          pointPadding: 0.04,
          borderRadius: 4,
          borderWidth: 0,
        },
      },
      series: [
        {
          type: "column",
          data: data.map((val) => ({
            y: val,
            color:
              val > target
                ? { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(196,112,94,0.85)"], [1, "rgba(196,112,94,0.35)"]] }
                : { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(154,136,114,0.85)"], [1, "rgba(154,136,114,0.3)"]] },
          })),
        },
      ],
    };
  }, [weeklySummary, nutritionGoals.caloriesTarget]);

  const goalRows = [
    { key: "calories", label: "Calories", icon: MACRO_ICONS.calories, current: totalCalories, target: nutritionGoals.caloriesTarget, unit: "" },
    { key: "carbs", label: "Carbs", icon: MACRO_ICONS.carbs, current: nutrition.carbsGrams, target: nutritionGoals.carbsGrams, unit: "g" },
    { key: "protein", label: "Protein", icon: MACRO_ICONS.protein, current: nutrition.proteinGrams, target: nutritionGoals.proteinGrams, unit: "g" },
    { key: "fat", label: "Fat", icon: MACRO_ICONS.fat, current: nutrition.fatGrams, target: nutritionGoals.fatGrams, unit: "g" },
  ];

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      {/* Goals — progress bars */}
      <div className="landing-module-glass rounded-2xl border px-4 py-4">
        <p className="mb-3 text-[15px] font-bold text-foreground">Goals</p>
        <div className="flex flex-col gap-3">
          {goalRows.map((row) => {
            const color = barColor(row.current, row.target);
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <span>{row.icon}</span> {row.label}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">
                    {Math.round(row.current).toLocaleString()} / {row.target.toLocaleString()}{row.unit}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700/50">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(pct(row.current, row.target), 100)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onOpenNutrition}
          className="mt-3 w-full rounded-xl border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          View details
        </button>
      </div>

      {/* Inline food input */}
      <div className="relative">
        <div className="landing-module-glass overflow-hidden rounded-2xl border">
          <textarea
            ref={textareaRef}
            value={inlineFoodInput}
            onChange={(e) => onInlineFoodInputChange(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 200)}
            disabled={inlineFoodLoading}
            rows={2}
            placeholder="What did you eat? e.g. 2 eggs + toast, chicken bowl..."
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-foreground placeholder:text-neutral-400 outline-none disabled:opacity-50 dark:placeholder:text-neutral-500"
          />
          <div className="flex items-center justify-between border-t border-neutral-200/60 px-3 py-2 dark:border-neutral-700/40">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onSearchFood}
                className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Search
              </button>
              <button
                type="button"
                onClick={onCaptureFood}
                className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Capture
              </button>
            </div>
            <button
              type="button"
              onClick={onInlineFoodSubmit}
              disabled={inlineFoodLoading || !inlineFoodInput.trim()}
              className="rounded-xl bg-[#B87B51] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#A66B41] disabled:opacity-40 dark:bg-[#D6A67E] dark:text-neutral-900 dark:hover:bg-[#C49670]"
            >
              {inlineFoodLoading ? "Logging…" : "Log it"}
            </button>
          </div>
        </div>

        {/* Typeahead suggestions */}
        {showTypeahead && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {inlineFoodSuggestions.slice(0, 4).map((s) => {
              const macroBits = [
                s.calories != null ? `🔥 ${s.calories} cal` : null,
                s.proteinGrams != null ? `P: ${s.proteinGrams}g` : null,
                s.carbsGrams != null ? `C: ${s.carbsGrams}g` : null,
                s.fatGrams != null ? `F: ${s.fatGrams}g` : null,
              ]
                .filter(Boolean)
                .join("  ");
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInlineFoodSuggestionSelect(s.id)}
                  className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground truncate">
                      {s.displayName || s.sampleEntry.split("\n").find(Boolean)?.slice(0, 60) || "Saved entry"}
                    </span>
                    {macroBits && (
                      <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {macroBits}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading indicator for suggestions */}
        {inputFocused && inlineFoodInput.trim().length > 0 && inlineFoodSuggestionsLoading && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Looking up matches…</p>
          </div>
        )}
      </div>

      {/* Recents — compact list with macro breakdown */}
      {recentFoodEntries.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl border">
            {recentFoodEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`px-3.5 py-2.5 ${idx > 0 ? "border-t border-neutral-100 dark:border-neutral-800" : ""}`}
              >
                <p className="truncate text-[13px] font-medium text-foreground">{entry.label}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                  <span>🔥 {entry.calories} cal</span>
                  {entry.proteinGrams > 0 && <span>P: {entry.proteinGrams}g</span>}
                  {entry.carbsGrams > 0 && <span>C: {entry.carbsGrams}g</span>}
                  {entry.fatGrams > 0 && <span>F: {entry.fatGrams}g</span>}
                  {entry.time && <span className="ml-auto">{entry.time}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-day calorie trend */}
      {trendOptions && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Calories — 7 Day Trend
          </p>
          <HighchartsReact highcharts={Highcharts} options={trendOptions} />
        </div>
      )}
    </div>
  );
}
