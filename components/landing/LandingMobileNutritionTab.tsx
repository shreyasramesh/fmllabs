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
  /** Inline food input state — user types here and submits without a modal. */
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

function CalorieRing({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const radius = 62;
  const stroke = 10;
  const center = radius + stroke;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const over = consumed > target;
  const remaining = target - consumed;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          width={center * 2}
          height={center * 2}
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-neutral-200 dark:text-neutral-700/50"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={over ? "#C4705E" : "#9A8872"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {consumed.toLocaleString()}
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            of {target.toLocaleString()} kcal
          </span>
        </div>
      </div>
      {remaining > 0 ? (
        <p className="text-sm font-medium tabular-nums text-[#9A8872]">
          {remaining.toLocaleString()} kcal remaining
        </p>
      ) : remaining < 0 ? (
        <p className="text-sm font-medium tabular-nums text-[#C4705E]">
          {Math.abs(remaining).toLocaleString()} kcal over
        </p>
      ) : null}
    </div>
  );
}

const MACRO_DEFS = [
  { key: "protein", label: "Protein", unit: "g", color: "#5A9E8A" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#D49A42" },
  { key: "fat", label: "Fat", unit: "g", color: "#C4705E" },
] as const;

const KCAL_PER_GRAM: Record<string, number> = { protein: 4, carbs: 4, fat: 9 };

function MacroPill({
  label,
  macroKey,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  macroKey: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const filled = pct(current, target);
  const kcal = Math.round(current * (KCAL_PER_GRAM[macroKey] ?? 4));
  return (
    <div className="landing-module-glass flex flex-1 flex-col items-center gap-1.5 rounded-2xl border px-3 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-bold tabular-nums text-foreground">{Math.round(current)}</span>
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">/ {target}{unit}</span>
      </div>
      <p className="text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">{kcal} kcal</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700/50">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${filled}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

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

  const macroValues: Record<string, { current: number; target: number }> = {
    protein: { current: nutrition.proteinGrams, target: nutritionGoals.proteinGrams },
    carbs: { current: nutrition.carbsGrams, target: nutritionGoals.carbsGrams },
    fat: { current: nutrition.fatGrams, target: nutritionGoals.fatGrams },
  };

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

  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      {/* Calorie ring */}
      <div className="flex justify-center pt-2">
        <CalorieRing
          consumed={nutrition.caloriesFood}
          target={nutritionGoals.caloriesTarget}
        />
      </div>

      {/* Macro pills */}
      <div className="flex gap-2">
        {MACRO_DEFS.map((macro) => (
          <MacroPill
            key={macro.key}
            label={macro.label}
            macroKey={macro.key}
            current={macroValues[macro.key].current}
            target={macroValues[macro.key].target}
            unit={macro.unit}
            color={macro.color}
          />
        ))}
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
                s.proteinGrams != null ? `P ${s.proteinGrams}g` : null,
                s.carbsGrams != null ? `C ${s.carbsGrams}g` : null,
                s.fatGrams != null ? `F ${s.fatGrams}g` : null,
                s.calories != null ? `${s.calories} kcal` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInlineFoodSuggestionSelect(s.id)}
                  className="flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {s.displayName || s.sampleEntry.split("\n").find(Boolean)?.slice(0, 60) || "Saved entry"}
                  </span>
                  {macroBits && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      {macroBits}
                    </span>
                  )}
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

      {/* Recents — compact list of today's logged food */}
      {recentFoodEntries.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl border">
            {recentFoodEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-3.5 py-2 ${idx > 0 ? "border-t border-neutral-100 dark:border-neutral-800" : ""}`}
              >
                <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">{entry.label}</p>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {entry.time && (
                    <span className="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">{entry.time}</span>
                  )}
                  <span className="text-[11px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                    {entry.calories} kcal
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals detail card */}
      <button
        type="button"
        onClick={onOpenNutrition}
        className="landing-module-glass flex items-center justify-between rounded-2xl border px-4 py-3.5 shadow-sm transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#B87B51] dark:text-[#D6A67E]">
            <path d="M2 20h.01" />
            <path d="M7 20v-4" />
            <path d="M12 20v-8" />
            <path d="M17 20V8" />
            <path d="M22 4v16" />
          </svg>
          <span className="text-[14px] font-semibold text-foreground">Goals &amp; Details</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-neutral-400">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>

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
