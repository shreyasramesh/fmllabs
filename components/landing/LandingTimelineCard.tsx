"use client";

import { useMemo } from "react";
import type { LandingTimelineEvent } from "@/components/landing/types";

function formatMinuteShort(minuteOfDay: number): string {
  const h24 = Math.floor(Math.max(0, Math.min(1439, minuteOfDay)) / 60);
  const suffix = h24 >= 12 ? "p" : "a";
  const h12 = h24 % 12 || 12;
  return `${h12}${suffix}`;
}

function formatMinuteOfDay(minuteOfDay: number): string {
  const safe = Math.max(0, Math.min(1439, minuteOfDay));
  const h24 = Math.floor(safe / 60);
  const m = safe % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const SEGMENT_COLORS: Record<LandingTimelineEvent["type"], { bar: string; barDark: string }> = {
  nutrition: { bar: "#6DA37E", barDark: "#4ade80" },
  exercise: { bar: "#6DA37E", barDark: "#4ade80" },
  weight: { bar: "#E8C170", barDark: "#fbbf24" },
  focus: { bar: "#6DA37E", barDark: "#4ade80" },
};

function eventTintClass(type: LandingTimelineEvent["type"]): string {
  switch (type) {
    case "nutrition":
      return "bg-sky-100 text-sky-600 ring-sky-200/80 dark:bg-sky-900/60 dark:text-sky-300 dark:ring-sky-700/70";
    case "weight":
      return "bg-emerald-100 text-emerald-600 ring-emerald-200/80 dark:bg-emerald-900/60 dark:text-emerald-300 dark:ring-emerald-700/70";
    case "exercise":
      return "bg-amber-100 text-amber-600 ring-amber-200/80 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-700/70";
    case "focus":
      return "bg-teal-100 text-teal-600 ring-teal-200/80 dark:bg-teal-900/60 dark:text-teal-300 dark:ring-teal-700/70";
    default:
      return "bg-neutral-100 text-neutral-500 ring-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700/70";
  }
}

function TimelineMarkerIcon({ type }: { type: LandingTimelineEvent["type"] }) {
  if (type === "nutrition") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
        <path d="M8 3v8" /><path d="M6 3v5" /><path d="M10 3v5" /><path d="M8 11v10" /><path d="M16 3c1.7 2 2 4.4 0 7v11" />
      </svg>
    );
  }
  if (type === "weight") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
        <path d="M6 7h12l1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0" /><path d="M12 11l1.5-1.5" />
      </svg>
    );
  }
  if (type === "exercise") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
        <path d="M6 9v6" /><path d="M18 9v6" /><path d="M3 10v4" /><path d="M21 10v4" /><path d="M6 12h12" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
      <circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

interface LandingTimelineCardProps {
  eyebrow: string;
  dayLabel: string;
  events: LandingTimelineEvent[];
}

const TIME_TICKS = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440];

function getPstMinuteOfDay(): number {
  const now = new Date();
  const pst = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pst.getHours() * 60 + pst.getMinutes();
}

export function LandingTimelineCard({ eyebrow, dayLabel, events }: LandingTimelineCardProps) {
  const nutritionCount = events.filter((e) => e.type === "nutrition").length;
  const weightCount = events.filter((e) => e.type === "weight").length;
  const exerciseCount = events.filter((e) => e.type === "exercise").length;
  const focusCount = events.filter((e) => e.type === "focus").length;

  const rangeEvents = events.filter((e) => e.type === "focus" || e.type === "exercise");
  const pointEvents = events.filter((e) => e.type === "nutrition" || e.type === "weight");

  const toPercent = (minute: number) => (Math.max(0, Math.min(1440, minute)) / 1440) * 100;

  const nowMinute = useMemo(getPstMinuteOfDay, []);

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-white/60 bg-white/50 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
            {dayLabel} activity
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />Nutrition {nutritionCount}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Weight {weightCount}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />Exercise {exerciseCount}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-teal-500" />Focus {focusCount}</span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#E8D8C7]/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.94)_58%,rgba(255,244,236,0.9)_100%)] px-4 py-5 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800 sm:px-5">
        {/* Rail container */}
        <div className="relative mx-auto" style={{ paddingBottom: "2.5rem" }}>
          {/* Background rail */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-700">
            {/* Range-event segments (focus, exercise) */}
            {rangeEvents.map((event, i) => {
              const left = toPercent(event.startMinute);
              const width = Math.max(0.5, toPercent(event.endMinute) - left);
              const colors = SEGMENT_COLORS[event.type];
              return (
                <div
                  key={`seg-${event.type}-${i}`}
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: colors.bar,
                    opacity: 0.85,
                  }}
                  title={`${event.label} · ${formatMinuteOfDay(event.startMinute)}–${formatMinuteOfDay(event.endMinute)}`}
                />
              );
            })}
          </div>

          {/* Tick marks on the rail */}
          {TIME_TICKS.map((minute) => (
            <div
              key={`tick-${minute}`}
              className="absolute top-0 h-2.5 w-px bg-neutral-300/70 dark:bg-neutral-600/70"
              style={{ left: `${toPercent(minute)}%` }}
            />
          ))}

          {/* Current time (PST) indicator */}
          <div
            className="absolute top-0 z-10 flex flex-col items-center"
            style={{ left: `${toPercent(nowMinute)}%`, transform: "translateX(-50%)" }}
          >
            <div className="h-2.5 w-[2px] rounded-full bg-[#B87B51]" />
            <span className="mt-0.5 text-[8px] font-bold text-[#B87B51]">Now</span>
          </div>

          {/* Point-event icon markers below the rail */}
          {pointEvents.map((event, i) => (
            <div
              key={`marker-${event.type}-${i}`}
              className="absolute -translate-x-1/2"
              style={{ left: `${toPercent(event.startMinute)}%`, top: "1rem" }}
              title={`${event.label} · ${formatMinuteOfDay(event.startMinute)}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ring-1 shadow-sm ${eventTintClass(event.type)}`}>
                <TimelineMarkerIcon type={event.type} />
              </span>
            </div>
          ))}

          {/* Time labels below the markers */}
          <div className="absolute left-0 right-0" style={{ top: "2.75rem" }}>
            {TIME_TICKS.map((minute) => (
              <span
                key={`label-${minute}`}
                className="absolute -translate-x-1/2 text-[10px] font-medium text-neutral-400 dark:text-neutral-500"
                style={{ left: `${toPercent(minute)}%` }}
              >
                {formatMinuteShort(minute % 1440)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
