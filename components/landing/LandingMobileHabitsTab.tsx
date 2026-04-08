"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { LandingHabitCompletionMap } from "@/components/landing/types";

interface LandingMobileHabitsTabProps {
  heroHabits: Array<{ _id: string; name: string }>;
  heroHabitCompletions: LandingHabitCompletionMap;
  onToggleHabitCompletion: (habitId: string, dateKey: string) => void;
  onOpenHabitDetail: (habitId: string) => void;
  onReorderHeroHabits: (orderedIds: string[]) => void;
  onOpenHabits: () => void;
  heroHabitsLabel: string;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LandingMobileHabitsTab({
  heroHabits,
  heroHabitCompletions,
  onToggleHabitCompletion,
  onOpenHabitDetail,
  onReorderHeroHabits,
  onOpenHabits,
  heroHabitsLabel,
}: LandingMobileHabitsTabProps) {
  const today = useMemo(todayKey, []);

  const habitStates = useMemo(() => {
    return heroHabits.map((h) => {
      const dates = heroHabitCompletions[h._id];
      const doneToday = dates != null && dates.includes(today);
      return { ...h, doneToday };
    });
  }, [heroHabits, heroHabitCompletions, today]);

  const doneCount = habitStates.filter((h) => h.doneToday).length;

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const orderedHabits = useMemo(() => {
    if (!localOrder) return habitStates;
    const map = new Map(habitStates.map((h) => [h._id, h]));
    return localOrder.map((id) => map.get(id)).filter(Boolean) as typeof habitStates;
  }, [localOrder, habitStates]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
    setLocalOrder((prev) => prev ?? habitStates.map((h) => h._id));
  }, [habitStates]);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx == null || idx === dragIdx) return;
    dragOverIdx.current = idx;
    setLocalOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setDragIdx(idx);
      return next;
    });
  }, [dragIdx]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    if (localOrder) {
      onReorderHeroHabits(localOrder);
    }
    setTimeout(() => setLocalOrder(null), 100);
  }, [localOrder, onReorderHeroHabits]);

  /* Touch-based reorder via long-press move up/down buttons */
  const moveHabit = useCallback((fromIdx: number, toIdx: number) => {
    const ids = localOrder ?? heroHabits.map((h) => h._id);
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalOrder(next);
    onReorderHeroHabits(next);
    setTimeout(() => setLocalOrder(null), 100);
  }, [localOrder, heroHabits, onReorderHeroHabits]);

  if (heroHabits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-neutral-300 dark:text-neutral-600">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No hero habits yet. Tag a 30-day experiment as a hero habit to track it here.
        </p>
        <button
          type="button"
          onClick={onOpenHabits}
          className="mt-1 rounded-full border border-[#B87B51] bg-[#FBF4EC] px-5 py-2 text-sm font-semibold text-[#7C522D] transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
        >
          Browse habits
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{heroHabitsLabel}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
            {doneCount}/{habitStates.length}
          </span>
          <button
            type="button"
            onClick={onOpenHabits}
            className="rounded-full border border-neutral-300 px-3 py-1 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Compact Google Keep-style checklist */}
      <div className="landing-module-glass overflow-hidden rounded-2xl border">
        {orderedHabits.map((habit, idx) => (
          <div
            key={habit._id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`group flex items-center gap-2.5 border-b border-neutral-200/60 px-3 py-2.5 last:border-b-0 dark:border-neutral-700/40 ${
              dragIdx === idx ? "bg-[#FBF4EC]/60 dark:bg-[#241a14]/50" : ""
            }`}
          >
            {/* Drag handle */}
            <button
              type="button"
              className="touch-none cursor-grab p-0.5 text-neutral-300 active:cursor-grabbing dark:text-neutral-600"
              aria-label="Drag to reorder"
              tabIndex={-1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <circle cx="5" cy="3" r="1.2" />
                <circle cx="11" cy="3" r="1.2" />
                <circle cx="5" cy="8" r="1.2" />
                <circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="13" r="1.2" />
                <circle cx="11" cy="13" r="1.2" />
              </svg>
            </button>

            {/* Checkbox */}
            <button
              type="button"
              onClick={() => onToggleHabitCompletion(habit._id, today)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                habit.doneToday
                  ? "border-[#5A9E8A] bg-[#5A9E8A]"
                  : "border-neutral-300 dark:border-neutral-600"
              }`}
              aria-label={`Toggle ${habit.name}`}
            >
              {habit.doneToday && (
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                </svg>
              )}
            </button>

            {/* Name */}
            <button
              type="button"
              onClick={() => onOpenHabitDetail(habit._id)}
              className={`min-w-0 flex-1 text-left text-[14px] leading-snug transition-colors ${
                habit.doneToday
                  ? "text-neutral-400 line-through dark:text-neutral-500"
                  : "text-foreground"
              }`}
            >
              {habit.name}
            </button>

            {/* Touch reorder arrows (visible on mobile where drag may be harder) */}
            <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100 sm:hidden">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveHabit(idx, idx - 1)}
                  className="p-0.5 text-neutral-400"
                  aria-label="Move up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M8 3.293l-4.354 4.354a1 1 0 01-1.414-1.414l5.06-5.06a1 1 0 011.415 0l5.06 5.06a1 1 0 01-1.414 1.414L8 3.293z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              {idx < orderedHabits.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveHabit(idx, idx + 1)}
                  className="p-0.5 text-neutral-400"
                  aria-label="Move down"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M8 12.707l4.354-4.354a1 1 0 011.414 1.414l-5.06 5.06a1 1 0 01-1.415 0l-5.06-5.06a1 1 0 011.414-1.414L8 12.707z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
