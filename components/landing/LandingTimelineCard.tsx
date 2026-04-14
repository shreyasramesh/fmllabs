"use client";

import { useMemo, useLayoutEffect, useState } from "react";
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

type EventType = LandingTimelineEvent["type"];

interface LaneConfig {
  type: EventType;
  label: string;
  dot: string;
  dotDark: string;
  bar: string;
  barDark: string;
  isRange: boolean;
}

const LANES: LaneConfig[] = [
  { type: "sleep",     label: "Sleep",     dot: "#818cf8", dotDark: "#a5b4fc", bar: "#818cf8", barDark: "#a5b4fc", isRange: true },
  { type: "nutrition", label: "Nutrition",  dot: "#0ea5e9", dotDark: "#38bdf8", bar: "#0ea5e9", barDark: "#38bdf8", isRange: false },
  { type: "caffeine",  label: "Caffeine",   dot: "#d97706", dotDark: "#fbbf24", bar: "#d97706", barDark: "#fbbf24", isRange: false },
  { type: "exercise",  label: "Exercise",   dot: "#f97316", dotDark: "#fb923c", bar: "#f97316", barDark: "#fb923c", isRange: true },
  { type: "focus",     label: "Focus",      dot: "#8b5cf6", dotDark: "#a78bfa", bar: "#8b5cf6", barDark: "#a78bfa", isRange: true },
  { type: "weight",    label: "Weight",     dot: "#10b981", dotDark: "#34d399", bar: "#10b981", barDark: "#34d399", isRange: false },
];

function LaneIcon({ type, className }: { type: EventType; className?: string }) {
  const cls = className ?? "h-3.5 w-3.5";
  const props = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: cls, "aria-hidden": true as const };

  switch (type) {
    case "nutrition":
      return <svg {...props}><path d="M8 3v8" /><path d="M6 3v5" /><path d="M10 3v5" /><path d="M8 11v10" /><path d="M16 3c1.7 2 2 4.4 0 7v11" /></svg>;
    case "weight":
      return <svg {...props}><path d="M6 7h12l1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0" /><path d="M12 11l1.5-1.5" /></svg>;
    case "exercise":
      return <svg {...props}><path d="M6 9v6" /><path d="M18 9v6" /><path d="M3 10v4" /><path d="M21 10v4" /><path d="M6 12h12" /></svg>;
    case "focus":
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></svg>;
    case "sleep":
      return <svg {...props}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>;
    case "caffeine":
      return <svg {...props}><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" x2="6" y1="2" y2="4" /><line x1="10" x2="10" y1="2" y2="4" /><line x1="14" x2="14" y1="2" y2="4" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

interface LandingTimelineCardProps {
  eyebrow: string;
  dayLabel: string;
  events: LandingTimelineEvent[];
  onTimelineEventClick?: (event: LandingTimelineEvent) => void;
}

/** Every 3 hours — desktop / tablet */
const TIME_TICKS_WIDE = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440];
/** Every 6 hours — fits narrow phones without overlapping labels */
const TIME_TICKS_NARROW = [0, 360, 720, 1080];
/** Every 12 hours — very small viewports */
const TIME_TICKS_COMPACT = [0, 720];

const LANE_HEIGHT = 30;
const GUTTER_WIDTH = 106;

function useTimelineTickMinutes(): number[] {
  const [tier, setTier] = useState<"wide" | "narrow" | "compact">("narrow");
  useLayoutEffect(() => {
    const wideMql = window.matchMedia("(min-width: 640px)");
    const compactMql = window.matchMedia("(max-width: 380px)");
    const sync = () => {
      if (wideMql.matches) setTier("wide");
      else if (compactMql.matches) setTier("compact");
      else setTier("narrow");
    };
    sync();
    wideMql.addEventListener("change", sync);
    compactMql.addEventListener("change", sync);
    return () => {
      wideMql.removeEventListener("change", sync);
      compactMql.removeEventListener("change", sync);
    };
  }, []);
  if (tier === "wide") return TIME_TICKS_WIDE;
  if (tier === "compact") return TIME_TICKS_COMPACT;
  return TIME_TICKS_NARROW;
}

function getPstMinuteOfDay(): number {
  const now = new Date();
  const pst = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pst.getHours() * 60 + pst.getMinutes();
}

