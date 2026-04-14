"use client";

import React, { Fragment, useEffect, useState } from "react";
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

const TABS: Array<{ key: MobileBottomTab; label: string; ariaLabel: string }> = [
  { key: "quickNote", label: "Notes", ariaLabel: "Quick Notes" },
  { key: "commonplace", label: "Quotes", ariaLabel: "Commonplace" },
  { key: "weight", label: "Weight", ariaLabel: "Weight" },
  { key: "sleep", label: "Sleep", ariaLabel: "Sleep" },
  { key: "habits", label: "Habits", ariaLabel: "Habits" },
  { key: "nutrition", label: "Food", ariaLabel: "Nutrition" },
  { key: "exercise", label: "Move", ariaLabel: "Exercise" },
  { key: "metacognition", label: "Meta", ariaLabel: "Metacognition" },
];

function TabIcon({ tab, active }: { tab: MobileBottomTab; active: boolean }) {
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
    case "habits":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
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
      className="fixed inset-x-0 bottom-0 z-[35] border-t border-black/[0.06] bg-[#faf9f5]/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#141413]/95 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Dashboard sections"
    >
      <div className="flex min-h-[3.25rem] items-stretch overflow-x-auto overscroll-x-contain scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab, index) => {
          const active = activeTab === tab.key;
          return (
            <Fragment key={tab.key}>
              {index > 0 ? (
                <span
                  aria-hidden
                  className="pointer-events-none my-auto h-4 w-px shrink-0 self-center rounded-full bg-[#c96442]/22 dark:bg-[#d97757]/28"
                />
              ) : null}
              <button
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-0.5 py-2 transition-colors duration-200 active:opacity-80 ${
                  active ? "text-[#c96442] dark:text-[#d97757]" : "text-neutral-500 dark:text-neutral-400"
                }`}
                aria-label={tab.ariaLabel}
                aria-current={active ? "page" : undefined}
              >
                <TabIcon tab={tab.key} active={active} />
                <span
                  className={`w-full truncate text-center text-[9px] font-normal leading-none tracking-tight ${
                    active ? "text-[#c96442] dark:text-[#d97757]" : "text-neutral-500 dark:text-neutral-500"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );

  if (!mounted) return null;
  return createPortal(bar, document.body);
});
