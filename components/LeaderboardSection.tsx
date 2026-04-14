import Image from "next/image";
import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/product-tagline";
import { getLeaderboard } from "@/lib/score";

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
  entries: { rank: number; displayName: string; imageUrl?: string; xp: number }[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {emptyMessage}
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#e8e6dc] dark:border-[#3d3d3a]">
          <th className="text-left py-3 px-3 font-semibold text-neutral-600 dark:text-neutral-400 w-14">
            Rank
          </th>
          <th className="text-left py-3 px-3 font-semibold text-neutral-600 dark:text-neutral-400">
            Learner
          </th>
          <th className="text-right py-3 px-3 font-semibold text-neutral-600 dark:text-neutral-400 w-24">
            XP
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.rank}
            className="border-b border-[#e8e6dc] last:border-0 dark:border-[#3d3d3a]"
          >
            <td className="py-3 px-3">
              <RankCell rank={e.rank} />
            </td>
            <td className="py-3 px-3">
              <div className="flex items-center gap-3">
                {e.imageUrl ? (
                  <Image
                    src={e.imageUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a] shrink-0 flex items-center justify-center text-[#87867f] dark:text-[#5e5d59] text-xs font-medium">
                    {e.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-foreground truncate">
                  {e.displayName}
                </span>
              </div>
            </td>
            <td className="py-3 px-3 text-right font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              {e.xp.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export async function LeaderboardSection({
  showBackLink = false,
  compact = false,
  showFooterLinks = false,
}: {
  showBackLink?: boolean;
  compact?: boolean;
  showFooterLinks?: boolean;
}) {
  const { monthly, allTime, currentMonth } = await getLeaderboard();

  return (
    <div className={compact ? "" : "max-w-5xl mx-auto px-4 py-8 md:py-12"}>
      {showBackLink && (
        <Link
          href="/"
          className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors mb-8 inline-block"
        >
          ← Back to {PRODUCT_NAME}
        </Link>
      )}
      <div className={compact ? "mb-6" : "mb-8"}>
        <h2 className={compact ? "text-xl md:text-2xl font-bold mb-1" : "text-2xl md:text-4xl font-bold mb-2"}>
          Can you reach <span className="text-amber-500 dark:text-amber-400">Master</span>?
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-base max-w-2xl">
          {PRODUCT_TAGLINE}
        </p>
        <p className="text-neutral-600 dark:text-neutral-400 text-base max-w-2xl mt-2">
          Journal, build concepts, use mental models, and learn with perspective cards to earn XP and climb
          the leaderboard.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[#e8e6dc] dark:border-[#3d3d3a] bg-neutral-50/50 dark:bg-neutral-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8e6dc] dark:border-[#3d3d3a] flex items-center gap-2">
            <span className="font-semibold text-foreground">{currentMonth}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          </div>
          <div className="p-2">
            <LeaderboardTable
              entries={monthly}
              emptyMessage="No learners yet this month."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8e6dc] dark:border-[#3d3d3a] bg-neutral-50/50 dark:bg-neutral-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8e6dc] dark:border-[#3d3d3a]">
            <span className="font-semibold text-foreground">All-time</span>
          </div>
          <div className="p-2">
            <LeaderboardTable
              entries={allTime}
              emptyMessage="No learners yet."
            />
          </div>
        </div>
      </div>

      {!compact && (
        <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
          Opt in to the leaderboard in Settings to appear here. XP is earned from conversations,
          concepts, mental models, perspective cards, and more.
        </p>
      )}

      {showFooterLinks && (
        <div className="mt-12 pt-8 border-t border-[#e8e6dc] dark:border-[#3d3d3a] flex flex-wrap gap-4">
          <Link href="/" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            ← Back to {PRODUCT_NAME}
          </Link>
          <Link href="/faq" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            FAQ
          </Link>
          <Link href="/about" className="text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors">
            About the Creator
          </Link>
        </div>
      )}
    </div>
  );
}
