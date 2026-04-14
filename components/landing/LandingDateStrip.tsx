"use client";

import React, { useLayoutEffect, useRef } from "react";

import type { LandingDateItem } from "@/components/landing/types";

interface LandingDateStripProps {
  hint: string;
  items: LandingDateItem[];
}

/** After load/refresh, pan the strip horizontally so the current day (rightmost in the week) is in view. */
export function LandingDateStrip({ hint, items }: LandingDateStripProps) {
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
      <p className="text-sm text-[#4d4c48] dark:text-[#b0aea5] leading-relaxed">{hint}</p>

      <div ref={stripScrollRef} className="mt-4 overflow-x-auto">
        <div className="flex min-w-max gap-2 py-2 lg:grid lg:min-w-0 lg:grid-cols-7">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-pressed={item.selected}
              className={`relative flex min-h-[78px] w-[74px] shrink-0 flex-col items-center justify-center rounded-[1.35rem] border px-2 py-3 text-center transition-all lg:w-auto ${
                item.selected
                  ? "border-[#c96442] bg-[#f5f4ed] shadow-[rgba(201,100,66,0.12)_0px_0px_0px_1px,rgba(0,0,0,0.05)_0px_4px_16px] dark:border-[#d97757] dark:bg-[#30302e]"
                  : "border-[#e8e6dc] bg-[#faf9f5] hover:-translate-y-0.5 hover:border-[#d1cfc5] hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:bg-[#141413] dark:hover:border-[#4d4c48] dark:hover:bg-[#30302e]"
              }`}
            >
              <span
                className={`text-[11px] font-medium ${
                  item.struck
                    ? "text-[#b0aea5] dark:text-[#5e5d59]"
                    : "text-[#87867f] dark:text-[#87867f]"
                }`}
              >
                {item.weekdayLabel}
              </span>
              <span
                className={`mt-1 text-lg font-medium leading-none ${
                  item.selected
                    ? "text-[#c96442] dark:text-[#d97757]"
                    : item.struck
                      ? "text-[#87867f] dark:text-[#5e5d59]"
                      : "text-[#141413] dark:text-[#faf9f5]"
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
                    className="text-[#b0aea5] dark:text-[#5e5d59]"
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
