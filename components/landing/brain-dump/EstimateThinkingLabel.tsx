"use client";

import React, { useState } from "react";
import { SparklesIcon } from "@/components/SharedIcons";

/** Rotating dev-console energy for inline calorie estimates (new pick each mount). */
const QUIRKY_THINKING_PHRASES = [
  "Reticulating splines…",
  "Warming up the logits…",
  "Teaching sand to count calories…",
  "Herding macro molecules…",
  "Asking the weights nicely…",
  "Negotiating with thermodynamics…",
  "Consulting the float spirits…",
  "Garbage-collecting doubt…",
  "One more epoch, hold tight…",
  "Compiling plausible numbers…",
  "Dewiggifying the fudge factor…",
  "Synthesizing appetite…",
  "Sharpening the estimate bit…",
  "Doing science (quietly)…",
  "Bribing the loss function…",
  "Tensoring your lunch…",
] as const;

export function pickQuirkyThinkingPhrase(): string {
  const i = Math.floor(Math.random() * QUIRKY_THINKING_PHRASES.length);
  return QUIRKY_THINKING_PHRASES[i] ?? "Thinking…";
}

type EstimateThinkingLabelProps = {
  /** Custom message; for random quirky loading copy use `ThinkingEstimateLabel`. */
  message: string;
  /** Inline row (composer right column) vs larger block */
  variant?: "inline" | "prominent";
  className?: string;
};

/**
 * In-flight estimate affordance: matches Amy calorie row (sparkles + solid text), no gradient/shimmer.
 */
export function EstimateThinkingLabel({ message, variant = "inline", className = "" }: EstimateThinkingLabelProps) {
  const iconCls =
    variant === "prominent"
      ? "h-5 w-5 shrink-0 text-blue-500/90 dark:text-blue-400/90"
      : "h-4 w-4 shrink-0 text-blue-500/85 dark:text-blue-400/85";
  const textCls =
    variant === "prominent" ? "text-base font-medium text-neutral-700 dark:text-neutral-200" : "text-[13px] font-medium text-neutral-500 dark:text-neutral-400";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 ${variant === "inline" ? "min-w-0" : ""} ${variant === "inline" ? "" : "whitespace-nowrap"} ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <SparklesIcon className={`${iconCls} motion-safe:animate-pulse shrink-0`} />
      <span className={`min-w-0 ${variant === "inline" ? "truncate" : ""} ${textCls}`}>{message}</span>
    </span>
  );
}

/** Random quirky phrase per mount — use wherever estimate is in-flight. */
export function ThinkingEstimateLabel({
  variant = "inline",
  className = "",
}: {
  variant?: "inline" | "prominent";
  className?: string;
}) {
  const [message] = useState(pickQuirkyThinkingPhrase);
  return <EstimateThinkingLabel message={message} variant={variant} className={className} />;
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
    <div className="flex flex-col items-center justify-center gap-4 py-14">
      <SparklesIcon className="h-10 w-10 shrink-0 motion-safe:animate-pulse text-blue-500/85 dark:text-blue-400/85" aria-hidden />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base font-medium text-neutral-700 dark:text-neutral-200">{message}</p>
        {subMessage ? (
          <p className="max-w-[260px] text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{subMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
