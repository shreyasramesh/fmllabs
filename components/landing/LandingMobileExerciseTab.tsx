"use client";

import React, { useRef, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type { LandingWeeklySummaryPreview } from "@/components/landing/types";
import { journalTypeBadgeClass } from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import {
  AMY_JOURNAL_LIST_GRID,
  DeleteEntryIcon,
} from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { SparklesIcon } from "@/components/SharedIcons";
import { LandingMobileGoalsCard } from "@/components/landing/LandingMobileGoalsCard";

interface RecentExerciseEntry {
  id: string;
  label: string;
  caloriesBurned: number;
  time: string;
}

interface LandingMobileExerciseTabProps {
  caloriesBurned: number;
  exerciseBurnGoalKcal: number;
  recentExerciseEntries: RecentExerciseEntry[];
  onRecentExerciseEntryClick?: (id: string) => void;
  onRecentExerciseEntryDelete?: (id: string) => void;
  onOpenExercise: () => void;
  inlineExerciseInput: string;
  onInlineExerciseInputChange: (value: string) => void;
  onInlineExerciseSubmit: () => void;
  inlineExerciseLoading: boolean;
  weeklySummary: LandingWeeklySummaryPreview | null;
}

export function LandingMobileExerciseTab({
  caloriesBurned,
  exerciseBurnGoalKcal,
  recentExerciseEntries,
  onRecentExerciseEntryClick,
  onRecentExerciseEntryDelete,
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
      <LandingMobileGoalsCard
        rows={[
          {
            key: "burn",
            label: "Calories burned",
            icon: "\u26A1",
            current: caloriesBurned,
            target: exerciseBurnGoalKcal,
            unit: " kcal",
            mode: "higherBetter",
          },
        ]}
        onViewDetails={onOpenExercise}
      />

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
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Recents
          </p>
          <div className="landing-module-glass overflow-hidden rounded-2xl bg-white/80 !shadow-none dark:bg-neutral-900/30">
            {recentExerciseEntries.map((entry) => {
              const chipCls = journalTypeBadgeClass("exercise");
              const open = () => onRecentExerciseEntryClick?.(entry.id);
              const ghostOpenBtn =
                "appearance-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:focus-visible:ring-blue-400/30";
              const calOnly =
                entry.caloriesBurned > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[15px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    <SparklesIcon className="h-4 w-4 shrink-0" />
                    −{entry.caloriesBurned} cal
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
                      disabled={!onRecentExerciseEntryClick}
                      className={`col-start-1 row-start-1 min-w-0 self-center text-left disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                    >
                      <span className={`inline-block rounded-full px-2 py-px text-[10px] font-medium ${chipCls}`}>
                        Exercise
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={open}
                      disabled={!onRecentExerciseEntryClick}
                      className={`col-start-2 row-start-1 justify-self-end self-center text-right disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                    >
                      {calOnly}
                    </button>
                    <button
                      type="button"
                      onClick={open}
                      disabled={!onRecentExerciseEntryClick}
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
                        disabled={!onRecentExerciseEntryClick}
                        className={`col-start-2 row-start-2 justify-self-end self-end text-right disabled:cursor-default disabled:opacity-100 ${ghostOpenBtn}`}
                      >
                        {timeOnly}
                      </button>
                    ) : (
                      <span className="col-start-2 row-start-2 justify-self-end self-end" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => void onRecentExerciseEntryDelete?.(entry.id)}
                      disabled={!onRecentExerciseEntryDelete}
                      className="col-start-3 row-start-1 row-span-2 justify-self-end self-center appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
                      aria-label={`Delete exercise entry: ${entry.label.slice(0, 48)}${entry.label.length > 48 ? "…" : ""}`}
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
