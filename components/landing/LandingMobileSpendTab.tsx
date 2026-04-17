"use client";

import React from "react";

import type { LandingSpendDaySummary } from "@/components/landing/types";
import { LandingMobileGoalsCard } from "@/components/landing/LandingMobileGoalsCard";

interface LandingMobileSpendTabProps {
  spendDaySummary: LandingSpendDaySummary;
  selectedDayLabel: string;
  onOpenSpend: () => void;
  spendBudgetUsd: number | null;
  onOpenGoals: () => void;
}

export function LandingMobileSpendTab({
  spendDaySummary,
  selectedDayLabel,
  onOpenSpend,
  spendBudgetUsd,
  onOpenGoals,
}: LandingMobileSpendTabProps) {
  const empty =
    Object.keys(spendDaySummary.totalsByCurrency).length === 0 &&
    spendDaySummary.recentEntries.length === 0;

  const spentUsd = spendDaySummary.totalsByCurrency.USD ?? 0;
  const spendGoalRows =
    spendBudgetUsd != null && spendBudgetUsd > 0
      ? [
          {
            key: "usd",
            label: "Spend (USD)",
            icon: "\u0024",
            current: spentUsd,
            target: spendBudgetUsd,
            unit: "",
            mode: "spendCap" as const,
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <LandingMobileGoalsCard
        rows={spendGoalRows}
        emptyHint="Set an optional daily USD budget under Daily goals (or open Goals below) to track spend against it."
        onViewDetails={onOpenGoals}
        detailsLabel="Open goals"
      />

      <div className="landing-module-glass rounded-2xl border px-4 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-foreground">Spend</p>
            <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
              Totals for {selectedDayLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSpend}
            className="shrink-0 rounded-xl border border-[#c96442]/60 bg-[#f5f4ed] px-3 py-2 text-[12px] font-semibold text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
          >
            Log purchase
          </button>
        </div>

        {empty ? (
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
            No purchases for {selectedDayLabel}.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(spendDaySummary.totalsByCurrency).map(([code, total]) => (
                <span
                  key={code}
                  className="inline-flex rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-foreground dark:border-neutral-600 dark:bg-neutral-900/50"
                >
                  {total.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {code}
                </span>
              ))}
            </div>
            {spendDaySummary.recentEntries.length > 0 ? (
              <ul className="space-y-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-700/80">
                {spendDaySummary.recentEntries.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    className="flex justify-between gap-2 text-[13px] text-neutral-700 dark:text-neutral-300"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">{e.label}</span>
                    <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {e.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {e.currency}
                      {e.time ? ` · ${e.time}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
