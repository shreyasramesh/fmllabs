"use client";

import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import type { DoodleStroke } from "@/lib/db";
import { DoodleCanvas } from "@/components/landing/doodle/DoodleCanvas";
import { DoodleYearGrid } from "@/components/landing/doodle/DoodleYearGrid";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeading(dayKey: string): { date: string; sub: string } {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const date = dt.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const today = todayKey();
  return { date, sub: dayKey === today ? "Today" : dt.toLocaleDateString(undefined, { weekday: "long" }) };
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

function singleStrokePath(stroke: DoodleStroke): string {
  if (stroke.points.length === 0) return "";
  const pts = stroke.points;
  const parts = [`M${pts[0].x},${pts[0].y}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    parts.push(`Q${pts[i].x},${pts[i].y} ${mx},${my}`);
  }
  if (pts.length > 1) {
    const last = pts[pts.length - 1];
    parts.push(`L${last.x},${last.y}`);
  }
  return parts.join(" ");
}

function DoodlePreview({ strokes }: { strokes: DoodleStroke[] }) {
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {strokes.map((s, i) => {
        const d = singleStrokePath(s);
        if (!d) return null;
        const isEraser = s.color === "__eraser__";
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={isEraser ? "#faf9f5" : s.color}
            strokeWidth={s.width * 0.006}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

export function LandingMobileDoodleTab() {
  const currentYear = new Date().getFullYear();
  const [doodlesByDay, setDoodlesByDay] = useState<Record<string, DoodleStroke[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const panelDragStartRef = useRef<number | null>(null);
  const [panelDragOffset, setPanelDragOffset] = useState(0);

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
            if (d.dayKey && Array.isArray(d.strokes)) map[d.dayKey] = d.strokes;
          }
        }
        setDoodlesByDay(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentYear]);

  const handleDayTap = useCallback((dayKey: string) => {
    setSelectedDay(dayKey);
  }, []);

  const openCanvas = useCallback(() => { setCanvasOpen(true); }, []);

  const handleSave = useCallback(async (strokes: DoodleStroke[]) => {
    setDoodlesByDay((prev) => ({ ...prev, [selectedDay]: strokes }));
    setCanvasOpen(false);
    try {
      await fetch("/api/me/doodle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayKey: selectedDay, strokes }),
      });
    } catch { /* best effort */ }
  }, [selectedDay]);

  const handleDelete = useCallback(async () => {
    setDoodlesByDay((prev) => {
      const next = { ...prev };
      delete next[selectedDay];
      return next;
    });
    setCanvasOpen(false);
    try {
      await fetch("/api/me/doodle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayKey: selectedDay }),
      });
    } catch { /* best effort */ }
  }, [selectedDay]);

  const handleCanvasClose = useCallback(() => { setCanvasOpen(false); }, []);

  const handlePanelDragStart = useCallback((clientY: number) => { panelDragStartRef.current = clientY; }, []);
  const handlePanelDragMove = useCallback((clientY: number) => {
    if (panelDragStartRef.current === null) return;
    setPanelDragOffset(Math.max(0, clientY - panelDragStartRef.current));
  }, []);
  const handlePanelDragEnd = useCallback(() => {
    if (panelDragStartRef.current === null) return;
    panelDragStartRef.current = null;
    if (panelDragOffset > 100) {
      setPanelCollapsed(true);
    }
    setPanelDragOffset(0);
  }, [panelDragOffset]);

  const selectedStrokes = doodlesByDay[selectedDay] ?? [];
  const hasDoodle = selectedStrokes.length > 0;
  const heading = formatDayHeading(selectedDay);
  const isToday = selectedDay === todayKey();

  const actionBtnClass =
    "flex items-center justify-center w-10 h-10 rounded-full bg-neutral-200/80 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors shadow-sm";

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Calendar (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#c96442]/30 border-t-[#c96442] rounded-full animate-spin" />
          </div>
        ) : expanded ? (
          <div>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-2xl font-bold text-foreground">{currentYear}</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200/70 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                aria-label="Collapse to current month"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {Array.from({ length: 12 }).map((_, m) => (
              <DoodleYearGrid
                key={m}
                year={currentYear}
                month={m}
                doodlesByDay={doodlesByDay}
                selectedDay={selectedDay}
                onDayTap={handleDayTap}
                hideYearHeader
              />
            ))}
          </div>
        ) : (
          <DoodleYearGrid
            year={currentYear}
            month={new Date().getMonth()}
            doodlesByDay={doodlesByDay}
            selectedDay={selectedDay}
            onDayTap={handleDayTap}
            onExpand={() => setExpanded(true)}
          />
        )}
      </div>

      {/* Collapsed: small "show panel" button */}
      {panelCollapsed && (
        <div className="shrink-0 flex justify-center py-3 pb-20">
          <button
            type="button"
            onClick={() => setPanelCollapsed(false)}
            className="rounded-full bg-[#c96442] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#b05530] transition-colors"
          >
            {heading.date} {isToday ? "— Today" : ""}
          </button>
        </div>
      )}

      {/* Bottom detail panel */}
      {!panelCollapsed && (
      <div
        className="shrink-0 rounded-t-3xl bg-white dark:bg-[#1e1d1b] border-t border-[#e8e6dc] dark:border-[#3d3d3a] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)] pb-20"
        style={{
          transform: panelDragOffset > 0 ? `translateY(${panelDragOffset}px)` : undefined,
          transition: panelDragStartRef.current !== null ? "none" : "transform 0.25s ease-out",
        }}
      >
        {/* Handle — drag to dismiss */}
        <div
          className="flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => handlePanelDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handlePanelDragMove(e.touches[0].clientY)}
          onTouchEnd={handlePanelDragEnd}
          onMouseDown={(e) => { handlePanelDragStart(e.clientY); const mv = (ev: MouseEvent) => handlePanelDragMove(ev.clientY); const up = () => { handlePanelDragEnd(); window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up); }}
        >
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Header row: actions + date + actions */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex gap-2">
            {/* Share placeholder */}
            <button type="button" className={actionBtnClass} aria-label="Share" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .799l6.733 3.366a2.5 2.5 0 1 1-.671 1.341l-6.733-3.366a2.5 2.5 0 1 1 0-3.482l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
              </svg>
            </button>
            {/* Reminder placeholder */}
            <button type="button" className={actionBtnClass} aria-label="Reminder" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <p className="text-[15px] font-bold text-foreground">{heading.date}</p>
            <p className={`text-[12px] font-medium ${isToday ? "text-[#c96442]" : "text-neutral-500 dark:text-neutral-400"}`}>
              {heading.sub}
            </p>
          </div>

          <div className="flex gap-2">
            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!hasDoodle}
              className={`${actionBtnClass} disabled:opacity-30`}
              aria-label="Delete doodle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
            {/* Draw / Edit */}
            <button
              type="button"
              onClick={openCanvas}
              className={`${actionBtnClass} !bg-[#c96442] !text-white hover:!bg-[#b05530]`}
              aria-label="Draw doodle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Doodle preview or empty prompt */}
        <div className="px-5 pb-4">
          <div
            className="mx-auto aspect-square max-w-[240px] rounded-2xl border border-[#e8e6dc] dark:border-[#3d3d3a] bg-[#faf9f5] dark:bg-[#2a2927] overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#c96442]/40 transition-colors"
            onClick={openCanvas}
          >
            {hasDoodle ? (
              <div className="w-full h-full p-3">
                <DoodlePreview strokes={selectedStrokes} />
              </div>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">Tap to draw</p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Canvas overlay */}
      {canvasOpen && (
        <DoodleCanvas
          key={selectedDay}
          initialStrokes={selectedStrokes}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={handleCanvasClose}
          dayLabel={`${heading.date}${isToday ? " — Today" : ""}`}
        />
      )}
    </div>
  );
}
