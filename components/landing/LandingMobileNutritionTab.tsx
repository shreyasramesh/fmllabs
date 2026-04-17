"use client";

import React, { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingRecentFoodEntry,
  LandingWeeklySummaryPreview,
} from "@/components/landing/types";
import { journalTypeDotClass, JOURNAL_CATEGORY_DOT_BASE } from "@/components/landing/brain-dump/journal-category-tag-styles";
import {
  AMY_JOURNAL_LIST_GRID,
  DeleteEntryIcon,
} from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { SparklesIcon } from "@/components/SharedIcons";
import { LandingMobileGoalsCard } from "@/components/landing/LandingMobileGoalsCard";
import { GoalConfigPill } from "@/components/landing/GoalConfigPill";

interface LandingMobileNutritionTabProps {
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  weeklySummary: LandingWeeklySummaryPreview | null;
  onOpenNutrition: () => void;
  recentFoodEntries: LandingRecentFoodEntry[];
  onRecentFoodEntryClick?: (id: string) => void;
  onRecentFoodEntryDelete?: (id: string) => void;
  onOpenGoals: () => void;
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
  recentFoodEntries,
  onRecentFoodEntryClick,
  onRecentFoodEntryDelete,
  onOpenGoals,
}: LandingMobileNutritionTabProps) {
  const totalCalories = nutrition.caloriesFood;

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
            color: "#c9644260",
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
    <div className="flex flex-col gap-5 px-4 pb-8">
      <div className="flex justify-center">
        <GoalConfigPill
          label={`Goal: ${nutritionGoals.caloriesTarget.toLocaleString()} kcal`}
          onClick={onOpenGoals}
        />
      </div>

      <LandingMobileGoalsCard rows={goalRows} onViewDetails={onOpenNutrition} />

      {/* Recents — compact list with macro breakdown */}
      {recentFoodEntries.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl bg-white/80 !shadow-none dark:bg-neutral-900/30">
            {recentFoodEntries.map((entry) => {
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
                      <span className="flex items-start gap-2">
                        <span
                          className={`mt-[0.4rem] ${JOURNAL_CATEGORY_DOT_BASE} ${journalTypeDotClass("nutrition")}`}
                          aria-hidden
                        />
                        <p className="min-w-0 flex-1 text-[17px] leading-tight text-foreground whitespace-pre-wrap break-words">
                          {entry.label}
                        </p>
                      </span>
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
