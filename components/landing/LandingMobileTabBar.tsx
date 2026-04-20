"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileBottomTab =
  | "quickNote"
  | "doodle"
  | "commonplace"
  | "nutrition"
  | "exercise"
  | "spend"
  | "weight"
  | "sleep"
  | "metacognition"
  | "life"
  | "andMore";

interface LandingMobileTabBarProps {
  activeTab: MobileBottomTab;
  onTabChange: (tab: MobileBottomTab) => void;
  /** When true, the "More" tab carries data-tour="menu-button" (mobile landing replaces header hamburger). */
  menuTourOnAndMore?: boolean;
}

export const MOBILE_BOTTOM_TABS: ReadonlyArray<{
  key: MobileBottomTab;
  label: string;
  ariaLabel: string;
  /** Short marketing blurb used by the anonymous feature grid. */
  description: string;
}> = [
  { key: "quickNote", label: "Notes", ariaLabel: "Quick Notes", description: "Capture journals, reflections, and quick notes." },
  { key: "doodle", label: "Doodle", ariaLabel: "Daily Doodle", description: "Draw a doodle to capture your day." },
  { key: "nutrition", label: "Food", ariaLabel: "Nutrition", description: "Log meals and track calories, protein, and carbs." },
  { key: "exercise", label: "Move", ariaLabel: "Exercise", description: "Record workouts and see daily movement." },
  { key: "spend", label: "Spend", ariaLabel: "Spend", description: "Track purchases and stay within your budget." },
  { key: "weight", label: "Weight", ariaLabel: "Weight", description: "Log weight entries and watch your trend." },
  { key: "sleep", label: "Sleep", ariaLabel: "Sleep", description: "Track sleep duration, HRV, and recovery." },
  { key: "commonplace", label: "Quotes", ariaLabel: "Commonplace", description: "Save quotes and build a commonplace book." },
  { key: "metacognition", label: "Meta", ariaLabel: "Metacognition", description: "Chat with mentors and run metacognition sessions." },
  { key: "life", label: "Life", ariaLabel: "Life Calendar", description: "Visualize your life in weeks, track goals, and plan for financial freedom." },
  { key: "andMore", label: "More", ariaLabel: "Library and more", description: "Habits, groups, mental models, long-term memory, and more." },
];

export function MobileTabIcon({ tab, active }: { tab: MobileBottomTab; active: boolean }) {
  const cls = `h-4 w-4 shrink-0 transition-[color,opacity] duration-200 ${active ? "text-[#c96442] opacity-100 dark:text-[#d97757]" : "text-neutral-500 opacity-65 dark:text-neutral-400"}`;
  const sw = "1.5";

  switch (tab) {
    case "quickNote":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          <path d="M8 7h8M8 11h6" />
          <path d="m15.5 13.5 4.5-4.5a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7l-4.5 4.5" />
          <path d="M14 15l3.5-3.5M13 21l3-1-2-2" />
        </svg>
      );
    case "doodle":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
          <path d="m15 5 4 4" />
        </svg>
      );
    case "commonplace":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "nutrition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    case "exercise":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="8.5" width="4" height="7" rx="1" />
          <rect x="18" y="8.5" width="4" height="7" rx="1" />
          <path d="M6 12h12" />
        </svg>
      );
    case "spend":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />
          <path d="M22 11h-4a2 2 0 0 0 0 4h4" />
        </svg>
      );
    case "weight":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="m12 14 4-4" />
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
        </svg>
      );
    case "sleep":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      );
    case "metacognition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
          <path d="M12 18v-3" />
        </svg>
      );
    case "life":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M5 22h14" />
          <path d="M5 2h14" />
          <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
          <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        </svg>
      );
    case "andMore":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      );
  }
}

export const LandingMobileTabBar = React.memo(function LandingMobileTabBar({
  activeTab,
  onTabChange,
  menuTourOnAndMore = false,
}: LandingMobileTabBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = (
    <nav
      className="fixed inset-x-0 bottom-0 z-[35] border-t border-black/[0.06] bg-[#faf9f5]/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#141413]/95 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Dashboard sections"
    >
      <div className="flex min-h-[3.5rem] items-stretch gap-1.5 overflow-x-auto overscroll-x-contain px-2 pt-0.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              {...(menuTourOnAndMore && tab.key === "andMore" ? { "data-tour": "menu-button" } : {})}
              className={`flex min-w-[3.75rem] max-w-[5.5rem] shrink-0 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 transition-colors duration-200 active:opacity-80 sm:min-w-0 sm:max-w-none ${
                active ? "text-[#c96442] dark:text-[#d97757]" : "text-neutral-500 dark:text-neutral-400"
              }`}
              aria-label={tab.ariaLabel}
              aria-current={active ? "page" : undefined}
            >
              <MobileTabIcon tab={tab.key} active={active} />
              <span
                className={`line-clamp-2 w-full text-center text-[10px] font-medium leading-tight tracking-tight ${
                  active ? "text-[#c96442] dark:text-[#d97757]" : "text-neutral-500 dark:text-neutral-500"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  if (!mounted) return null;
  return createPortal(bar, document.body);
});
