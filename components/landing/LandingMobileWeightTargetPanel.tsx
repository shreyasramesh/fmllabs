"use client";

import React from "react";

interface LandingMobileWeightTargetPanelProps {
  weightCurrentKg: number | null;
  weightTargetKg: number | null;
  emptyHint: string;
  openLabel: string;
  onOpenWeight: () => void;
}

/** Weight-specific goal UI: distance + number line (current vs target), not intake-style bars. */
export function LandingMobileWeightTargetPanel({
  weightCurrentKg,
  weightTargetKg,
  emptyHint,
  openLabel,
  onOpenWeight,
}: LandingMobileWeightTargetPanelProps) {
  const hasBoth = weightCurrentKg != null && weightTargetKg != null;

  if (!hasBoth) {
    return (
      <div className="landing-module-glass rounded-2xl border border-neutral-200/90 px-4 py-4 dark:border-neutral-700/80">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4d4c48]/90 dark:text-[#d97757]/90">
          Target
        </p>
        <p className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-400">{emptyHint}</p>
        <button
          type="button"
          onClick={onOpenWeight}
          className="mt-3 w-full rounded-xl border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          {openLabel}
        </button>
      </div>
    );
  }

  const current = weightCurrentKg!;
  const target = weightTargetKg!;
  const delta = current - target;
  const absKg = Math.abs(delta).toFixed(1);
  const direction =
    Math.abs(delta) < 0.05
      ? "At your target weight"
      : delta > 0
        ? `${absKg} kg above target`
        : `${absKg} kg below target`;
  const nextStep =
    Math.abs(delta) < 0.05
      ? "You are right on target."
      : delta > 0
        ? `You need to lose ${absKg} kg to reach your goal.`
        : `You need to gain ${absKg} kg to reach your goal.`;

  return (
    <div className="landing-module-glass rounded-2xl border border-neutral-200/90 px-4 py-4 dark:border-neutral-700/80">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4d4c48]/90 dark:text-[#d97757]/90">
        Target
      </p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{direction}</p>
      <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
        {nextStep}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200/90 bg-white/75 px-3 py-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/40">
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Current</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{current.toFixed(1)} kg</p>
        </div>
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Goal</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{target.toFixed(1)} kg</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenWeight}
        className="mt-4 w-full rounded-xl border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        {openLabel}
      </button>
    </div>
  );
}
