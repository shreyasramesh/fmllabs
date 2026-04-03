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

interface LandingTimelineCardProps {
  eyebrow: string;
  dayLabel: string;
  events: LandingTimelineEvent[];
}

function eventMarkerClass(type: LandingTimelineEvent["type"]): string {
  switch (type) {
    case "nutrition":
      return "bg-sky-500";
    case "weight":
      return "bg-emerald-500";
    case "exercise":
      return "bg-amber-400";
    case "focus":
      return "bg-teal-500";
    default:
      return "bg-neutral-400";
  }
}

export function LandingTimelineCard({ eyebrow, dayLabel, events }: LandingTimelineCardProps) {
  const nutritionCount = events.filter((event) => event.type === "nutrition").length;
  const weightCount = events.filter((event) => event.type === "weight").length;
  const exerciseCount = events.filter((event) => event.type === "exercise").length;
  const focusCount = events.filter((event) => event.type === "focus").length;

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
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Daily timeline from 12 AM to 12 AM
        </p>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-[#E8D8C7]/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(255,247,238,0.92)_55%,rgba(255,244,236,0.85)_100%)] px-3 py-3 dark:border-[#5F4634] dark:bg-[radial-gradient(circle_at_top,rgba(38,29,23,0.96),rgba(28,22,17,0.94)_55%,rgba(24,19,15,0.9)_100%)] sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>Nutrition {nutritionCount}</span>
          <span>Weight {weightCount}</span>
          <span>Exercise {exerciseCount}</span>
          <span>Focus {focusCount}</span>
        </div>

        <div className="mt-4">
          <div className="relative h-[42px] overflow-hidden rounded-full border border-[#E6DDD3] bg-white/80 px-2 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="absolute inset-x-2 top-1/2 h-[8px] -translate-y-1/2 rounded-full bg-[#E9E1D8] dark:bg-white/10" />
            <div className="absolute inset-x-3 bottom-[7px] flex items-center justify-between">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={`tick-${index}`}
                  className={`rounded-full ${
                    index % 6 === 0
                      ? "h-[3px] w-[3px] bg-[#B7AB9E] dark:bg-neutral-500"
                      : "h-[2px] w-[2px] bg-[#CFC5BB] dark:bg-neutral-700"
                  }`}
                  aria-hidden
                />
              ))}
            </div>
            {events.map((event, index) => {
              const leftPct = Math.max(0, Math.min(100, (event.startMinute / 1440) * 100));
              const durationMinutes = Math.max(1, event.endMinute - event.startMinute);
              const widthPct = Math.max(0.8, Math.min(100, (durationMinutes / 1440) * 100));
              const isRange = event.type === "focus" || event.type === "exercise";
              if (isRange) {
                return (
                  <div
                    key={`timeline-band-${index}`}
                    className="absolute top-1/2 h-[8px] -translate-y-1/2 rounded-full opacity-75"
                    style={{
                      left: `calc(${leftPct}% + 8px)`,
                      width: `max(${widthPct}%, 8px)`,
                      backgroundColor: event.color,
                    }}
                    title={`${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`}
                  />
                );
              }

              return (
                <div
                  key={`timeline-pill-${index}`}
                  className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm dark:border-neutral-900"
                  style={{ left: `calc(${leftPct}% + 8px)`, backgroundColor: event.color }}
                  title={`${event.label} - ${formatMinuteOfDay(event.startMinute)}`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-neutral-400 dark:text-neutral-500">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
            <span>12a</span>
          </div>

          {events.length > 0 && (
            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex min-w-max items-start gap-3">
                {events.slice(0, 12).map((event, index) => {
                  const leftPct = Math.max(0, Math.min(100, (event.startMinute / 1440) * 100));
                  return (
                    <div
                      key={`timeline-marker-${index}`}
                      className="flex min-w-[40px] flex-col items-center gap-1"
                      title={
                        event.type === "focus" || event.type === "exercise"
                          ? `${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`
                          : `${event.label} - ${formatMinuteOfDay(event.startMinute)}`
                      }
                    >
                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                        {formatMinuteOfDay(event.startMinute)}
                      </span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 ring-1 ring-[#E4D9CF] dark:bg-neutral-900/90 dark:ring-white/10">
                        <span className={`h-2.5 w-2.5 rounded-full ${eventMarkerClass(event.type)}`} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
