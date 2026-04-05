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
  for (let i = 0; i < 7; i++) {
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
    const totalCells = total * 7;
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
      <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200/60 bg-neutral-50/50 px-4 py-3 dark:border-neutral-700/50 dark:bg-neutral-800/30">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-[#5A9E8A]">
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
      <div className="flex flex-col gap-2 sm:hidden">
        {habitStats.map(({ habit, set, streak, doneToday }) => (
          <div
            key={habit._id}
            className="flex items-center gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50/40 px-3 py-2.5 dark:border-neutral-700/50 dark:bg-neutral-800/30"
          >
            <button
              type="button"
              onClick={() => onToggle(habit._id, today)}
              className={[
                "shrink-0 w-8 h-8 rounded-lg transition-all duration-150 flex items-center justify-center",
                doneToday
                  ? "bg-[#5A9E8A] shadow-sm"
                  : "bg-neutral-200/50 border border-neutral-300/60 dark:bg-neutral-700/40 dark:border-neutral-600/50",
                "hover:scale-110 active:scale-95",
              ].join(" ")}
              aria-label={`Toggle ${habit.name} today`}
            >
              {doneToday && (
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-[#5A9E8A]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#5A9E8A]">
                {streak}
                <svg viewBox="0 0 12 14" className="w-2.5 h-2.5" fill="#5A9E8A" aria-hidden>
                  <path d="M6 0C6 0 2 4.5 2 8a4 4 0 0 0 8 0C10 4.5 6 0 6 0Z" />
                </svg>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: full 7-day grid */}
      <div className="hidden sm:block w-full">
        <div className="mx-auto grid w-fit items-center gap-y-2.5" style={{ gridTemplateColumns: "max-content repeat(7, 36px)" }}>
          <div />
          {DAY_LABELS.map((label, i) => (
            <div
              key={`dow-${i}`}
              className="text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500 select-none"
            >
              {label}
            </div>
          ))}

          {habitStats.map(({ habit, set, streak }) => (
            <React.Fragment key={habit._id}>
              <button
                type="button"
                onClick={() => onOpenHabit(habit._id)}
                className="flex items-center gap-1.5 min-w-0 max-w-[14rem] pr-3 text-left group"
              >
                <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100 truncate group-hover:text-[#5A9E8A] transition-colors">
                  {habit.name}
                </span>
                {streak > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-[#5A9E8A]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#5A9E8A]">
                    {streak}
                    <svg viewBox="0 0 12 14" className="w-2.5 h-2.5" fill="#5A9E8A" aria-hidden>
                      <path d="M6 0C6 0 2 4.5 2 8a4 4 0 0 0 8 0C10 4.5 6 0 6 0Z" />
                    </svg>
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
                          ? "bg-[#5A9E8A] shadow-sm"
                          : "bg-neutral-200/50 border border-neutral-300/60 dark:bg-neutral-700/40 dark:border-neutral-600/50",
                        isToday && !completed
                          ? "ring-2 ring-[#B87B51] ring-offset-1 ring-offset-white dark:ring-offset-neutral-900"
                          : "",
                        isToday && completed
                          ? "ring-2 ring-[#B87B51] ring-offset-1 ring-offset-white dark:ring-offset-neutral-900"
                          : "",
                        "hover:scale-110 active:scale-95",
                      ].join(" ")}
                      aria-label={`${habit.name} ${dateKey}${completed ? " completed" : ""}`}
                    >
                      {completed && (
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
