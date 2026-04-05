"use client";

import React, { useMemo } from "react";

interface HabitContributionGridProps {
  /** YYYY-MM-DD date keys when the habit was completed. */
  completionDates: string[];
  /** How many weeks to display (default 26 ≈ 6 months). */
  weeks?: number;
}

const DAY_LABELS = ["M", "", "W", "", "F", "", "S"];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GitHub-style contribution grid for a single habit.
 * Columns = weeks (newest on the right), rows = Mon–Sun.
 */
export const HabitContributionGrid = React.memo(function HabitContributionGrid({
  completionDates,
  weeks = 26,
}: HabitContributionGridProps) {
  const { grid, monthLabels, totalDays, completedDays, currentStreak, longestStreak } = useMemo(() => {
    const set = new Set(completionDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDow = (today.getDay() + 6) % 7; // 0=Mon
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - todayDow)); // Sunday of this week

    const totalCells = weeks * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - totalCells + 1);

    const cols: Array<Array<{ key: string; filled: boolean; future: boolean }>> = [];
    const months: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;
    let completed = 0;

    for (let w = 0; w < weeks; w++) {
      const week: Array<{ key: string; filled: boolean; future: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);
        const key = formatDateKey(cellDate);
        const isFuture = cellDate > today;
        const filled = !isFuture && set.has(key);
        if (filled) completed++;
        week.push({ key, filled, future: isFuture });

        if (d === 0) {
          const mo = cellDate.getMonth();
          if (mo !== lastMonth) {
            lastMonth = mo;
            months.push({
              label: cellDate.toLocaleString(undefined, { month: "short" }),
              col: w,
            });
          }
        }
      }
      cols.push(week);
    }

    // Streaks (counting backwards from today)
    let cur = 0;
    let longest = 0;
    let streak = 0;
    const d = new Date(today);
    while (true) {
      if (set.has(formatDateKey(d))) {
        streak++;
        if (streak > longest) longest = streak;
      } else {
        if (cur === 0) cur = streak;
        streak = 0;
      }
      d.setDate(d.getDate() - 1);
      if (d < startDate) break;
    }
    if (cur === 0) cur = streak;

    const total = Math.min(
      totalCells,
      Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
    );

    return { grid: cols, monthLabels: months, totalDays: total, completedDays: completed, currentStreak: cur, longestStreak: longest };
  }, [completionDates, weeks]);

  const rate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return (
    <div className="space-y-2.5">
      {/* Stats row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums text-[#5A9E8A]">{completedDays}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            of {totalDays} days ({rate}%)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">{currentStreak}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">current</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">{longestStreak}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">best</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto hide-scrollbar">
        <div className="inline-flex flex-col gap-0.5" style={{ minWidth: "fit-content" }}>
          {/* Month labels */}
          <div className="flex items-end" style={{ paddingLeft: 20 }}>
            {grid.map((_, colIdx) => {
              const label = monthLabels.find((m) => m.col === colIdx);
              return (
                <div
                  key={`ml-${colIdx}`}
                  className="text-[9px] text-neutral-400 dark:text-neutral-500"
                  style={{ width: 13, textAlign: "left" }}
                >
                  {label ? label.label : ""}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {Array.from({ length: 7 }).map((_, rowIdx) => (
            <div key={`row-${rowIdx}`} className="flex items-center gap-0">
              <span
                className="shrink-0 text-[9px] text-neutral-400 dark:text-neutral-500 select-none"
                style={{ width: 20, textAlign: "right", paddingRight: 4 }}
              >
                {DAY_LABELS[rowIdx]}
              </span>
              {grid.map((week, colIdx) => {
                const cell = week[rowIdx];
                if (!cell) return null;
                const bg = cell.future
                  ? "bg-transparent"
                  : cell.filled
                    ? "bg-[#5A9E8A]"
                    : "bg-neutral-200/60 dark:bg-neutral-700/40";
                return (
                  <div
                    key={cell.key}
                    title={`${new Date(cell.key + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" })}${cell.filled ? " ✓" : ""}`}
                    className={`rounded-[2px] ${bg}`}
                    style={{ width: 11, height: 11, margin: 1 }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 text-[9px] text-neutral-400 dark:text-neutral-500">
        <span>Less</span>
        <div className="rounded-[2px] bg-neutral-200/60 dark:bg-neutral-700/40" style={{ width: 10, height: 10 }} />
        <div className="rounded-[2px] bg-[#5A9E8A]" style={{ width: 10, height: 10 }} />
        <span>More</span>
      </div>
    </div>
  );
});
