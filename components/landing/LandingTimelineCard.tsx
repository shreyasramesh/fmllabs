"use client";

import React from "react";

import type { LandingTimelineEvent } from "@/components/landing/types";

function formatMinuteOfDay(minuteOfDay: number): string {
  const safeMinute = Math.max(0, Math.min(1439, minuteOfDay));
  const hours24 = Math.floor(safeMinute / 60);
  const minutes = safeMinute % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function minuteToAngle(minuteOfDay: number): number {
  const normalized = Math.max(0, Math.min(1440, minuteOfDay)) / 1440;
  return normalized * Math.PI * 2 - Math.PI / 2;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startMinute: number,
  endMinute: number
): string {
  const startAngle = minuteToAngle(startMinute);
  const endAngle = minuteToAngle(endMinute);
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const delta = Math.max(1, endMinute - startMinute);
  const largeArcFlag = delta > 720 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

interface LandingTimelineCardProps {
  eyebrow: string;
  dayLabel: string;
  events: LandingTimelineEvent[];
}

function eventTintClass(type: LandingTimelineEvent["type"]): string {
  switch (type) {
    case "nutrition":
      return "bg-sky-100 text-sky-600 ring-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800/70";
    case "weight":
      return "bg-emerald-100 text-emerald-600 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/70";
    case "exercise":
      return "bg-amber-100 text-amber-600 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/70";
    case "focus":
      return "bg-teal-100 text-teal-600 ring-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-800/70";
    default:
      return "bg-neutral-100 text-neutral-500 ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800/70";
  }
}

function TimelineMarkerIcon({ type }: { type: LandingTimelineEvent["type"] }) {
  if (type === "nutrition") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
        <path d="M8 3v8" />
        <path d="M6 3v5" />
        <path d="M10 3v5" />
        <path d="M8 11v10" />
        <path d="M16 3c1.7 2 2 4.4 0 7v11" />
      </svg>
    );
  }
  if (type === "weight") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
        <path d="M6 7h12l1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0" />
        <path d="M12 11l1.5-1.5" />
      </svg>
    );
  }
  if (type === "exercise") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
        <path d="M6 9v6" />
        <path d="M18 9v6" />
        <path d="M3 10v4" />
        <path d="M21 10v4" />
        <path d="M6 12h12" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

function eventClockRadius(type: LandingTimelineEvent["type"]): number {
  switch (type) {
    case "focus":
      return 123;
    case "exercise":
      return 105;
    case "nutrition":
      return 114;
    case "weight":
      return 132;
    default:
      return 118;
  }
}

