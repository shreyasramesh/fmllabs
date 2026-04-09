"use client";

import React, { useRef, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type { LandingWeeklySummaryPreview } from "@/components/landing/types";

interface RecentExerciseEntry {
  id: string;
  label: string;
  caloriesBurned: number;
  time: string;
}

interface LandingMobileExerciseTabProps {
  caloriesBurned: number;
  recentExerciseEntries: RecentExerciseEntry[];
  onOpenExercise: () => void;
  inlineExerciseInput: string;
  onInlineExerciseInputChange: (value: string) => void;
  onInlineExerciseSubmit: () => void;
  inlineExerciseLoading: boolean;
  weeklySummary: LandingWeeklySummaryPreview | null;
}

export function LandingMobileExerciseTab({
  caloriesBurned,
  recentExerciseEntries,
  onOpenExercise,
  inlineExerciseInput,
  onInlineExerciseInputChange,
  onInlineExerciseSubmit,
  inlineExerciseLoading,
  weeklySummary,
}: LandingMobileExerciseTabProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const trendOptions = useMemo<Highcharts.Options | null>(() => {
    if (!weeklySummary || weeklySummary.rows.length === 0) return null;
    const rows = weeklySummary.rows;
    const categories = rows.map((r) => r.weekdayLabel);
    const data = rows.map((r) => r.caloriesExercise);

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
            color: {
              linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
              stops: [
                [0, "rgba(96,165,250,0.85)"],
                [1, "rgba(96,165,250,0.3)"],
              ],
            },
          })),
        },
      ],
    };
  }, [weeklySummary]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      {/* Calories burned summary */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tabular-nums text-foreground">{caloriesBurned.toLocaleString()}</span>
          <span className="text-sm text-neutral-400 dark:text-neutral-500">kcal burned</span>
        </div>
        {caloriesBurned === 0 && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No exercise logged today</p>
        )}
      </div>

      {/* Inline exercise input */}
      <div className="relative">
        <div className="landing-module-glass overflow-hidden rounded-2xl border">
          <textarea
            ref={textareaRef}
            value={inlineExerciseInput}
            onChange={(e) => onInlineExerciseInputChange(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 200)}
            disabled={inlineExerciseLoading}
            rows={2}
            placeholder="What did you do? e.g. 30 min run, upper body session..."
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-foreground placeholder:text-neutral-400 outline-none disabled:opacity-50 dark:placeholder:text-neutral-500"
          />
          <div className="flex items-center justify-between border-t border-neutral-200/60 px-3 py-2 dark:border-neutral-700/40">
            <button
              type="button"
              onClick={onOpenExercise}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Open modal
            </button>
            <button
              type="button"
              onClick={onInlineExerciseSubmit}
              disabled={inlineExerciseLoading || !inlineExerciseInput.trim()}
              className="rounded-xl bg-[#B87B51] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#A66B41] disabled:opacity-40 dark:bg-[#D6A67E] dark:text-neutral-900 dark:hover:bg-[#C49670]"
            >
              {inlineExerciseLoading ? "Logging…" : "Log it"}
            </button>
          </div>
        </div>
      </div>

      {/* Recents */}
      {recentExerciseEntries.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl border">
            {recentExerciseEntries.map((entry, idx) => (
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
                    {entry.caloriesBurned} kcal
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise — 7 Day Trend */}
      {trendOptions && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Exercise — 7 Day Trend
          </p>
          <HighchartsReact highcharts={Highcharts} options={trendOptions} />
        </div>
      )}
    </div>
  );
}
