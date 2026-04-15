"use client";

import React, { useMemo } from "react";
import type { LandingHabitCompletionMap } from "./types";

interface HabitSummary {
  _id: string;
  name: string;
}

interface LandingHeroHabitsProps {
  habits: HabitSummary[];
  completions: LandingHabitCompletionMap;
  onToggle: (habitId: string, dateKey: string) => void;
  onOpenHabit: (habitId: string) => void;
  emptyStateText?: string;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeekGrid(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  const keys: string[] = [];
  for (let i = 0; i <= dayOfWeek; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(formatDateKey(d));
  }
  return keys;
}

function computeStreak(
  completionSet: Set<string>,
  todayKey: string
): number {
  let streak = 0;
  const d = new Date(todayKey + "T00:00:00");
  while (completionSet.has(formatDateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function ConsistencyIcon() {
  return (
    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M2 9V6" />
      <path d="M6 9V3" />
      <path d="M10 9V5" />
    </svg>
  );
}

export const LandingHeroHabits = React.memo(function LandingHeroHabits({
  habits,
  completions,
  onToggle,
  onOpenHabit,
  emptyStateText = "No hero habits yet. Tag a 30-day experiment as a hero habit to track it here.",
}: LandingHeroHabitsProps) {
  const dateGrid = useMemo(buildWeekGrid, []);
  const today = useMemo(() => formatDateKey(new Date()), []);

  const habitStats = useMemo(() => {
    return habits.map((h) => {
      const arr = completions[h._id];
      const set = arr ? new Set(arr) : new Set<string>();
      const doneThisWeek = dateGrid.filter((dk) => set.has(dk)).length;
      const streak = computeStreak(set, today);
      const doneToday = set.has(today);
      return { habit: h, set, doneThisWeek, streak, doneToday };
    });
  }, [habits, completions, dateGrid, today]);

  const summaryStats = useMemo(() => {
    const total = habitStats.length;
    const doneToday = habitStats.filter((s) => s.doneToday).length;
    const totalCells = total * dateGrid.length;
    const completedCells = habitStats.reduce((sum, s) => sum + s.doneThisWeek, 0);
    const weeklyRate = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;
    return { doneToday, total, weeklyRate };
  }, [habitStats]);

  if (habits.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
        {emptyStateText}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="module-nested-muted flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-[#c96442] dark:text-[#d97757]">
            {summaryStats.doneToday}
          </span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            of {summaryStats.total} done today
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
            {summaryStats.weeklyRate}%
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            this week
          </span>
        </div>
      </div>

      {/* Mobile: name + today toggle list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {habitStats.map(({ habit, set, streak, doneToday }) => (
          <div key={habit._id} className="module-nested flex items-center gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={() => onToggle(habit._id, today)}
              className={[
                "shrink-0 w-8 h-8 rounded-lg transition-all duration-150 flex items-center justify-center",
                doneToday
                  ? "border-2 border-[#c96442]/45 bg-[#c96442]/10 shadow-sm dark:border-[#d97757]/45 dark:bg-[#d97757]/12"
                  : "module-toggle-empty",
                "hover:scale-110 active:scale-95",
              ].join(" ")}
              aria-label={`Toggle ${habit.name} today`}
            >
              {doneToday && (
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="#c96442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenHabit(habit._id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 line-clamp-1">
                {habit.name}
              </span>
            </button>
            {streak > 0 && (
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-[#c96442]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#c96442] dark:bg-[#d97757]/12 dark:text-[#d97757]">
                {streak}
                <ConsistencyIcon />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: week grid up to today */}
      <div className="hidden sm:block w-full overflow-visible px-1 py-1">
        <div className="grid w-full items-center gap-y-2.5" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${dateGrid.length}, 36px)` }}>
          <div />
          {dateGrid.map((_dk, i) => (
            <div
              key={`dow-${i}`}
              className="text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500 select-none"
            >
              {DAY_LABELS[i]}
            </div>
          ))}

          {habitStats.map(({ habit, set, streak }) => (
            <React.Fragment key={habit._id}>
              <button
                type="button"
                onClick={() => onOpenHabit(habit._id)}
                className="flex items-center gap-1.5 min-w-0 pr-3 text-left group"
              >
                <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100 truncate group-hover:text-[#c96442] dark:group-hover:text-[#d97757] transition-colors">
                  {habit.name}
                </span>
                {streak > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-[#c96442]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#c96442] dark:bg-[#d97757]/12 dark:text-[#d97757]">
                    {streak}
                    <ConsistencyIcon />
                  </span>
                )}
              </button>

              {dateGrid.map((dateKey) => {
                const completed = set.has(dateKey);
                const isToday = dateKey === today;
                return (
                  <div key={`${habit._id}-${dateKey}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => onToggle(habit._id, dateKey)}
                      className={[
                        "w-7 h-7 rounded-lg transition-all duration-150 flex items-center justify-center",
                        completed
                          ? "border-2 border-[#c96442]/45 bg-[#c96442]/10 shadow-sm dark:border-[#d97757]/45 dark:bg-[#d97757]/12"
                          : "module-toggle-empty",
                        isToday && !completed
                          ? "ring-2 ring-[#c96442] ring-offset-1 ring-offset-white dark:ring-offset-neutral-900"
                          : "",
                        isToday && completed
                          ? "ring-2 ring-[#c96442] ring-offset-1 ring-offset-white dark:ring-offset-neutral-900"
                          : "",
                        "hover:scale-110 active:scale-95",
                      ].join(" ")}
                      aria-label={`${habit.name} ${dateKey}${completed ? " completed" : ""}`}
                    >
                      {completed && (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="#c96442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});
