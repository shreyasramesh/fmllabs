"use client";

import React from "react";

interface LandingMobileSleepGoalPanelProps {
  loggedHours: number | null;
  sleepHoursGoal: number;
  selectedDayLabel: string;
}

function fmtHours(h: number): string {
  if (Math.abs(h - Math.round(h)) < 1e-6) return String(Math.round(h));
  return h.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** Sleep-specific goal UI: circular night ring vs generic macro-style goal rows. */
export function LandingMobileSleepGoalPanel({
  loggedHours,
  sleepHoursGoal,
  selectedDayLabel,
}: LandingMobileSleepGoalPanelProps) {
  const goal = sleepHoursGoal > 0 ? sleepHoursGoal : 8;
  const hasLog = loggedHours != null && loggedHours > 0;
  const current = hasLog ? loggedHours! : 0;
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const remainder = Math.max(0, goal - current);

  const r = 46;
  const stroke = 6;
  const c = 2 * Math.PI * r;
  const dash = ratio * c;

  return (
    <div className="landing-module-glass rounded-2xl border border-indigo-200/60 bg-gradient-to-b from-indigo-50/40 to-transparent px-4 py-4 dark:border-indigo-900/50 dark:from-indigo-950/35 dark:to-transparent">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700/85 dark:text-indigo-300/90">
        Nightly goal
      </p>
      <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">{selectedDayLabel}</p>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: (r + stroke) * 2, height: (r + stroke) * 2 }}>
          <svg
            width={(r + stroke) * 2}
            height={(r + stroke) * 2}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={r + stroke}
              cy={r + stroke}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-indigo-200/90 dark:text-indigo-950/80"
            />
            <circle
              cx={r + stroke}
              cy={r + stroke}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              className="text-indigo-500 transition-[stroke-dasharray] duration-500 dark:text-indigo-400"
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {hasLog ? (
              <>
                <span className="text-[22px] font-bold tabular-nums leading-none text-indigo-950 dark:text-indigo-100">
                  {fmtHours(current)}
                </span>
                <span className="text-[10px] font-medium text-indigo-600/90 dark:text-indigo-300/80">
                  hours
                </span>
              </>
            ) : (
              <span className="px-1 text-[11px] font-medium leading-tight text-indigo-700/80 dark:text-indigo-200/75">
                No log
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] text-neutral-700 dark:text-neutral-200">
            Goal: <span className="font-semibold tabular-nums">{fmtHours(goal)} h</span> sleep
          </p>
          {hasLog ? (
            <>
              {current >= goal - 1e-6 ? (
                <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                  You hit your nightly target.
                </p>
              ) : (
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium tabular-nums text-foreground">{fmtHours(remainder)} h</span> under
                  goal — rest helps recovery.
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              Log tonight&apos;s duration below to fill the ring.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
