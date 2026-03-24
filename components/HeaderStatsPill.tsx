"use client";

import type { UserScore } from "@/lib/score-types";
import type { DashboardStats } from "@/lib/dashboard-stats";

function formatWordsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

type HeaderStatsPillProps = {
  stats: DashboardStats;
  score: UserScore;
  optimisticDelta?: number;
  /** Opens full stats overview (e.g. modal). When set, the whole pill is one control. */
  onPillClick?: () => void;
  /** Legacy: only XP segment opens rank modal. Ignored when `onPillClick` is set. */
  onXpClick?: () => void;
  showRankUpAnimation?: boolean;
  compact?: boolean;
};

/**
 * Horizontal pill: streak | words | XP (matches dashboard quick-stats layout).
 */
export function HeaderStatsPill({
  stats,
  score,
  optimisticDelta = 0,
  onPillClick,
  onXpClick,
  showRankUpAnimation = false,
  compact = false,
}: HeaderStatsPillProps) {
  const displayXp = score.totalXp + optimisticDelta;

  const xpInner = (
    <>
      <span aria-hidden>🏅</span>
      <span className="font-medium text-foreground">
        {displayXp.toLocaleString()} XP
      </span>
    </>
  );

  const pad = compact ? "px-2 py-1.5 sm:px-3 sm:py-2" : "gap-1.5 px-3 py-2 sm:px-4";
  const padTight = compact ? "px-2 py-1.5 sm:px-3 sm:py-2" : "gap-1.5 px-3 py-2 sm:px-4";

  const pillClass = `flex shrink-0 items-stretch rounded-full border border-neutral-200/80 bg-neutral-100/80 dark:border-white/12 dark:bg-neutral-800/80 tabular-nums ${
    compact ? "text-[11px] sm:text-sm" : "text-sm"
  }`;

  const streakBlock = (
    <div className={`flex items-center gap-1 ${pad}`}>
      <span aria-hidden>🔥</span>
      <span className="font-medium text-foreground">
        {stats.streakDays} {stats.streakDays === 1 ? "day" : "days"}
      </span>
    </div>
  );

  const wordsBlock = (
    <div className={`flex items-center gap-1 ${padTight}`}>
      <span aria-hidden>🚀</span>
      <span className="font-medium text-foreground">{formatWordsShort(stats.userWordCount)} words</span>
    </div>
  );

  const xpBlock =
    onPillClick || !onXpClick ? (
      <div className={`flex items-center gap-1 ${padTight} rounded-r-full`}>{xpInner}</div>
    ) : (
      <button
        type="button"
        onClick={onXpClick}
        className={`flex items-center gap-1 ${padTight} rounded-r-full text-left transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 ${
          showRankUpAnimation ? "animate-pulse ring-2 ring-amber-400 dark:ring-amber-500" : ""
        }`}
        aria-label={`${displayXp} XP. ${score.rank}. Click to view details.`}
        title={`${score.rank} · ${displayXp} XP`}
      >
        {xpInner}
      </button>
    );

  if (onPillClick) {
    return (
      <button
        type="button"
        onClick={onPillClick}
        className={`${pillClass} cursor-pointer text-left transition-colors hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50 ${
          showRankUpAnimation ? "ring-2 ring-amber-400/40 dark:ring-amber-500/40" : ""
        }`}
        aria-label={`${stats.streakDays} day streak, ${formatWordsShort(stats.userWordCount)} words, ${displayXp} XP. Click for all stats.`}
        title="View all stats"
      >
        {streakBlock}
        <div className="w-px shrink-0 bg-neutral-200 dark:bg-neutral-600 self-stretch my-2" aria-hidden />
        {wordsBlock}
        <div className="w-px shrink-0 bg-neutral-200 dark:bg-neutral-600 self-stretch my-2" aria-hidden />
        {xpBlock}
      </button>
    );
  }

  return (
    <div className={pillClass} aria-label="Quick stats">
      {streakBlock}
      <div className="w-px shrink-0 bg-neutral-200 dark:bg-neutral-600 self-stretch my-2" aria-hidden />
      {wordsBlock}
      <div className="w-px shrink-0 bg-neutral-200 dark:bg-neutral-600 self-stretch my-2" aria-hidden />
      {xpBlock}
    </div>
  );
}
