"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { resolveUserDisplayNameForPrompt } from "@/lib/user-display-name";
import type { UserScore } from "@/lib/score-types";
import type { DashboardStats } from "@/lib/dashboard-stats";
import { HeaderStatsPill } from "@/components/HeaderStatsPill";
import { StatsOverviewModal } from "@/components/StatsOverviewModal";

function streakBlurb(days: number): string {
  if (days <= 0) return "Send a message to start a streak.";
  if (days === 1) return "One day — keep the momentum going.";
  if (days < 7) return `${days} days of showing up.`;
  if (days < 30) return `${days} days — that's commitment.`;
  return `${days} days of steady practice.`;
}

function wordsBlurb(words: number): string {
  if (words <= 0) return "Your words will appear here as you chat.";
  const essays = Math.max(1, Math.floor(words / 1500));
  if (words < 1500) return "Every word counts toward clarity.";
  return `You've written about ${essays} essay-length${essays > 1 ? "s" : ""} of reflection.`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function DashboardHome() {
  const { user, isLoaded } = useUser();
  const [score, setScore] = useState<UserScore | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [preferredName, setPreferredName] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [statsOverviewOpen, setStatsOverviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/me/score").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/dashboard-stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/settings").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([scoreRes, statsRes, settingsRes]) => {
        if (cancelled) return;
        if (scoreRes) setScore(scoreRes as UserScore);
        if (statsRes) setStats(statsRes as DashboardStats);
        if (settingsRes && typeof settingsRes.preferredName === "string") {
          setPreferredName(settingsRes.preferredName);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(() => {
    return (
      resolveUserDisplayNameForPrompt({
        preferredName: preferredName ?? undefined,
        clerkFirstName: user?.firstName ?? null,
        clerkFullName: user?.fullName ?? null,
      }) ?? "there"
    );
  }, [preferredName, user?.firstName, user?.fullName]);

  const xpToday = score?.xpChangeToday ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {isLoaded ? (
              <>
                Welcome back, {displayName}
              </>
            ) : (
              <span className="inline-block min-h-[1.5em] w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            )}
          </h1>

          {stats && score && (
            <HeaderStatsPill
              stats={stats}
              score={score}
              onPillClick={() => setStatsOverviewOpen(true)}
            />
          )}
        </header>

        {loadError && (
          <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">
            Some stats could not load. You can still open chat.
          </p>
        )}

        <div className="mt-10 text-center">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">
            You&apos;ve been reflecting. Here&apos;s your snapshot.
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            A quick look at your learning and conversations on FixMyLife Labs.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/chat/new"
              className="inline-flex items-center justify-center rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
            >
              Continue to App
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 dark:border-neutral-600 px-6 py-3 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              View Leaderboard
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <StatCard
            label="Daily streak"
            value={stats ? `${stats.streakDays} ${stats.streakDays === 1 ? "day" : "days"} 🔥` : "—"}
            description={stats ? streakBlurb(stats.streakDays) : "Loading…"}
          />
          <StatCard
            label="Total XP"
            value={score ? `${score.totalXp.toLocaleString()} · ${score.rank}` : "—"}
            description={
              score
                ? xpToday > 0
                  ? `+${xpToday} XP today. Keep going.`
                  : `Progress toward ${score.rank === "Master" ? "mastery" : "the next rank"}.`
                : "Loading…"
            }
          />
          <StatCard
            label={"Words you've shared"}
            value={stats ? `${stats.userWordCount.toLocaleString()} 🚀` : "—"}
            description={stats ? wordsBlurb(stats.userWordCount) : "Loading…"}
          />
          <StatCard
            label="Conversations"
            value={stats ? `${stats.sessionCount} ${stats.sessionCount === 1 ? "chat" : "chats"} 💬` : "—"}
            description={
              stats
                ? stats.sessionCount === 0
                  ? "Start your first conversation to see this grow."
                  : "Each thread is a space to think out loud."
                : "Loading…"
            }
          />
        </div>

        <h3 className="mt-12 text-center text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Your library
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <StatCard
            label="Saved concepts"
            value={
              stats
                ? `${stats.savedConceptsCount.toLocaleString()} ${plural(stats.savedConceptsCount, "concept", "concepts")} 📌`
                : "—"
            }
            description={
              stats
                ? stats.savedConceptsCount === 0
                  ? "Save concepts from chat or the index to build your library."
                  : "Ideas you've bookmarked from the mental model index."
                : "Loading…"
            }
          />
          <StatCard
            label="Custom concepts"
            value={
              stats
                ? `${stats.customConceptsCount.toLocaleString()} ${plural(stats.customConceptsCount, "concept", "concepts")} ✨`
                : "—"
            }
            description={
              stats
                ? stats.customConceptsCount === 0
                  ? "Create your own concepts to capture how you think."
                  : "Concepts you've written or generated for yourself."
                : "Loading…"
            }
          />
          <StatCard
            label="Frameworks"
            value={
              stats
                ? `${stats.conceptGroupsCount.toLocaleString()} ${plural(stats.conceptGroupsCount, "group", "groups")} 🧩`
                : "—"
            }
            description={
              stats
                ? stats.conceptGroupsCount === 0
                  ? "Group related concepts into frameworks as you go."
                  : "Domains and grouped concepts you've organized."
                : "Loading…"
            }
          />
          <StatCard
            label="Habits"
            value={
              stats
                ? `${stats.habitsCount.toLocaleString()} ${plural(stats.habitsCount, "habit", "habits")} 🌱`
                : "—"
            }
            description={
              stats
                ? stats.habitsCount === 0
                  ? "Turn insights into habits you can track."
                  : "Habits you're tracking in the app."
                : "Loading…"
            }
          />
          <StatCard
            label="Journal entries"
            value={
              stats
                ? `${stats.journalEntriesCount.toLocaleString()} ${plural(stats.journalEntriesCount, "entry", "entries")} 📓`
                : "—"
            }
            description={
              stats
                ? stats.journalEntriesCount === 0
                  ? "Save reflections from journal checkpoints to see them here."
                  : "Reflective entries saved in your journal."
                : "Loading…"
            }
          />
        </div>

        <footer className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <span className="mx-2">·</span>
          <Link href="/faq" className="hover:underline">
            FAQ
          </Link>
        </footer>
      </div>

      {statsOverviewOpen && stats && score && (
        <StatsOverviewModal
          stats={stats}
          score={score}
          onClose={() => setStatsOverviewOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/50 p-5 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-xl sm:text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-snug">{description}</p>
    </div>
  );
}
