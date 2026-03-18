"use client";

import { useState } from "react";
import { type UserScore } from "@/lib/score-types";
import { RANK_TIERS } from "@/lib/score-types";
import {
  BronzeRankBadge,
  DiamondRankBadge,
  GoldRankBadge,
  IronRankBadge,
  MasterRankBadge,
  PlatinumRankBadge,
  SilverRankBadge,
} from "@/components/RankBadgeIcons";

/** LoL-style rank badge: gradient, metallic feel, subtle shine */
const RANK_BADGE_STYLES: Record<string, string> = {
  Iron:
    "bg-gradient-to-br from-neutral-400 via-neutral-500 to-neutral-600 dark:from-neutral-600 dark:via-neutral-700 dark:to-neutral-800 text-white shadow-lg shadow-neutral-500/30 dark:shadow-neutral-900/50 border-2 border-neutral-300/50 dark:border-neutral-500/30",
  Bronze:
    "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 dark:from-amber-700 dark:via-amber-800 dark:to-amber-900 text-amber-50 shadow-lg shadow-amber-600/30 dark:shadow-amber-900/50 border-2 border-amber-400/40 dark:border-amber-500/30",
  Silver:
    "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 dark:from-slate-500 dark:via-slate-600 dark:to-slate-700 text-white shadow-lg shadow-slate-400/40 dark:shadow-slate-800/50 border-2 border-slate-200/60 dark:border-slate-400/40",
  Gold:
    "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 dark:from-amber-500 dark:via-amber-600 dark:to-amber-700 text-amber-950 shadow-lg shadow-amber-500/40 dark:shadow-amber-800/50 border-2 border-amber-300/50 dark:border-amber-400/40",
  Platinum:
    "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 dark:from-emerald-500 dark:via-emerald-600 dark:to-emerald-700 text-white shadow-lg shadow-emerald-500/40 dark:shadow-emerald-800/50 border-2 border-emerald-300/50 dark:border-emerald-400/40",
  Diamond:
    "bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-500 dark:from-cyan-500 dark:via-cyan-600 dark:to-cyan-700 text-white shadow-lg shadow-cyan-400/40 dark:shadow-cyan-800/50 border-2 border-cyan-200/60 dark:border-cyan-400/40",
  Master:
    "bg-gradient-to-br from-violet-400 via-violet-500 to-violet-600 dark:from-violet-500 dark:via-violet-600 dark:to-violet-700 text-white shadow-lg shadow-violet-500/40 dark:shadow-violet-800/50 border-2 border-violet-300/50 dark:border-violet-400/40",
};

/** Progress bar fill gradient (current rank → next rank) */
const PROGRESS_GRADIENTS: Record<string, string> = {
  Iron: "from-neutral-500 to-amber-600",
  Bronze: "from-amber-600 to-slate-400",
  Silver: "from-slate-400 to-amber-500",
  Gold: "from-amber-500 to-emerald-500",
  Platinum: "from-emerald-500 to-cyan-400",
  Diamond: "from-cyan-400 to-violet-500",
  Master: "from-violet-500 to-violet-600",
};

const XP_BREAKDOWN = [
  { action: "Conversation", xp: 10, icon: "💬" },
  { action: "New concept", xp: 20, icon: "💡" },
  { action: "Mental model saved (Concept Gems / favorited)", xp: 20, icon: "⭐" },
  { action: "YouTube transcript concept", xp: "20 per concept", icon: "📺" },
  { action: "New persona followed", xp: 5, icon: "👤" },
  { action: "New habit promoted", xp: 10, icon: "🔄" },
  { action: "New group created", xp: 5, icon: "📁" },
  { action: "Perspective card used in conversation", xp: 25, icon: "🃏" },
  { action: "Mental model used in chat", xp: "5 per model per conversation", icon: "💭" },
  { action: "User-created mental model", xp: 25, icon: "🧠" },
  { action: "Saved perspective card", xp: 10, icon: "📌" },
] as const;

type RankModalProps = {
  score: UserScore;
  onClose: () => void;
};

export function RankModal({ score, onClose }: RankModalProps) {
  const [xpBreakdownOpen, setXpBreakdownOpen] = useState(false);
  const isMaster = score.rank === "Master";
  const nextTier = RANK_TIERS[score.rankIndex + 1];
  const badgeStyle = RANK_BADGE_STYLES[score.rank] ?? RANK_BADGE_STYLES.Iron;
  const progressGradient = PROGRESS_GRADIENTS[score.rank] ?? "from-neutral-500 to-neutral-600";
  const progressPct =
    nextTier && !isMaster
      ? Math.min(
          100,
          (score.xpInCurrentTier / (nextTier.minXp - RANK_TIERS[score.rankIndex].minXp)) * 100
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      aria-modal
      role="dialog"
    >
      <div
        className="bg-background rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Your Learning Rank</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Rank badge - SVG for all ranks */}
          <div className="flex flex-col items-center gap-3">
            {score.rank === "Iron" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <IronRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Bronze" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <BronzeRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Silver" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <SilverRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Gold" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <GoldRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Platinum" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <PlatinumRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Diamond" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <DiamondRankBadge className="w-full h-full object-contain" />
              </div>
            ) : score.rank === "Master" ? (
              <div className="w-96 h-96 shrink-0 [&_svg]:w-full [&_svg]:h-full">
                <MasterRankBadge className="w-full h-full object-contain" />
              </div>
            ) : (
              <div
                className={`relative inline-flex items-center justify-center min-w-[140px] px-10 py-5 rounded-2xl font-bold text-2xl tracking-wide uppercase ${badgeStyle}`}
              >
                <span className="drop-shadow-sm">{score.rank}</span>
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                {score.totalXp}
              </span>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">XP</span>
            </div>
          </div>

          {/* Progress to next tier */}
          {!isMaster && nextTier && (
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900 p-4 border border-neutral-200/80 dark:border-neutral-700/80">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                {score.xpToNextTier} XP to <span className="text-amber-600 dark:text-amber-400">{nextTier.name}</span>
              </p>
              <div className="h-3 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${progressGradient} transition-all duration-700 ease-out`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
          {isMaster && (
            <div className="rounded-xl bg-violet-50 dark:bg-neutral-800 p-4 border border-violet-200/60 dark:border-violet-800/40 text-center">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Top tier! You&apos;ve mastered the learning journey.
              </p>
            </div>
          )}

          {/* XP breakdown with icons - collapsed by default */}
          <div>
            <button
              type="button"
              onClick={() => setXpBreakdownOpen((o) => !o)}
              className="flex items-center justify-between w-full text-left text-sm font-semibold text-neutral-900 dark:text-neutral-100 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              How we calculate XP
              <span className="text-neutral-500 dark:text-neutral-400" aria-hidden>
                {xpBreakdownOpen ? "▼" : "▶"}
              </span>
            </button>
            {xpBreakdownOpen && (
            <div className="mt-2 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800">
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      Action
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-700 dark:text-neutral-300 w-28">
                      XP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {XP_BREAKDOWN.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-neutral-200 dark:border-neutral-700 ${
                        i % 2 === 1 ? "bg-neutral-50/50 dark:bg-neutral-800/60" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base shrink-0" aria-hidden>
                            {row.icon}
                          </span>
                          {row.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {typeof row.xp === "number" ? row.xp : row.xp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