export function LandingTimelineCard({ eyebrow, dayLabel, events }: LandingTimelineCardProps) {
  const nutritionCount = events.filter((event) => event.type === "nutrition").length;
  const weightCount = events.filter((event) => event.type === "weight").length;
  const exerciseCount = events.filter((event) => event.type === "exercise").length;
  const focusCount = events.filter((event) => event.type === "focus").length;
  const rangeEvents = events.filter((event) => event.type === "focus" || event.type === "exercise");
  const pointEvents = events.filter((event) => event.type === "nutrition" || event.type === "weight");

  return (
    <section className="w-full rounded-[2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-neutral-950/80 sm:p-5">
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
          <span>Nutrition {nutritionCount}</span>
          <span>Weight {weightCount}</span>
          <span>Exercise {exerciseCount}</span>
          <span>Focus {focusCount}</span>
        </div>
      </div>

      <div className="mt-4 rounded-[1.6rem] border border-[#E8D8C7]/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.94)_58%,rgba(255,244,236,0.9)_100%)] px-3 py-3 dark:border-[#5F4634] dark:bg-[radial-gradient(circle_at_top,rgba(38,29,23,0.98),rgba(28,22,17,0.95)_58%,rgba(24,19,15,0.92)_100%)] sm:px-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-center">
          <div className="relative mx-auto h-[18rem] w-[18rem] sm:h-[20rem] sm:w-[20rem]">
            <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden>
              <defs>
                <radialGradient id="activityClockGlow" cx="50%" cy="48%" r="62%">
                  <stop offset="0%" stopColor="rgba(255,248,236,0.95)" />
                  <stop offset="72%" stopColor="rgba(255,244,230,0.72)" />
                  <stop offset="100%" stopColor="rgba(255,240,220,0.2)" />
                </radialGradient>
              </defs>

              <circle cx="160" cy="160" r="130" fill="url(#activityClockGlow)" />
              <circle cx="160" cy="160" r="130" fill="none" stroke="rgba(229,219,206,0.95)" strokeWidth="10" />
              <circle cx="160" cy="160" r="112" fill="none" stroke="rgba(236,228,218,0.95)" strokeWidth="6" />
              <circle cx="160" cy="160" r="94" fill="none" stroke="rgba(239,232,223,0.9)" strokeWidth="3.5" />

              {Array.from({ length: 24 }).map((_, index) => {
                const angle = minuteToAngle(index * 60);
                const inner = polarToCartesian(160, 160, index % 6 === 0 ? 116 : 121, angle);
                const outer = polarToCartesian(160, 160, 129, angle);
                return (
                  <line
                    key={`clock-tick-${index}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={index % 6 === 0 ? "rgba(176,162,146,0.78)" : "rgba(205,193,180,0.72)"}
                    strokeWidth={index % 6 === 0 ? 2.4 : 1.2}
                    strokeLinecap="round"
                  />
                );
              })}

              {rangeEvents.map((event, index) => (
                <path
                  key={`clock-range-${event.type}-${index}`}
                  d={describeArc(
                    160,
                    160,
                    eventClockRadius(event.type),
                    event.startMinute,
                    Math.max(event.startMinute + 8, event.endMinute)
                  )}
                  fill="none"
                  stroke={event.color}
                  strokeWidth={event.type === "focus" ? 10 : 8}
                  strokeLinecap="round"
                  opacity={0.78}
                />
              ))}
            </svg>

            <div className="absolute left-1/2 top-3 -translate-x-1/2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              12 AM
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              6 AM
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              12 PM
            </div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              6 PM
            </div>

            {pointEvents.map((event, index) => {
              const angle = minuteToAngle(event.startMinute);
              const position = polarToCartesian(160, 160, eventClockRadius(event.type), angle);
              return (
                <div
                  key={`clock-point-${event.type}-${index}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(position.x / 320) * 100}%`, top: `${(position.y / 320) * 100}%` }}
                  title={`${event.label} - ${formatMinuteOfDay(event.startMinute)}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 shadow-sm ${eventTintClass(event.type)}`}>
                    <TimelineMarkerIcon type={event.type} />
                  </span>
                </div>
              );
            })}

            <div className="absolute inset-[4.2rem] flex flex-col items-center justify-center rounded-full border border-[#E9DECF] bg-white/72 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-neutral-950/65">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                24h clock
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                {events.length}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                logged events
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#E6DDD3] bg-white/82 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/65">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  Nutrition
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{nutritionCount}</p>
              </div>
              <div className="rounded-2xl border border-[#E6DDD3] bg-white/82 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/65">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  Focus
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{focusCount}</p>
              </div>
              <div className="rounded-2xl border border-[#E6DDD3] bg-white/82 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/65">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  Exercise
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{exerciseCount}</p>
              </div>
              <div className="rounded-2xl border border-[#E6DDD3] bg-white/82 px-3 py-3 dark:border-white/10 dark:bg-neutral-900/65">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  Weight
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{weightCount}</p>
              </div>
            </div>

            {events.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {events.slice(0, 8).map((event, index) => (
                  <div
                    key={`clock-event-card-${index}`}
                    className="flex items-center gap-2 rounded-2xl border border-[#E6DDD3] bg-white/86 px-3 py-2.5 dark:border-white/10 dark:bg-neutral-900/72"
                    title={
                      event.type === "focus" || event.type === "exercise"
                        ? `${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`
                        : `${event.label} - ${formatMinuteOfDay(event.startMinute)}`
                    }
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 ${eventTintClass(event.type)}`}>
                      <TimelineMarkerIcon type={event.type} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{event.label}</span>
                      <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                        {event.type === "focus" || event.type === "exercise"
                          ? `${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`
                          : formatMinuteOfDay(event.startMinute)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
