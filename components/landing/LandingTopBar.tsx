"use client";

import React from "react";

interface LandingTopBarProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  selectedDateLabel: string;
  onOpenCalendar: () => void;
}

export function LandingTopBar({
  eyebrow,
  title,
  subtitle,
  selectedDateLabel,
  onOpenCalendar,
}: LandingTopBarProps) {
  return (
    <section className="w-full rounded-[2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <button
            type="button"
            onClick={onOpenCalendar}
            className="inline-flex items-center justify-between gap-3 rounded-full border border-[#E9D5C2] bg-[#FBF4EC] px-4 py-2 text-sm font-medium text-[#7C522D] transition-colors hover:bg-[#F8EBDD] dark:border-[#6A4A33] dark:bg-[#241a14] dark:text-[#E8C3A0] dark:hover:bg-[#2B2019]"
          >
            <span>{selectedDateLabel}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
