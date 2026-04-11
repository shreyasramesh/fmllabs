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
import {
  journalTypeBadgeClass,
  JOURNAL_CATEGORY_TAG_PILL_CLASS,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import {
  AMY_JOURNAL_LIST_GRID,
  DeleteEntryIcon,
} from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { SparklesIcon } from "@/components/SharedIcons";
import { LandingMobileGoalsCard } from "@/components/landing/LandingMobileGoalsCard";

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
  onRecentFoodEntryClick?: (id: string) => void;
  onRecentFoodEntryDelete?: (id: string) => void;
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
  onRecentFoodEntryClick,
  onRecentFoodEntryDelete,
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
    { key: "calories", label: "Calories", icon: MACRO_ICONS.calories, current: totalCalories, target: nutritionGoals.caloriesTarget, unit: "", mode: "default" as const },
    { key: "carbs", label: "Carbs", icon: MACRO_ICONS.carbs, current: nutrition.carbsGrams, target: nutritionGoals.carbsGrams, unit: "g", mode: "default" as const },
    { key: "protein", label: "Protein", icon: MACRO_ICONS.protein, current: nutrition.proteinGrams, target: nutritionGoals.proteinGrams, unit: "g", mode: "default" as const },
    { key: "fat", label: "Fat", icon: MACRO_ICONS.fat, current: nutrition.fatGrams, target: nutritionGoals.fatGrams, unit: "g", mode: "default" as const },
  ];

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <LandingMobileGoalsCard rows={goalRows} onViewDetails={onOpenNutrition} />

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
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl bg-white/80 !shadow-none dark:bg-neutral-900/30">
            {recentFoodEntries.map((entry) => {
              const chipCls = journalTypeBadgeClass("nutrition");
              const open = () => onRecentFoodEntryClick?.(entry.id);
              const ghostOpenBtn =
                "appearance-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:focus-visible:ring-blue-400/30";
              const calOnly =
                entry.calories > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[15px] font-medium tabular-nums text-blue-500 dark:text-blue-400">
                    <SparklesIcon className="h-4 w-4 shrink-0" />
                    {entry.calories} cal
                  </span>
                ) : (
                  <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>
                );
              const timeOnly = entry.time ? (
                <span className="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">{entry.time}</span>
              ) : null;
              const cls =
                "w-full px-3 transition-colors hover:bg-neutral-50/90 dark:hover:bg-neutral-800/40";
              return (
                <div key={entry.id} className={cls}>
                  <div className={`${AMY_JOURNAL_LIST_GRID} py-1.5`}>
                    <button
                      type="button"
                      onClick={open}
                      disabled={!onRecentFoodEntryClick}
                      className={`col-start-1 row-start-1 min-w-0 self-center text-left disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                    >
                      <span className={`${JOURNAL_CATEGORY_TAG_PILL_CLASS} ${chipCls}`}>
                        Nutrition
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={open}
                      disabled={!onRecentFoodEntryClick}
                      className={`col-start-2 row-start-1 justify-self-end self-center text-right disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                    >
                      {calOnly}
                    </button>
                    <button
                      type="button"
                      onClick={open}
                      disabled={!onRecentFoodEntryClick}
                      className={`col-start-1 row-start-2 min-w-0 text-left disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                    >
                      <p className="text-[17px] leading-tight text-foreground whitespace-pre-wrap break-words">
                        {entry.label}
                      </p>
                    </button>
                    {timeOnly ? (
                      <button
                        type="button"
                        onClick={open}
                        disabled={!onRecentFoodEntryClick}
                        className={`col-start-2 row-start-2 justify-self-end self-end text-right disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                      >
                        {timeOnly}
                      </button>
                    ) : (
                      <span className="col-start-2 row-start-2 justify-self-end self-end" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => void onRecentFoodEntryDelete?.(entry.id)}
                      disabled={!onRecentFoodEntryDelete}
                      className="col-start-3 row-start-1 row-span-2 justify-self-end self-center appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
                      aria-label={`Delete food entry: ${entry.label.slice(0, 48)}${entry.label.length > 48 ? "…" : ""}`}
                    >
                      <DeleteEntryIcon />
                    </button>
                  </div>
                </div>
              );
            })}
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
