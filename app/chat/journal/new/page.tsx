"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/components/LanguageProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getLandingTranslations } from "@/lib/landing-translations";

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function truncatePreview(text: string | undefined, max = 120): string {
  if (!text?.trim()) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trimEnd()}...`;
}

type JournalTypeLabel = "Regular" | "Nutrition" | "Exercise";

function getJournalTypeLabel(category?: "nutrition" | "exercise"): JournalTypeLabel {
  if (category === "nutrition") return "Nutrition";
  if (category === "exercise") return "Exercise";
  return "Regular";
}

type JournalListItem = {
  id: string;
  dayKey: string;
  timestamp: number;
  title: string;
  preview: string;
  typeLabel: JournalTypeLabel;
  dateText: string;
};

function toJournalItem(row: {
  _id: string;
  sourceType?: "youtube" | "journal";
  journalCategory?: "nutrition" | "exercise";
  journalEntryDay?: number;
  journalEntryMonth?: number;
  journalEntryYear?: number;
  journalEntryHour?: number;
  journalEntryMinute?: number;
  videoTitle?: string;
  transcriptText?: string;
  createdAt?: string;
}): JournalListItem | null {
  if (row.sourceType !== "journal") return null;
  let date: Date | null = null;
  if (
    typeof row.journalEntryYear === "number" &&
    typeof row.journalEntryMonth === "number" &&
    typeof row.journalEntryDay === "number"
  ) {
    const hour = typeof row.journalEntryHour === "number" ? row.journalEntryHour : 0;
    const minute = typeof row.journalEntryMinute === "number" ? row.journalEntryMinute : 0;
    date = new Date(row.journalEntryYear, row.journalEntryMonth - 1, row.journalEntryDay, hour, minute, 0, 0);
  } else if (row.createdAt) {
    date = new Date(row.createdAt);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  const title = (row.videoTitle || "Journal entry").trim() || "Journal entry";
  const preview = truncatePreview(row.transcriptText, 120);
  return {
    id: row._id,
    dayKey: toDayKey(date),
    timestamp: date.getTime(),
    title,
    preview,
    typeLabel: getJournalTypeLabel(row.journalCategory),
    dateText: `${date.toLocaleDateString(undefined, { dateStyle: "medium" })} · ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  };
}

export default function JournalNewPage() {
  const { userId, isLoaded } = useAuth();
  const { language } = useLanguage();
  const t = getLandingTranslations(language);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalListItem[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDayKey(new Date()));
  const daysScrollerRef = useRef<HTMLDivElement | null>(null);
  const daysAutoScrolledRef = useRef(false);

  const last7Days = useMemo(() => {
    const today = new Date();
    const days: { key: string; date: Date }[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      days.push({ key: toDayKey(d), date: d });
    }
    return days;
  }, []);

  const entriesBySelectedDay = useMemo(
    () => entries.filter((item) => item.dayKey === selectedDayKey).sort((a, b) => b.timestamp - a.timestamp),
    [entries, selectedDayKey]
  );

  const activityCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of entries) {
      map.set(item.dayKey, (map.get(item.dayKey) ?? 0) + 1);
    }
    return map;
  }, [entries]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setEntries([]);
      setEntriesError(null);
      setLoadingEntries(false);
      return;
    }
    let cancelled = false;
    setLoadingEntries(true);
    setEntriesError(null);
    fetch("/api/me/transcripts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const mapped = rows
          .map((row) =>
            toJournalItem(row as {
              _id: string;
              sourceType?: "youtube" | "journal";
              journalCategory?: "nutrition" | "exercise";
              journalEntryDay?: number;
              journalEntryMonth?: number;
              journalEntryYear?: number;
              journalEntryHour?: number;
              journalEntryMinute?: number;
              videoTitle?: string;
              transcriptText?: string;
              createdAt?: string;
            })
          )
          .filter((item): item is JournalListItem => item !== null);
        setEntries(mapped);
      })
      .catch(() => {
        if (!cancelled) setEntriesError("Could not load journal entries.");
      })
      .finally(() => {
        if (!cancelled) setLoadingEntries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId]);

  useEffect(() => {
    if (daysAutoScrolledRef.current) return;
    const el = daysScrollerRef.current;
    if (!el) return;
    const rafId = window.requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
      daysAutoScrolledRef.current = true;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [last7Days.length]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/chat/new"
            className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors shrink-0"
          >
            ← {t.journalEntryBack}
          </Link>
          <h1 className="text-lg font-semibold truncate">{t.journalEntryModalTitle}</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 min-h-0 flex flex-col max-w-2xl w-full mx-auto px-4 py-6">
        {!isLoaded ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !userId ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.journalEntrySignInPrompt}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent("/chat/journal/new")}`}
                className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90"
              >
                Sign in
              </Link>
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent("/chat/journal/new")}`}
                className="inline-flex px-4 py-2 rounded-xl text-sm font-medium border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Create account
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-background px-2.5 py-2">
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <p className="text-xs font-semibold text-foreground">Last 7 days</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {entriesBySelectedDay.length} item{entriesBySelectedDay.length === 1 ? "" : "s"}
                </p>
              </div>
              <div ref={daysScrollerRef} className="overflow-x-auto">
                <div className="flex min-w-max gap-1.5 sm:grid sm:grid-cols-7 sm:gap-1.5 sm:min-w-0">
                  {last7Days.map(({ key, date }) => {
                    const selected = key === selectedDayKey;
                    const hasActivity = (activityCountByDay.get(key) ?? 0) > 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDayKey(key)}
                        className={`relative w-14 sm:w-auto shrink-0 flex flex-col items-center justify-center rounded-lg border px-1 py-2 transition-colors ${
                          selected
                            ? "border-foreground bg-neutral-100 dark:bg-neutral-800"
                            : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400">
                          {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)}
                        </span>
                        <span className="text-base sm:text-sm font-semibold text-foreground leading-none mt-0.5">
                          {date.getDate()}
                        </span>
                        {hasActivity && (
                          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {loadingEntries ? (
              <p className="text-sm text-neutral-500">Loading journal entries…</p>
            ) : entriesError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{entriesError}</p>
            ) : entriesBySelectedDay.length === 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                No journal entries for this day.
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-0.5">
                {entriesBySelectedDay.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.typeLabel === "Nutrition"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
                            : item.typeLabel === "Exercise"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                        }`}
                      >
                        {item.typeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      {item.preview || "No preview available."}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.dateText}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
