"use client";

import { type UserScore } from "@/lib/score-types";
import {
  BronzeRankBadge,
  DiamondRankBadge,
  GoldRankBadge,
  IronRankBadge,
  MasterRankBadge,
  PlatinumRankBadge,
  SilverRankBadge,
} from "@/components/RankBadgeIcons";

const RANK_COLORS: Record<string, string> = {
  Iron: "text-neutral-500 dark:text-neutral-400",
  Bronze: "text-amber-700 dark:text-amber-500",
  Silver: "text-slate-400 dark:text-slate-300",
  Gold: "text-amber-500 dark:text-amber-400",
  Platinum: "text-emerald-600 dark:text-emerald-400",
  Diamond: "text-cyan-500 dark:text-cyan-400",
  Master: "text-violet-500 dark:text-violet-400",
};

/** Stacked coins / XP icon (Browser Use style) */
function XpCoinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="10" cy="8" r="5" />
      <circle cx="10" cy="12" r="5" strokeOpacity="0.5" />
    </svg>
  );
}

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
  const rankColor = RANK_COLORS[score.rank] ?? "text-neutral-600 dark:text-neutral-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-rose-100 via-amber-50 to-yellow-50 dark:from-rose-900/40 dark:via-amber-900/30 dark:to-yellow-900/30 text-sm font-medium transition-all duration-200 hover:from-rose-200 hover:via-amber-100 hover:to-yellow-100 dark:hover:from-rose-800/50 dark:hover:via-amber-800/40 dark:hover:to-yellow-800/40 ${
        showRankUpAnimation ? "animate-pulse ring-2 ring-amber-400 dark:ring-amber-500" : ""
      }`}
      aria-label={`Rank: ${score.rank}, ${displayXp} XP. Click to view details.`}
      title={`${score.rank} · ${displayXp} XP`}
    >
      {score.rank === "Iron" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <IronRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Bronze" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <BronzeRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Silver" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <SilverRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Gold" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <GoldRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Platinum" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <PlatinumRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Diamond" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <DiamondRankBadge className="w-full h-full" />
        </div>
      ) : score.rank === "Master" ? (
        <div className="w-[34px] h-[34px] shrink-0 [&_svg]:w-full [&_svg]:h-full">
          <MasterRankBadge className="w-full h-full" />
        </div>
      ) : (
        <XpCoinIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
      )}
      <span className={`shrink-0 font-semibold ${rankColor}`}>{score.rank}</span>
      <span className="text-neutral-400 dark:text-neutral-500">·</span>
      <span className="text-neutral-900 dark:text-neutral-100 tabular-nums font-medium">
        {displayXp}
      </span>
    </button>
  );
}
