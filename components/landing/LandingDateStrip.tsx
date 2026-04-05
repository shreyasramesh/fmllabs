"use client";

import React, { useLayoutEffect, useRef } from "react";

import type { LandingDateItem } from "@/components/landing/types";

interface LandingDateStripProps {
  label: string;
  hint: string;
  items: LandingDateItem[];
}

/** After load/refresh, pan the strip horizontally so the current day (rightmost in the week) is in view. */
export function LandingDateStrip({ label, hint, items }: LandingDateStripProps) {
  const stripScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = stripScrollRef.current;
    if (!el || items.length === 0) return;
    const scrollToToday = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max > 0) {
        el.scrollTo({ left: max, behavior: "auto" });
      }
    };
    scrollToToday();
    requestAnimationFrame(scrollToToday);
    const t = window.setTimeout(scrollToToday, 120);
    return () => window.clearTimeout(t);
  }, [items.length]);

  return (
    <section className="landing-module-glass w-full overflow-hidden rounded-[1.75rem] border p-4 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {hint}
          </p>
        </div>
      </div>

      <div ref={stripScrollRef} className="mt-4 overflow-x-auto overflow-y-hidden">
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
                  : "border-neutral-400/90 bg-white hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-950 dark:hover:border-neutral-500 dark:hover:bg-neutral-900"
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
