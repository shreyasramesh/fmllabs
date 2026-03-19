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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center px-1.5 py-1.5 rounded-full text-xs tabular-nums text-neutral-500 dark:text-neutral-400 font-medium transition-colors duration-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
        showRankUpAnimation ? "animate-pulse ring-2 ring-amber-400 dark:ring-amber-500" : ""
      }`}
      aria-label={`Rank: ${score.rank}, ${displayXp} XP. Click to view details.`}
      title={`${score.rank} · ${displayXp} XP`}
    >
      <span className="flex items-center">
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
        <XpCoinIcon className="w-4 h-4 shrink-0" />
      )}
      </span>
    </button>
  );
}
