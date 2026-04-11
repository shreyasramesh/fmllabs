"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileTab = "nutrition" | "exercise" | "spend" | "weight" | "sleep" | "habits" | "more";

interface LandingMobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const TABS: Array<{ key: MobileTab; label: string }> = [
  { key: "nutrition", label: "Nutrition" },
  { key: "exercise", label: "Exercise" },
  { key: "spend", label: "Spend" },
  { key: "weight", label: "Weight" },
  { key: "sleep", label: "Sleep" },
  { key: "habits", label: "Habits" },
  { key: "more", label: "More" },
];

function TabIcon({ tab, active }: { tab: MobileTab; active: boolean }) {
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
    case "more":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
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
      className="fixed inset-x-0 bottom-0 z-[35] flex items-end justify-around border-t border-neutral-200/60 bg-background dark:border-neutral-800 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 transition-colors ${
              active
                ? "text-[#B87B51] dark:text-[#D6A67E]"
                : "text-neutral-400 dark:text-neutral-500"
            }`}
            aria-label={tab.label}
          >
            <TabIcon tab={tab.key} active={active} />
            <span className={`text-[10px] font-medium ${active ? "text-[#B87B51] dark:text-[#D6A67E]" : ""}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );

  if (!mounted) return null;
  return createPortal(bar, document.body);
});
