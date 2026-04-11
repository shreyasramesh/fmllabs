"use client";

import React from "react";
import { SparklesIcon } from "@/components/SharedIcons";

const ANALYZING_MESSAGE = "Analyzing";

type EstimateThinkingLabelProps = {
  message?: string;
  /** Inline row (composer right column) vs larger block */
  variant?: "inline" | "prominent";
  className?: string;
};

/**
 * In-flight estimate affordance: compact copy so the composer keeps vertical space.
 */
export function EstimateThinkingLabel({
  message = ANALYZING_MESSAGE,
  variant = "inline",
  className = "",
}: EstimateThinkingLabelProps) {
  const iconCls =
    variant === "prominent"
      ? "h-3.5 w-3.5 shrink-0 text-blue-500/90 dark:text-blue-400/90"
      : "h-3 w-3 shrink-0 text-blue-500/85 dark:text-blue-400/85";
  const textCls =
    variant === "prominent"
      ? "text-xs font-medium text-neutral-600 dark:text-neutral-400"
      : "text-[11px] font-normal text-neutral-500 dark:text-neutral-400";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 ${variant === "inline" ? "min-w-0" : ""} ${variant === "inline" ? "" : "whitespace-nowrap"} ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <SparklesIcon className={`${iconCls} motion-safe:animate-pulse shrink-0`} />
      <span className={`min-w-0 ${variant === "inline" ? "truncate" : ""} ${textCls}`}>{message}</span>
    </span>
  );
}

export function ThinkingEstimateLabel({
  variant = "inline",
  className = "",
}: {
  variant?: "inline" | "prominent";
  className?: string;
}) {
  return <EstimateThinkingLabel message={ANALYZING_MESSAGE} variant={variant} className={className} />;
}

/** Centered block for categorizing / heavy processing (Quick note, etc.). */
export function EstimateThinkingHero({
  message = ANALYZING_MESSAGE,
  subMessage,
}: {
  message?: string;
  subMessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <SparklesIcon
        className="h-7 w-7 shrink-0 motion-safe:animate-pulse text-blue-500/85 dark:text-blue-400/85"
        aria-hidden
      />
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{message}</p>
        {subMessage ? (
          <p className="max-w-[260px] text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-500">{subMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
