"use client";

import React from "react";

function fmtGoalNum(n: number): string {
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-6) return r.toLocaleString();
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export type LandingMobileGoalRowMode = "default" | "higherBetter" | "matchTarget" | "sleep" | "spendCap";

export interface LandingMobileGoalRow {
  key: string;
  label: string;
  icon?: string;
  current: number;
  target: number;
  unit: string;
  mode?: LandingMobileGoalRowMode;
}

function pctDefault(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
}

function weightProgressPct(current: number, target: number): number {
  if (current <= 0 || target <= 0) return 0;
  if (target < current) return Math.min(100, Math.round((target / current) * 100));
  return Math.min(100, Math.round((current / target) * 100));
}

function barWidthPct(row: LandingMobileGoalRow): number {
  const mode = row.mode ?? "default";
  if (mode === "matchTarget") return weightProgressPct(row.current, row.target);
  if (mode === "sleep") {
    if (row.target <= 0) return 0;
    return Math.min(100, (row.current / row.target) * 100);
  }
  if (mode === "higherBetter") {
    if (row.target <= 0) return 0;
    return Math.min(100, (row.current / row.target) * 100);
  }
  if (mode === "spendCap") {
    if (row.target <= 0) return 0;
    return Math.min(100, (row.current / row.target) * 100);
  }
  return pctDefault(row.current, row.target);
}

/**
 * Uniform fill color: % of goal used (0 → 1) maps green (142°) → red (0°). Every ratio tick shifts hue.
 */
function solidConsumptionUsed(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const hue = 142 * (1 - t);
  return `hsl(${hue} 70% 46%)`;
}

/** Progress toward goal (0 → 1): red → green. */
function solidProgressTowardGoal(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const hue = 142 * t;
  return `hsl(${hue} 70% 46%)`;
}

function solidOverBudget(): string {
  return "hsl(0 72% 38%)";
}

function barFillStyle(row: LandingMobileGoalRow): React.CSSProperties {
  const mode = row.mode ?? "default";
  const width = barWidthPct(row);
  const transition = "width 500ms ease-out, background-color 80ms linear";

  if (mode === "matchTarget") {
    const pct = weightProgressPct(row.current, row.target) / 100;
    const hue = 142 * Math.max(0, Math.min(1, pct));
    return {
      width: `${width}%`,
      backgroundColor: `hsl(${hue} 65% 46%)`,
      transition,
    };
  }

  if (mode === "sleep") {
    if (row.target <= 0) {
      return { width: `${width}%`, backgroundColor: "#a3a3a3", transition };
    }
    const ratio = row.current / row.target;
    return {
      width: `${width}%`,
      backgroundColor: solidProgressTowardGoal(ratio),
      transition,
    };
  }

  if (mode === "higherBetter") {
    if (row.target <= 0) {
      return { width: `${width}%`, backgroundColor: "#a3a3a3", transition };
    }
    const ratio = row.current / row.target;
    return {
      width: `${width}%`,
      backgroundColor: solidProgressTowardGoal(ratio),
      transition,
    };
  }

  if (mode === "spendCap") {
    if (row.target <= 0) {
      return { width: `${width}%`, backgroundColor: "#a3a3a3", transition };
    }
    const ratio = row.current / row.target;
    if (ratio > 1.08) {
      return { width: `${width}%`, backgroundColor: solidOverBudget(), transition };
    }
    return {
      width: `${width}%`,
      backgroundColor: solidConsumptionUsed(Math.min(1, ratio)),
      transition,
    };
  }

  // default: calories / macros
  if (row.target <= 0) {
    return { width: `${width}%`, backgroundColor: "#a3a3a3", transition };
  }
  const ratio = row.current / row.target;
  if (ratio > 1.05) {
    return { width: `${width}%`, backgroundColor: solidOverBudget(), transition };
  }
  return {
    width: `${width}%`,
    backgroundColor: solidConsumptionUsed(ratio),
    transition,
  };
}

interface LandingMobileGoalsCardProps {
  rows: LandingMobileGoalRow[];
  onViewDetails?: () => void;
  detailsLabel?: string;
  /** Shown above rows (e.g. spend budget unset). */
  emptyHint?: string;
}

export function LandingMobileGoalsCard({
  rows,
  onViewDetails,
  detailsLabel = "View details",
  emptyHint,
}: LandingMobileGoalsCardProps) {
  return (
    <div className="landing-module-glass rounded-2xl border px-4 py-4">
      <p className="mb-3 text-[15px] font-bold text-foreground">Goals</p>
      {emptyHint && rows.length === 0 ? (
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{emptyHint}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const fillStyle = barFillStyle(row);
            const showBar = row.target > 0;
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
                    {row.icon ? <span>{row.icon}</span> : null}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                    {fmtGoalNum(row.current)}
                    {" / "}
                    {fmtGoalNum(row.target)}
                    {row.unit}
                  </span>
                </div>
                {showBar ? (
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700/50">
                    <div className="h-full max-w-full rounded-full ease-out" style={fillStyle} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {onViewDetails ? (
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-3 w-full rounded-xl border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          {detailsLabel}
        </button>
      ) : null}
    </div>
  );
}
