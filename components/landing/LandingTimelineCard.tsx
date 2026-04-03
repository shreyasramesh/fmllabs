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
      return "bg-neutral-400 text-white ring-neutral-200 dark:bg-neutral-500 dark:ring-neutral-700";
    case "weight":
      return "bg-[#CBE3D8] text-[#5F8A72] ring-[#DCECE4] dark:bg-[#284034] dark:text-[#CAE6D8] dark:ring-[#345343]";
    case "exercise":
      return "bg-[#FFDCA8] text-[#B26B27] ring-[#FFE7C4] dark:bg-[#5A3A18] dark:text-[#FFD7A5] dark:ring-[#744C20]";
    case "focus":
      return "bg-[#D9ECEA] text-[#5A8D88] ring-[#E6F3F1] dark:bg-[#213A38] dark:text-[#CBE7E3] dark:ring-[#2C4D49]";
    default:
      return "bg-neutral-400 text-white ring-neutral-200 dark:bg-neutral-500 dark:ring-neutral-700";
  }
}

function eventBandColor(type: LandingTimelineEvent["type"]): string {
  switch (type) {
    case "nutrition":
      return "#d6d1c9";
    case "weight":
      return "#f6ca89";
    case "exercise":
      return "#dfe8e4";
    case "focus":
      return "#cfe3d9";
    default:
      return "#d6d1c9";
  }
}

function TimelineEventIcon({ type }: { type: LandingTimelineEvent["type"] }) {
  switch (type) {
    case "nutrition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M7.25 2a.75.75 0 0 1 .75.75V12a2 2 0 1 1-1.5 0V2.75A.75.75 0 0 1 7.25 2Zm5.5 0a.75.75 0 0 1 .75.75v4.5a2.75 2.75 0 0 1-2.75 2.75h-.25V22a.75.75 0 0 1-1.5 0V2.75a.75.75 0 0 1 1.5 0v5.75h.25c.69 0 1.25-.56 1.25-1.25v-4.5a.75.75 0 0 1 .75-.75Z" />
          <path d="M16.75 2a.75.75 0 0 1 .75.75V22a.75.75 0 0 1-1.5 0v-7h-1.25A1.75 1.75 0 0 1 13 13.25v-3.5A7.75 7.75 0 0 1 20.75 2h-4Z" />
        </svg>
      );
    case "weight":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M6.5 6h11a3.5 3.5 0 0 1 3.5 3.5v5A3.5 3.5 0 0 1 17.5 18h-11A3.5 3.5 0 0 1 3 14.5v-5A3.5 3.5 0 0 1 6.5 6Z" />
          <path d="M9 9.5A3 3 0 0 1 15 9.5" />
          <path d="M12 9.5l1.5 2" />
        </svg>
      );
    case "exercise":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <circle cx="14.5" cy="5.5" r="1.5" />
          <path d="M12.5 8 10 11l-2.5 1.5" />
          <path d="m11 11 2.5 2.5L15 20" />
          <path d="m10 12-3 3" />
        </svg>
      );
    case "focus":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <circle cx="12" cy="13" r="7" />
          <path d="M12 13 9.5 8.5" />
          <path d="M9 2h6" />
          <path d="M12 2v4" />
        </svg>
      );
    default:
      return null;
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
          <div className="relative rounded-[1.25rem] border border-[#ECE1D6] bg-white/70 px-3 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="relative h-[74px]">
              <div className="absolute inset-x-0 top-[8px] h-[12px] rounded-full bg-[#E7E0D6] dark:bg-white/10" />
              <div className="absolute inset-x-1 top-[11px] flex items-center justify-between">
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
                const laneTop =
                  event.type === "focus" ? "top-[8px] h-[12px]" : event.type === "exercise" ? "top-[24px] h-[12px]" : "";
                if (isRange) {
                  return (
                    <div
                      key={`timeline-band-${index}`}
                      className={`absolute rounded-full ring-1 ring-inset ring-[#93B6A2]/45 dark:ring-white/10 ${laneTop}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: eventBandColor(event.type),
                      }}
                      title={`${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`}
                    >
                      <div className="absolute inset-y-[2px] left-[2px] right-[2px] rounded-full border border-[#6E9D7D]/80 dark:border-[#87B693]/60" />
                      <div className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#688F73] ring-1 ring-[#BCD3C1] dark:bg-neutral-900/90 dark:text-[#CAE6D8] dark:ring-[#355245]">
                        <TimelineEventIcon type={event.type} />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`timeline-pill-${index}`}
                    className="absolute top-[24px] h-[10px] w-[26px] -translate-x-1/2 rounded-full"
                    style={{ left: `${leftPct}%`, backgroundColor: eventBandColor(event.type) }}
                    title={`${event.label} - ${formatMinuteOfDay(event.startMinute)}`}
                  />
                );
              })}

              <div className="absolute inset-x-1 top-[50px] flex items-center justify-between">
                {Array.from({ length: 25 }).map((_, index) => (
                  <span
                    key={`micro-tick-${index}`}
                    className="h-[3px] w-[1px] rounded-full bg-[#C7BCAF] dark:bg-neutral-700"
                    aria-hidden
                  />
                ))}
              </div>

              {events.map((event, index) => {
                const leftPct = Math.max(0, Math.min(100, (event.startMinute / 1440) * 100));
                return (
                  <div
                    key={`timeline-icon-${index}`}
                    className="absolute top-[42px] flex -translate-x-1/2 flex-col items-center gap-1"
                    style={{ left: `${leftPct}%` }}
                    title={
                      event.type === "focus" || event.type === "exercise"
                        ? `${event.label} - ${formatMinuteOfDay(event.startMinute)} to ${formatMinuteOfDay(event.endMinute)}`
                        : `${event.label} - ${formatMinuteOfDay(event.startMinute)}`
                    }
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ${eventMarkerClass(event.type)}`}>
                      <TimelineEventIcon type={event.type} />
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-neutral-400 dark:text-neutral-500">
              <span>12a</span>
              <span>6a</span>
              <span>12p</span>
              <span>6p</span>
              <span>12a</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
