"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { DoodleStroke } from "@/lib/db";
import { DoodleCanvas } from "@/components/landing/doodle/DoodleCanvas";
import { DoodleYearGrid } from "@/components/landing/doodle/DoodleYearGrid";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = todayKey();
  const base = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return dayKey === today ? `${base} — Today` : base;
}

export function LandingMobileDoodleTab() {
  const currentYear = new Date().getFullYear();
  const [doodlesByDay, setDoodlesByDay] = useState<Record<string, DoodleStroke[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/me/doodle?year=${currentYear}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, DoodleStroke[]> = {};
        if (Array.isArray(data?.doodles)) {
          for (const d of data.doodles) {
            if (d.dayKey && Array.isArray(d.strokes)) {
              map[d.dayKey] = d.strokes;
            }
          }
        }
        setDoodlesByDay(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  const handleDayTap = useCallback((dayKey: string) => {
    setActiveDay(dayKey);
  }, []);

  const handleSave = useCallback(
    async (strokes: DoodleStroke[]) => {
      if (!activeDay) return;
      setDoodlesByDay((prev) => ({ ...prev, [activeDay]: strokes }));
      setActiveDay(null);
      try {
        await fetch("/api/me/doodle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayKey: activeDay, strokes }),
        });
      } catch { /* best effort */ }
    },
    [activeDay],
  );

  const handleDelete = useCallback(async () => {
    if (!activeDay) return;
    setDoodlesByDay((prev) => {
      const next = { ...prev };
      delete next[activeDay];
      return next;
    });
    setActiveDay(null);
    try {
      await fetch("/api/me/doodle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayKey: activeDay }),
      });
    } catch { /* best effort */ }
  }, [activeDay]);

  const handleClose = useCallback(() => {
    setActiveDay(null);
  }, []);

  const activeStrokes = useMemo(
    () => (activeDay ? doodlesByDay[activeDay] ?? [] : []),
    [activeDay, doodlesByDay],
  );

  const doodleCount = Object.keys(doodlesByDay).length;

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20">
      <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-medium text-[#c96442]">One doodle, one memory</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveDay(todayKey())}
          className="rounded-xl bg-[#c96442] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#b05530] transition-colors shadow-sm"
        >
          Draw today
        </button>
      </div>

      {doodleCount > 0 && (
        <p className="px-4 pb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {doodleCount} doodle{doodleCount !== 1 ? "s" : ""} this year
        </p>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#c96442]/30 border-t-[#c96442] rounded-full animate-spin" />
        </div>
      ) : (
        <DoodleYearGrid
          year={currentYear}
          doodlesByDay={doodlesByDay}
          onDayTap={handleDayTap}
        />
      )}

      {activeDay && (
        <DoodleCanvas
          key={activeDay}
          initialStrokes={activeStrokes}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={handleClose}
          dayLabel={dayLabel(activeDay)}
        />
      )}
    </div>
  );
}
