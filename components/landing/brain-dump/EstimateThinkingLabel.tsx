"use client";

import React from "react";

type EstimateThinkingLabelProps = {
  /** e.g. "Thinking", "Estimating", "Analyzing with Gemini" */
  message: string;
  /** Larger dots + text for full-screen / modal states */
  variant?: "inline" | "prominent";
  className?: string;
};

/**
 * Animated label for in-flight nutrition/exercise estimates (non-static, works in light + dark).
 */
export function EstimateThinkingLabel({ message, variant = "inline", className = "" }: EstimateThinkingLabelProps) {
  const dot = variant === "prominent" ? "h-2 w-2" : "h-1.5 w-1.5";
  const textCls = variant === "prominent" ? "text-base font-medium" : "text-[15px] font-medium";

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap text-neutral-600 dark:text-neutral-300 ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className={`estimate-thinking-dot rounded-full bg-blue-500 dark:bg-blue-400 ${dot}`} />
        <span className={`estimate-thinking-dot rounded-full bg-violet-500 dark:bg-violet-400 ${dot}`} />
        <span className={`estimate-thinking-dot rounded-full bg-emerald-500 dark:bg-emerald-400 ${dot}`} />
      </span>
      <span className={`estimate-thinking-shimmer-text tabular-nums ${textCls}`}>{message}</span>
    </span>
  );
}

/** Centered block for categorizing / heavy processing (Quick note, etc.). */
export function EstimateThinkingHero({
  message,
  subMessage,
}: {
  message: string;
  subMessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14">
      <div className="relative h-14 w-14" aria-hidden>
        <div className="estimate-thinking-glow-pulse absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/35 via-violet-500/45 to-emerald-500/35 blur-md dark:from-blue-400/25 dark:via-violet-400/35 dark:to-emerald-400/25" />
        <div className="absolute inset-[3px] rounded-full bg-[var(--background)] shadow-inner dark:bg-neutral-950/80" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-200/70 border-t-blue-500 border-r-violet-500/70 [animation-duration:1.35s] dark:border-neutral-700 dark:border-t-blue-400 dark:border-r-violet-400/80" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-0.5">
            <span className="estimate-thinking-dot h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
            <span className="estimate-thinking-dot h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
            <span className="estimate-thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <EstimateThinkingLabel message={message} variant="prominent" className="text-neutral-700 dark:text-neutral-200" />
        {subMessage ? (
          <p className="max-w-[260px] text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{subMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
