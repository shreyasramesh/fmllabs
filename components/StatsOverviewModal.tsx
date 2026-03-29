"use client";

import type { UserScore } from "@/lib/score-types";
import type { DashboardStats } from "@/lib/dashboard-stats";

function formatWordsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

type StatsOverviewModalProps = {
  stats: DashboardStats;
  score: UserScore;
  optimisticDelta?: number;
  onClose: () => void;
  /** When set, shows a button to open the full rank / XP breakdown modal (chat). */
  onViewRankDetails?: () => void;
};

export function StatsOverviewModal({
  stats,
  score,
  optimisticDelta = 0,
  onClose,
  onViewRankDetails,
}: StatsOverviewModalProps) {
  const displayXp = score.totalXp + optimisticDelta;
  const xpToday = (score.xpChangeToday ?? 0) + optimisticDelta;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      aria-modal
      role="dialog"
      aria-labelledby="stats-overview-title"
    >
      <div
        className="bg-background rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between shrink-0">
          <h2 id="stats-overview-title" className="font-semibold text-lg">
            Your stats
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-8 min-h-0">
          <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              Activity
            </h3>
            <ul className="space-y-2.5 text-sm">
              <StatRow label="Daily streak" value={`${stats.streakDays} ${stats.streakDays === 1 ? "day" : "days"}`} emoji="🔥" />
              <StatRow label="Words in chat" value={`${formatWordsShort(stats.userWordCount)} words`} emoji="🚀" />
              <StatRow label="Conversations" value={`${stats.sessionCount}`} emoji="💬" />
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              Learning & XP
            </h3>
            <ul className="space-y-2.5 text-sm">
              <StatRow label="Total XP" value={displayXp.toLocaleString()} emoji="🏅" />
              <StatRow label="Rank" value={score.rank} emoji="⭐" />
              <StatRow
                label="XP today"
                value={xpToday > 0 ? `+${xpToday.toLocaleString()}` : "0"}
                emoji="✨"
              />
            </ul>
            {onViewRankDetails && (
              <button
                type="button"
                onClick={() => {
                  onViewRankDetails();
                }}
                className="mt-4 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              >
                Learning rank &amp; XP breakdown
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              Library
            </h3>
            <ul className="space-y-2.5 text-sm">
              <StatRow label="Saved concepts" value={stats.savedConceptsCount.toLocaleString()} emoji="📌" />
              <StatRow label="Custom concepts" value={stats.customConceptsCount.toLocaleString()} emoji="✨" />
              <StatRow label="Frameworks" value={stats.conceptGroupsCount.toLocaleString()} emoji="🧩" />
              <StatRow label="Habits" value={stats.habitsCount.toLocaleString()} emoji="🌱" />
              <StatRow label="Journal entries" value={stats.journalEntriesCount.toLocaleString()} emoji="📓" />
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800/80 last:border-0">
      <span className="text-neutral-600 dark:text-neutral-400 flex items-center gap-2 min-w-0">
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </span>
      <span className="font-semibold text-foreground tabular-nums shrink-0">{value}</span>
    </li>
  );
}
