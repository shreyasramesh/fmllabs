"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type LeaderboardEntry = { rank: number; displayName: string; imageUrl?: string; xp: number };

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl" aria-label="1st place">🥇</span>;
  if (rank === 2) return <span className="text-2xl" aria-label="2nd place">🥈</span>;
  if (rank === 3) return <span className="text-2xl" aria-label="3rd place">🥉</span>;
  return (
    <span className="font-semibold text-emerald-500 dark:text-emerald-400 tabular-nums">
      {rank}
    </span>
  );
}

function LeaderboardTable({
  entries,
  emptyMessage,
}: {
  entries: LeaderboardEntry[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {emptyMessage}
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 dark:border-neutral-700">
          <th className="text-left py-2 px-3 font-semibold text-neutral-600 dark:text-neutral-400 w-12">
            Rank
          </th>
          <th className="text-left py-2 px-3 font-semibold text-neutral-600 dark:text-neutral-400">
            Learner
          </th>
          <th className="text-right py-2 px-3 font-semibold text-neutral-600 dark:text-neutral-400 w-20">
            XP
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.rank}
            className="border-b border-neutral-100 dark:border-neutral-800/80 last:border-0"
          >
            <td className="py-2 px-3">
              <RankCell rank={e.rank} />
            </td>
            <td className="py-2 px-3">
              <div className="flex items-center gap-2">
                {e.imageUrl ? (
                  <Image
                    src={e.imageUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 dark:text-neutral-400 text-xs font-medium">
                    {e.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-foreground truncate text-sm">
                  {e.displayName}
                </span>
              </div>
            </td>
            <td className="py-2 px-3 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums text-sm">
              {e.xp.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LeaderboardEmbed() {
  const [data, setData] = useState<{
    monthly: LeaderboardEntry[];
    allTime: LeaderboardEntry[];
    currentMonth: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <div className="w-full max-w-2xl mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
      <h2 className="text-lg font-bold text-foreground mb-1">
        Can you reach <span className="text-amber-500 dark:text-amber-400">Master</span>?
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Earn XP from conversations, concepts, and perspective cards. Sign in to climb the leaderboard.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{data.currentMonth}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          </div>
          <div className="p-2">
            <LeaderboardTable
              entries={data.monthly}
              emptyMessage="No learners yet this month."
            />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
            <span className="font-semibold text-foreground text-sm">All-time</span>
          </div>
          <div className="p-2">
            <LeaderboardTable
              entries={data.allTime}
              emptyMessage="No learners yet."
            />
          </div>
        </div>
      </div>
      <Link
        href="/leaderboard"
        className="mt-3 inline-block text-sm text-amber-600 dark:text-amber-400 hover:underline"
      >
        View full leaderboard →
      </Link>
    </div>
  );
}
