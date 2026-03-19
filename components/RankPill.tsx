"use client";

import { type UserScore } from "@/lib/score-types";

type RankPillProps = {
  score: UserScore | null;
  optimisticDelta?: number;
  onClick?: () => void;
  showRankUpAnimation?: boolean;
};

export function RankPill({
  score,
  optimisticDelta = 0,
  onClick,
  showRankUpAnimation = false,
}: RankPillProps) {
  if (!score) return null;

  const displayXp = score.totalXp + optimisticDelta;
  const changeToday = (score.xpChangeToday ?? 0) + optimisticDelta;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-end px-2 py-1 rounded-lg text-xs tabular-nums font-medium transition-colors duration-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
        showRankUpAnimation ? "animate-pulse ring-2 ring-amber-400 dark:ring-amber-500" : ""
      }`}
      aria-label={`${displayXp} XP. Click to view details.`}
      title={`${score.rank} · ${displayXp} XP`}
    >
      <span className="text-neutral-700 dark:text-neutral-300 leading-tight">
        {displayXp.toLocaleString()} <span className="text-neutral-500 dark:text-neutral-400 font-normal">XP</span>
      </span>
      <span className={`text-[10px] leading-tight ${changeToday > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 dark:text-neutral-400"}`}>
        {changeToday > 0 ? `+${changeToday}` : "0"} today
      </span>
    </button>
  );
}
