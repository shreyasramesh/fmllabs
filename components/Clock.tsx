"use client";

import { useEffect, useState } from "react";

type ClockProps = {
  onMoonPhaseChange?: (phase: number | null) => void;
};

function fallbackMoonPhase(now = new Date()): number {
  // Approximate synodic month progression, good enough for icon display.
  const synodicMonth = 29.53058867;
  const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (now.getTime() - knownNewMoonUtc) / 86400000;
  const phaseDays = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
  return phaseDays / synodicMonth;
}

function getNowForTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const getNum = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const year = getNum("year");
  const month = getNum("month");
  const day = getNum("day");
  const hour = getNum("hour");
  const minute = getNum("minute");
  const second = getNum("second");
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function resolveMoonPhaseFromTimezone(timeZone: string | null): number {
  if (!timeZone) return fallbackMoonPhase();
  try {
    return fallbackMoonPhase(getNowForTimeZone(timeZone));
  } catch {
    return fallbackMoonPhase();
  }
}

export function Clock({ onMoonPhaseChange }: ClockProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    onMoonPhaseChange?.(resolveMoonPhaseFromTimezone(null));
    const id = setInterval(() => {
      setTime(new Date());
      onMoonPhaseChange?.(resolveMoonPhaseFromTimezone(null));
    }, 1000);
    return () => clearInterval(id);
  }, [onMoonPhaseChange]);

  if (!time) return null;

  const nowText = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(time);

  return (
    <time
      dateTime={time.toISOString()}
      className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
    >
      {nowText}
    </time>
  );
}
