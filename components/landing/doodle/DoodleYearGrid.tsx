"use client";

import React, { memo, useMemo } from "react";
import type { DoodleStroke } from "@/lib/db";

interface DoodleYearGridProps {
  year: number;
  doodlesByDay: Record<string, DoodleStroke[]>;
  selectedDay?: string;
  onDayTap: (dayKey: string) => void;
}

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
    <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" className="absolute inset-[2px]">
      <path d={d} fill="none" stroke="#c96442" strokeWidth={0.04} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

function isCurrentWeek(dayKey: string, today: string): boolean {
  const [y, m, d] = today.split("-").map(Number);
  const todayDate = new Date(y, m - 1, d);
  const dow = (todayDate.getDay() + 6) % 7;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monKey = toDayKey(monday);
  const sunKey = toDayKey(sunday);
  return dayKey >= monKey && dayKey <= sunKey;
}

export const DoodleYearGrid = memo(function DoodleYearGrid({
  year,
  doodlesByDay,
  selectedDay,
  onDayTap,
}: DoodleYearGridProps) {
  const today = todayKey();

  const days = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const startOffset = (jan1.getDay() + 6) % 7;
    const result: { key: string; dayOfYear: number; isFuture: boolean; isToday: boolean; isThisWeek: boolean; offset: number }[] = [];
    const current = new Date(jan1);
    let i = 0;
    while (current <= dec31) {
      const key = toDayKey(current);
      result.push({
        key,
        dayOfYear: i,
        isFuture: key > today,
        isToday: key === today,
        isThisWeek: isCurrentWeek(key, today),
        offset: i === 0 ? startOffset : 0,
      });
      current.setDate(current.getDate() + 1);
      i++;
    }
    return result;
  }, [year, today]);

  return (
    <div className="px-4 pt-3 pb-4">
      <p className="text-3xl font-bold text-foreground mb-4">{year}</p>
      <div className="grid grid-cols-7 gap-[3px]">
        {days[0] && days[0].offset > 0
          ? Array.from({ length: days[0].offset }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))
          : null}
        {days.map((day) => {
          const strokes = doodlesByDay[day.key];
          const hasDoodle = strokes && strokes.length > 0;
          const isSelected = day.key === selectedDay;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onDayTap(day.key)}
              className={`relative aspect-square rounded-lg transition-all ${
                isSelected
                  ? "ring-2 ring-[#c96442] ring-offset-1 ring-offset-background"
                  : ""
              } ${
                hasDoodle
                  ? "bg-[#faf9f5] dark:bg-[#2a2927] border border-[#e8e6dc] dark:border-[#3d3d3a]"
                  : day.isToday
                    ? "border-2 border-[#c96442] bg-transparent"
                    : day.isFuture
                      ? ""
                      : ""
              }`}
              aria-label={`${day.key}${hasDoodle ? " (has doodle)" : day.isToday ? " (today)" : ""}`}
            >
              {hasDoodle ? (
                <DoodleThumbnail strokes={strokes} />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`rounded-full ${
                      day.isToday
                        ? "w-2.5 h-2.5 bg-[#c96442]"
                        : day.isThisWeek && !day.isFuture
                          ? "w-2 h-2 bg-foreground dark:bg-neutral-200"
                          : day.isFuture
                            ? "w-1 h-1 bg-neutral-300/40 dark:bg-neutral-700/30"
                            : "w-1.5 h-1.5 bg-neutral-400/50 dark:bg-neutral-600/40"
                    }`}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
