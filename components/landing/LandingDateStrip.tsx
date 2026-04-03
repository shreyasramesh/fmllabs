"use client";

import React from "react";

import type { LandingDateItem } from "@/components/landing/types";

interface LandingDateStripProps {
  label: string;
  hint: string;
  items: LandingDateItem[];
}

export function LandingDateStrip({ label, hint, items }: LandingDateStripProps) {
  return (
    <section className="w-full overflow-hidden rounded-[1.75rem] border border-neutral-200/70 bg-white/85 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {hint}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-7">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-pressed={item.selected}
              className={`relative flex min-h-[78px] w-[74px] shrink-0 flex-col items-center justify-center rounded-[1.35rem] border px-2 py-3 text-center transition-all lg:w-auto ${
                item.selected
                  ? "border-[#B87B51] bg-[#FBF4EC] shadow-[0_12px_24px_rgba(184,123,81,0.16)] dark:border-[#D6A67E] dark:bg-[#241a14]"
                  : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
              }`}
            >
              <span
                className={`text-[11px] font-medium ${
                  item.struck
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {item.weekdayLabel}
              </span>
              <span
                className={`mt-1 text-lg font-semibold leading-none ${
                  item.selected
                    ? "text-[#7C522D] dark:text-[#F3D6B7]"
                    : item.struck
                      ? "text-neutral-500 dark:text-neutral-400"
                      : "text-foreground"
                }`}
              >
                {item.dateLabel}
              </span>
              {item.struck && !item.selected && (
                <svg
                  className="pointer-events-none absolute inset-[16%] z-10 overflow-visible"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <line
                    x1="18"
                    y1="72"
                    x2="82"
                    y2="30"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className="text-neutral-400/90 dark:text-neutral-500/85"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
