"use client";

import React from "react";

interface GoalConfigPillProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function GoalConfigPill({
  label,
  onClick,
  className = "",
}: GoalConfigPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#B87B51]/45 bg-[#FBF4EC]/95 px-3 py-1 text-[11px] font-medium text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E]/55 dark:bg-[#241a14]/90 dark:text-[#F3D6B7] dark:hover:bg-[#2e2018] ${className}`.trim()}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden
      >
        <path d="M10 2.5a.75.75 0 01.75.75v1.11a5.75 5.75 0 014.14 4.14h1.11a.75.75 0 010 1.5h-1.11a5.75 5.75 0 01-4.14 4.14v1.11a.75.75 0 01-1.5 0v-1.11a5.75 5.75 0 01-4.14-4.14H3.25a.75.75 0 010-1.5h1.11a5.75 5.75 0 014.14-4.14V3.25A.75.75 0 0110 2.5zm0 3.25a4.25 4.25 0 100 8.5 4.25 4.25 0 000-8.5zm0 2.5a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
