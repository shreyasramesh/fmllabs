"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileBottomTab =
  | "nutrition"
  | "exercise"
  | "spend"
  | "weight"
  | "sleep"
  | "habits"
  | "metacognition";

interface LandingMobileTabBarProps {
  activeTab: MobileBottomTab;
  onTabChange: (tab: MobileBottomTab) => void;
}

const TABS: Array<{ key: MobileBottomTab; label: string }> = [
  { key: "nutrition", label: "Nutrition" },
  { key: "exercise", label: "Exercise" },
  { key: "spend", label: "Spend" },
  { key: "weight", label: "Weight" },
  { key: "sleep", label: "Sleep" },
  { key: "habits", label: "Habits" },
  { key: "metacognition", label: "Metacognition" },
];

function TabIcon({ tab, active }: { tab: MobileBottomTab; active: boolean }) {
  const cls = `h-5 w-5 transition-colors ${active ? "text-[#B87B51] dark:text-[#D6A67E]" : "text-neutral-400 dark:text-neutral-500"}`;

  switch (tab) {
    case "nutrition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    case "exercise":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="8.5" width="4" height="7" rx="1" />
          <rect x="18" y="8.5" width="4" height="7" rx="1" />
          <path d="M6 12h12" />
        </svg>
      );
    case "spend":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />
          <path d="M22 11h-4a2 2 0 0 0 0 4h4" />
        </svg>
      );
    case "weight":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="m12 14 4-4" />
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
        </svg>
      );
    case "sleep":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      );
    case "habits":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "metacognition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
          <path d="M12 18v-3" />
        </svg>
      );
  }
}

export const LandingMobileTabBar = React.memo(function LandingMobileTabBar({
  activeTab,
  onTabChange,
}: LandingMobileTabBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = (
    <nav
      className="fixed inset-x-0 bottom-0 z-[35] border-t border-neutral-200/60 bg-background dark:border-neutral-800 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Dashboard sections"
    >
      <div className="flex overflow-x-auto overscroll-x-contain scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`flex min-w-[4.25rem] shrink-0 flex-col items-center gap-0.5 px-2 pb-1.5 pt-2 transition-colors ${
                active
                  ? "text-[#B87B51] dark:text-[#D6A67E]"
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <TabIcon tab={tab.key} active={active} />
              <span
                className={`max-w-[5.5rem] text-center text-[10px] font-medium leading-tight ${
                  active ? "text-[#B87B51] dark:text-[#D6A67E]" : ""
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
