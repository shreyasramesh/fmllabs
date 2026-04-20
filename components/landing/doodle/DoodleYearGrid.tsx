"use client";

import React, { memo, useMemo } from "react";
import type { DoodleStroke } from "@/lib/db";

interface DoodleYearGridProps {
  year: number;
  doodlesByDay: Record<string, DoodleStroke[]>;
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
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full"
    >
      <path
        d={d}
        fill="none"
        stroke="#c96442"
        strokeWidth={0.04}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export const DoodleYearGrid = memo(function DoodleYearGrid({
  year,
  doodlesByDay,
  onDayTap,
}: DoodleYearGridProps) {
  const today = todayKey();

  const days = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const startOffset = (jan1.getDay() + 6) % 7;
    const result: { key: string; dayOfYear: number; isFuture: boolean; isToday: boolean; offset: number }[] = [];
    const current = new Date(jan1);
    let i = 0;
    while (current <= dec31) {
      const key = toDayKey(current);
      result.push({
        key,
        dayOfYear: i,
        isFuture: key > today,
        isToday: key === today,
        offset: i === 0 ? startOffset : 0,
      });
      current.setDate(current.getDate() + 1);
      i++;
    }
    return result;
  }, [year, today]);

  return (
    <div className="px-4 pb-6">
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

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onDayTap(day.key)}
              className={`relative aspect-square rounded-lg transition-all ${
                hasDoodle
                  ? "bg-[#faf9f5] dark:bg-[#2a2927] border border-[#e8e6dc] dark:border-[#3d3d3a] hover:border-[#c96442]/50"
                  : day.isToday
                    ? "border-2 border-[#c96442] bg-transparent animate-life-glow-pulse"
                    : day.isFuture
                      ? "bg-neutral-100/50 dark:bg-neutral-800/20"
                      : "bg-neutral-200/60 dark:bg-neutral-700/30 hover:bg-neutral-300/60 dark:hover:bg-neutral-600/30"
              }`}
              aria-label={`${day.key}${hasDoodle ? " (has doodle)" : day.isToday ? " (today)" : ""}`}
            >
              {hasDoodle ? (
                <DoodleThumbnail strokes={strokes} />
              ) : day.isToday ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#c96442]/60" />
                </span>
              ) : !day.isFuture ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-neutral-400/50 dark:bg-neutral-600/50" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
