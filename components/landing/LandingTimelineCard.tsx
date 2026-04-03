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

      <div className="mt-4 rounded-[1.5rem] border border-[#E8C8A9]/70 bg-[#FFF9F4] p-3 dark:border-[#6A4A33] dark:bg-[#1B1511] sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
            Nutrition
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Weight
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
            Exercise
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden />
            Focus
          </span>
        </div>

        <div className="mt-4">
          <div className="relative h-12 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,transparent_calc(25%-1px),rgba(148,163,184,0.3)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(148,163,184,0.3)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(148,163,184,0.3)_75%,transparent_calc(75%+1px),transparent_100%)]" />
            {events.map((event, index) => {
              const leftPct = Math.max(0, Math.min(100, (event.startMinute / 1440) * 100));
              const durationMinutes = Math.max(1, event.endMinute - event.startMinute);
              const widthPct = Math.max(0.35, Math.min(100, (durationMinutes / 1440) * 100));
              if (event.type === "focus" || event.type === "exercise") {
                const topClass = event.type === "exercise" ? "top-1 h-[14px]" : "top-[24px] h-[14px]";
                return (
                  <div
                    key={`timeline-band-${index}`}
                    className={`absolute rounded-full ${topClass}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: event.color,
                    }}
                    title={`${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`}
                  />
                );
              }

              return (
                <div
                  key={`timeline-line-${index}`}
                  className="absolute bottom-0 top-0 w-[2px]"
                  style={{ left: `${leftPct}%`, backgroundColor: event.color }}
                  title={`${event.label} - ${formatMinuteOfDay(event.startMinute)}`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/85 px-2.5 py-1 dark:border-neutral-700 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
            Nutrition {nutritionCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/85 px-2.5 py-1 dark:border-neutral-700 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Weight {weightCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/85 px-2.5 py-1 dark:border-neutral-700 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
            Exercise {exerciseCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/85 px-2.5 py-1 dark:border-neutral-700 dark:bg-black/30">
            <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden />
            Focus {focusCount}
          </span>
        </div>

        {events.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
            {events
              .filter((event) => event.type === "nutrition" || event.type === "weight")
              .slice(0, 6)
              .map((event, index) => (
                <span
                  key={`timeline-time-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: event.color }}
                    aria-hidden
                  />
                  {formatMinuteOfDay(event.startMinute)}
                </span>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
