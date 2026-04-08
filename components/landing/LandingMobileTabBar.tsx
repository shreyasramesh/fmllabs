"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileTab = "nutrition" | "weight" | "sleep" | "habits" | "more";

interface LandingMobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const TABS: Array<{ key: MobileTab; label: string }> = [
  { key: "nutrition", label: "Nutrition" },
  { key: "weight", label: "Weight" },
  { key: "sleep", label: "Sleep" },
  { key: "habits", label: "Habits" },
  { key: "more", label: "More" },
];

function TabIcon({ tab, active }: { tab: MobileTab; active: boolean }) {
  const cls = `h-6 w-6 transition-colors ${active ? "text-[#B87B51] dark:text-[#D6A67E]" : "text-neutral-400 dark:text-neutral-500"}`;

  switch (tab) {
    case "nutrition":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15.5v.01" />
          <path d="M12 12v.01" />
          <path d="M11 17v.01" />
          <path d="M7 14v.01" />
        </svg>
      );
    case "weight":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="12" cy="5" r="3" />
          <path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.23A2 2 0 0 0 4 21h16a2 2 0 0 0 1.9-2.77l-2.495-8.77A2 2 0 0 0 17.5 8Z" />
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
