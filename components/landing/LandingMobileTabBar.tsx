"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileBottomTab =
  | "quickNote"
  | "commonplace"
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
  { key: "quickNote", label: "Quick Notes" },
  { key: "commonplace", label: "Commonplace" },
  { key: "weight", label: "Weight" },
  { key: "sleep", label: "Sleep" },
  { key: "habits", label: "Habits" },
  { key: "nutrition", label: "Nutrition" },
  { key: "exercise", label: "Exercise" },
  { key: "metacognition", label: "Metacognition" },
];

function TabIcon({ tab, active }: { tab: MobileBottomTab; active: boolean }) {
  const cls = `h-5 w-5 transition-colors ${active ? "text-[#c96442] dark:text-[#d97757]" : "text-[#87867f] dark:text-[#5e5d59]"}`;

  switch (tab) {
    case "quickNote":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          <path d="M8 7h8M8 11h6" />
          <path d="m15.5 13.5 4.5-4.5a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7l-4.5 4.5" />
          <path d="M14 15l3.5-3.5M13 21l3-1-2-2" />
        </svg>
      );
    case "commonplace":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
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
      className="fixed inset-x-0 bottom-0 z-[35] border-t border-[#e8e6dc] bg-[#f5f4ed] dark:border-[#30302e] dark:bg-[#141413] md:hidden"
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
                  ? "text-[#c96442] dark:text-[#d97757]"
                  : "text-[#87867f] dark:text-[#5e5d59]"
              }`}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <TabIcon tab={tab.key} active={active} />
              <span
                className={`max-w-[5.5rem] text-center text-[10px] font-medium leading-tight ${
                  active ? "text-[#c96442] dark:text-[#d97757]" : "text-[#87867f] dark:text-[#5e5d59]"
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
