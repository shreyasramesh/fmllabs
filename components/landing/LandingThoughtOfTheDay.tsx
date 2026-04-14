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
    <section className="module-glass-hero w-full overflow-hidden rounded-[2rem] bg-white/50 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:bg-white/[0.04] sm:p-5">
      <div>
        {/* Eyebrow + icon + streak */}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c96442] dark:text-[#d97757]">
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
          className="mt-1 text-left text-base font-semibold text-foreground transition-colors hover:text-[#c96442] sm:text-lg dark:hover:text-[#d97757]"
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
              className="ml-1 text-[12px] font-medium text-[#c96442] hover:underline dark:text-[#d97757]"
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
        <div className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden">
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
              className="rounded-full border border-[#c96442] bg-[#f5f4ed] px-3 py-1 text-[13px] font-medium text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] disabled:opacity-50 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
            >
              {reviewing ? "Saving…" : "Mark as reviewed"}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenConcept}
            className="text-[13px] font-medium text-[#87867f] transition-colors hover:text-[#141413] dark:hover:text-[#faf9f5]"
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
    </section>
  );
}
