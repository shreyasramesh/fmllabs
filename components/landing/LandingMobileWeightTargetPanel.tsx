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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7C522D]/90 dark:text-[#D6A67E]/90">
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

  const lo = Math.min(current, target);
  const hi = Math.max(current, target);
  const pad = Math.max(0.4, (hi - lo) * 0.35);
  const min = lo - pad;
  const max = hi + pad;
  const span = max - min || 1;
  const curPct = ((current - min) / span) * 100;
  const tgtPct = ((target - min) / span) * 100;

  return (
    <div className="landing-module-glass rounded-2xl border border-neutral-200/90 px-4 py-4 dark:border-neutral-700/80">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7C522D]/90 dark:text-[#D6A67E]/90">
        Target
      </p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{direction}</p>
      <p className="mt-0.5 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
        {current.toFixed(1)} kg now · {target.toFixed(1)} kg goal
      </p>

      <div className="relative mt-4 pb-6">
        <div
          className="absolute left-0 right-0 top-[14px] h-[3px] -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-600"
          aria-hidden
        />
        <div
          className="absolute top-[14px] size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-[#B87B51] bg-[#FBF4EC] shadow-sm dark:bg-[#241a14]"
          style={{ left: `${curPct}%` }}
          title="Current"
        />
        <div
          className="absolute top-[14px] size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#16a34a] ring-2 ring-[#16a34a]/35"
          style={{ left: `${tgtPct}%` }}
          title="Goal"
        />
        <div
          className="absolute top-[30px] -translate-x-1/2 text-[10px] font-medium text-[#7C522D] dark:text-[#D6A67E]"
          style={{ left: `${curPct}%` }}
        >
          You
        </div>
        <div
          className="absolute top-[30px] -translate-x-1/2 text-[10px] font-semibold text-[#16a34a]"
          style={{ left: `${tgtPct}%` }}
        >
          Goal
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenWeight}
        className="mt-1 w-full rounded-xl border border-neutral-200 py-2 text-center text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        {openLabel}
      </button>
    </div>
  );
}