export function LandingTimelineCard({
  eyebrow,
  dayLabel,
  events,
  onTimelineEventClick,
}: LandingTimelineCardProps) {
  const timeTicks = useTimelineTickMinutes();
  const nowMinute = useMemo(getPstMinuteOfDay, []);

  const eventsByType = useMemo(() => {
    const map = new Map<EventType, LandingTimelineEvent[]>();
    for (const e of events) {
      const arr = map.get(e.type);
      if (arr) arr.push(e);
      else map.set(e.type, [e]);
    }
    return map;
  }, [events]);

  const activeLanes = useMemo(
    () => LANES.filter((lane) => (eventsByType.get(lane.type)?.length ?? 0) > 0),
    [eventsByType],
  );

  const toPercent = (minute: number) => (Math.max(0, Math.min(1440, minute)) / 1440) * 100;

  return (
    <section className="landing-module-glass w-full overflow-hidden rounded-[2rem] border p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c96442] dark:text-[#d97757]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
          {dayLabel} activity
        </h2>
      </div>

      <div className="module-nested-frame mt-4 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.94)_58%,rgba(255,244,236,0.9)_100%)] px-2 py-4 dark:bg-neutral-800 sm:px-4">
        {activeLanes.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
            No activity yet for this day.
          </p>
        ) : (
          <div className="relative flex">
            {/* Left gutter with lane labels */}
            <div className="flex-none" style={{ width: GUTTER_WIDTH }}>
              {activeLanes.map((lane, idx) => (
                <div
                  key={lane.type}
                  className={`flex items-center gap-1.5 pr-2 ${idx % 2 === 1 ? "bg-neutral-50/60 dark:bg-neutral-700/20" : ""}`}
                  style={{ height: LANE_HEIGHT }}
                >
                  <span
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full"
                    style={{ backgroundColor: `${lane.dot}20` }}
                  >
                    <LaneIcon type={lane.type} className="h-2.5 w-2.5" />
                  </span>
                  <span className="truncate text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                    {lane.label}
                  </span>
                  <span className="ml-auto flex-none text-[10px] tabular-nums font-semibold text-neutral-400 dark:text-neutral-500">
                    {eventsByType.get(lane.type)?.length ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {/* Track area */}
            <div className="relative min-w-0 flex-1">
              {/* Tick grid lines spanning all lanes */}
              {timeTicks.map((minute) => (
                <div
                  key={`grid-${minute}`}
                  className="absolute top-0 w-px bg-neutral-200/60 dark:bg-neutral-600/40"
                  style={{
                    left: `${toPercent(minute)}%`,
                    height: activeLanes.length * LANE_HEIGHT,
                  }}
                />
              ))}

              {/* Now indicator spanning all lanes */}
              <div
                className="absolute top-0 z-20 flex flex-col items-center"
                style={{
                  left: `${toPercent(nowMinute)}%`,
                  height: activeLanes.length * LANE_HEIGHT,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="w-px border-l border-dashed border-[#c96442]/70 dark:border-[#d97757]/70"
                  style={{ height: activeLanes.length * LANE_HEIGHT }}
                />
                <span className="mt-0.5 rounded-sm bg-[#c96442]/10 px-1 text-[7px] font-bold uppercase tracking-wide text-[#c96442] dark:text-[#d97757]">
                  Now
                </span>
              </div>

              {/* Swim lanes */}
              {activeLanes.map((lane, idx) => {
                const laneEvents = eventsByType.get(lane.type) ?? [];
                return (
                  <div
                    key={lane.type}
                    className={`relative ${idx % 2 === 1 ? "bg-neutral-50/60 dark:bg-neutral-700/20" : ""}`}
                    style={{ height: LANE_HEIGHT }}
                  >
                    {/* Thin horizontal track line */}
                    <div
                      className="absolute left-0 right-0 h-px bg-neutral-200/80 dark:bg-neutral-600/50"
                      style={{ top: LANE_HEIGHT / 2 }}
                    />

                    {/* Events */}
                    {laneEvents.map((event, i) => {
                      if (lane.isRange) {
                        const left = toPercent(event.startMinute);
                        const width = Math.max(0.6, toPercent(event.endMinute) - left);
                        const interactive = Boolean(event.sleepEntryId && onTimelineEventClick);
                        return (
                          <div
                            key={`bar-${lane.type}-${i}-${event.sleepEntryId ?? i}`}
                            role={interactive ? "button" : undefined}
                            tabIndex={interactive ? 0 : undefined}
                            className={`absolute z-10 rounded-full ${interactive ? "cursor-pointer hover:opacity-100 hover:ring-2 hover:ring-white/30" : ""}`}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              height: 8,
                              top: (LANE_HEIGHT - 8) / 2,
                              backgroundColor: lane.bar,
                              opacity: 0.8,
                            }}
                            title={`${event.label} · ${formatMinuteOfDay(event.startMinute)}–${formatMinuteOfDay(event.endMinute)}`}
                            onClick={
                              interactive
                                ? (e) => {
                                    e.stopPropagation();
                                    onTimelineEventClick?.(event);
                                  }
                                : undefined
                            }
                            onKeyDown={
                              interactive
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      onTimelineEventClick?.(event);
                                    }
                                  }
                                : undefined
                            }
                          />
                        );
                      }
                      const left = toPercent(event.startMinute);
                      return (
                        <div
                          key={`dot-${lane.type}-${i}`}
                          className="absolute z-10 -translate-x-1/2 rounded-full"
                          style={{
                            left: `${left}%`,
                            width: 8,
                            height: 8,
                            top: (LANE_HEIGHT - 8) / 2,
                            backgroundColor: lane.dot,
                          }}
                          title={`${event.label} · ${formatMinuteOfDay(event.startMinute)}`}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {/* Time axis labels */}
              <div className="relative mt-2 min-h-[18px] sm:min-h-[16px]">
                {timeTicks.map((minute) => (
                  <span
                    key={`label-${minute}`}
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-neutral-500 dark:text-neutral-400 select-none sm:text-[11px]"
                    style={{ left: `${toPercent(minute)}%` }}
                  >
                    {formatMinuteShort(minute % 1440)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
