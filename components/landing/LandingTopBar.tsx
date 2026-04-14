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
    <section className="w-full overflow-hidden rounded-[2rem] border border-[#e8e6dc] bg-[#faf9f5] p-4 shadow-[rgba(0,0,0,0.05)_0px_4px_24px] dark:border-[#3d3d3a] dark:bg-[#30302e] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f] dark:text-[#87867f]">
            {eyebrow}
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium leading-tight tracking-normal text-[#141413] dark:text-[#faf9f5] sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5e5d59] dark:text-[#87867f]">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <button
            type="button"
            onClick={onOpenCalendar}
            className="inline-flex items-center justify-between gap-2.5 rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-4 py-2 text-sm font-medium text-[#4d4c48] shadow-[#e8e6dc_0px_0px_0px_0px,#d1cfc5_0px_0px_0px_1px] transition-colors hover:bg-[#e8e6dc] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
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
              className="h-4 w-4 text-[#87867f]"
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
