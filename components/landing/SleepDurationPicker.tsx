"use client";

import React from "react";
import { roundSleepHoursToMinute } from "@/lib/sleep-duration";

function clampMinutes(totalMinutes: number): number {
  if (!Number.isFinite(totalMinutes)) return 450;
  return Math.max(30, Math.min(1440, Math.round(totalMinutes)));
}

type SleepDurationPickerProps = {
  valueHours: number;
  onChangeHours: (hours: number) => void;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  separatorClassName?: string;
};

export function SleepDurationPicker({
  valueHours,
  onChangeHours,
  disabled = false,
  className = "",
  selectClassName = "",
  separatorClassName = "",
}: SleepDurationPickerProps) {
  const totalMinutes = clampMinutes(valueHours * 60);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  const minuteOptions =
    hour === 24
      ? [0]
      : hour === 0
        ? Array.from({ length: 30 }, (_, idx) => idx + 30)
        : Array.from({ length: 60 }, (_, idx) => idx);

  const updateValue = (nextHour: number, nextMinute: number) => {
    const safeHour = Math.max(0, Math.min(24, nextHour));
    const safeMinute = safeHour === 24 ? 0 : Math.max(0, Math.min(59, nextMinute));
    onChangeHours(roundSleepHoursToMinute(safeHour + safeMinute / 60));
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <select
        value={String(hour)}
        onChange={(e) => updateValue(Number(e.target.value), minute)}
        disabled={disabled}
        className={selectClassName}
        aria-label="Sleep hours"
      >
        {Array.from({ length: 25 }, (_, idx) => idx).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span className={separatorClassName} aria-hidden>
        :
      </span>
      <select
        value={String(minute)}
        onChange={(e) => updateValue(hour, Number(e.target.value))}
        disabled={disabled || hour === 24}
        className={selectClassName}
        aria-label="Sleep minutes"
      >
        {minuteOptions.map((value) => (
          <option key={value} value={value}>
            {String(value).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}
