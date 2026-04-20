"use client";

import React, { memo, useMemo } from "react";
import type { DoodleStroke } from "@/lib/db";

interface DoodleMonthGridProps {
  year: number;
  month: number;
  doodlesByDay: Record<string, DoodleStroke[]>;
  selectedDay?: string;
  onDayTap: (dayKey: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDayKey(new Date());
}

function strokesPath(strokes: DoodleStroke[]): string {
  const parts: string[] = [];
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    const pts = s.points;
    parts.push(`M${pts[0].x},${pts[0].y}`);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      parts.push(`Q${pts[i].x},${pts[i].y} ${mx},${my}`);
    }
    if (pts.length > 1) {
      const last = pts[pts.length - 1];
      parts.push(`L${last.x},${last.y}`);
    }
  }
  return parts.join(" ");
}

const DoodleThumbnail = memo(function DoodleThumbnail({ strokes }: { strokes: DoodleStroke[] }) {
  const d = useMemo(() => strokesPath(strokes), [strokes]);
  if (!d) return null;
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      <path d={d} fill="none" stroke="#c96442" strokeWidth={0.035} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

export const DoodleYearGrid = memo(function DoodleYearGrid({
  year,
  month,
  doodlesByDay,
  selectedDay,
  onDayTap,
}: DoodleMonthGridProps) {
  const today = todayKey();

  const monthName = useMemo(
    () => new Date(year, month, 1).toLocaleDateString(undefined, { month: "long" }),
    [year, month],
  );

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    const result: { key: string; day: number; isFuture: boolean; isToday: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = toDayKey(dt);
      result.push({ key, day: d, isFuture: key > today, isToday: key === today });
    }
    return { days: result, offset: startOffset };
  }, [year, month, today]);

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-baseline gap-2 mb-4">
        <p className="text-2xl font-bold text-foreground">{monthName}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{year}</p>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((l) => (
          <p key={l} className="text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
            {l}
          </p>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.offset > 0
          ? Array.from({ length: cells.offset }).map((_, i) => <div key={`pad-${i}`} />)
          : null}
        {cells.days.map((day) => {
          const strokes = doodlesByDay[day.key];
          const hasDoodle = strokes && strokes.length > 0;
          const isSelected = day.key === selectedDay;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onDayTap(day.key)}
              className={`relative flex flex-col items-center rounded-xl py-1 transition-all ${
                isSelected
                  ? "ring-2 ring-[#c96442] ring-offset-1 ring-offset-background"
                  : ""
              } ${
                hasDoodle
                  ? "bg-[#faf9f5] dark:bg-[#2a2927] border border-[#e8e6dc] dark:border-[#3d3d3a]"
                  : day.isToday
                    ? "bg-[#c96442]/10 dark:bg-[#c96442]/15"
                    : day.isFuture
                      ? "opacity-30"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800/40"
              }`}
              aria-label={`${day.key}${hasDoodle ? " (has doodle)" : day.isToday ? " (today)" : ""}`}
            >
              <span
                className={`text-[11px] leading-none font-medium ${
                  day.isToday
                    ? "text-[#c96442]"
                    : day.isFuture
                      ? "text-neutral-400 dark:text-neutral-600"
                      : "text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {day.day}
              </span>
              <div className="w-8 h-8 mt-0.5 flex items-center justify-center">
                {hasDoodle ? (
                  <DoodleThumbnail strokes={strokes} />
                ) : !day.isFuture ? (
                  <span
                    className={`rounded-full ${
                      day.isToday ? "w-1.5 h-1.5 bg-[#c96442]" : "w-1 h-1 bg-neutral-300 dark:bg-neutral-600"
                    }`}
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
