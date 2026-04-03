"use client";

import { useState } from "react";
import type { LandingThoughtOfTheDay } from "@/components/landing/types";

interface LandingThoughtOfTheDayProps {
  thought: LandingThoughtOfTheDay;
  onReview: () => void;
  onOpenConcept: () => void;
  reviewing: boolean;
}

export function LandingThoughtOfTheDayBanner({
  thought,
  onReview,
  onOpenConcept,
  reviewing,
}: LandingThoughtOfTheDayProps) {
  const [expanded, setExpanded] = useState(false);

  const summaryLines = thought.summary.split(/\n/).filter(Boolean);
  const needsTruncation = thought.summary.length > 180;
  const displaySummary =
    !expanded && needsTruncation
      ? thought.summary.slice(0, 180).replace(/\s+\S*$/, "") + "…"
      : thought.summary;

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        {/* Accent icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          {/* Eyebrow + streak */}
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e] dark:text-[#D6A67E]">
              Thought of the Day
            </p>
            {thought.streak > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {thought.streak}-day streak
              </span>
            )}
          </div>

          {/* Title — tappable */}
          <button
            type="button"
            onClick={onOpenConcept}
            className="mt-1 text-left text-base font-semibold text-foreground transition-colors hover:text-[#92400e] sm:text-lg dark:hover:text-[#D6A67E]"
          >
            {thought.title}
          </button>

          {/* Summary */}
          <p className="mt-1.5 break-words text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {displaySummary}
            {needsTruncation && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ml-1 text-[12px] font-medium text-[#92400e] hover:underline dark:text-[#D6A67E]"
              >
                Read more
              </button>
            )}
          </p>

          {/* Reflection prompt */}
          {thought.enrichmentPrompt && (
            <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700/70 dark:text-amber-500/70">
                Reflect
              </p>
              <p className="mt-0.5 break-words text-[13px] leading-snug text-amber-900 dark:text-amber-200">
                {thought.enrichmentPrompt}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {thought.reviewedToday ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                Reviewed
              </span>
            ) : (
              <button
                type="button"
                onClick={onReview}
                disabled={reviewing}
                className="rounded-full border border-[#B87B51] bg-[#FBF4EC] px-3 py-1 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
              >
                {reviewing ? "Saving…" : "Mark as reviewed"}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenConcept}
              className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              View full concept →
            </button>

            {thought.daysSinceLastReview != null && thought.daysSinceLastReview > 0 && (
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Last reviewed {thought.daysSinceLastReview}d ago
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
