"use client";

import React from "react";

interface ScoreRingProps {
  score: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  /** Arc color override; defaults to adaptive green/amber/red based on score. */
  color?: string;
  /** Track (background arc) color override. */
  trackColor?: string;
}

/** 0–100 day score: uniform color shifts smoothly (red → green); every point changes hue. */
function defaultColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const hue = 142 * t;
  return `hsl(${hue} 70% 46%)`;
}

export function ScoreRing({
  score,
  label,
  size = 140,
  strokeWidth = 10,
  color,
  trackColor,
}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const arcColor = color ?? defaultColor(clamped);
  const track = trackColor ?? `${arcColor}18`;

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="score-ring-svg"
      >
        {/* track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={strokeWidth}
        />
        {/* arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring-arc"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            filter: `drop-shadow(0 0 6px ${arcColor}50)`,
          }}
        />
      </svg>

      {/* center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold tabular-nums leading-none"
          style={{ color: arcColor }}
        >
          {clamped}
        </span>
        {label && (
          <span className="mt-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
