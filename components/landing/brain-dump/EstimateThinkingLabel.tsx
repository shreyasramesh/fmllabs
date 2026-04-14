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
      ? "h-3.5 w-3.5 shrink-0 text-amber-500/95 dark:text-amber-300/95"
      : "h-[0.8rem] w-[0.8rem] shrink-0 text-amber-500/90 dark:text-amber-300/90";
  const textCls =
    variant === "prominent"
      ? "text-xs font-semibold text-[#4d4c48] dark:text-[#b0aea5]"
      : "text-[11px] font-semibold leading-none text-[#8A5A33] dark:text-[#E8C8A8]";
  const shellCls =
    variant === "prominent"
      ? "rounded-full border border-[#d1cfc5]/70 bg-[linear-gradient(135deg,rgba(250,249,245,0.98),rgba(245,244,237,0.95),rgba(248,246,239,0.98))] px-3 py-1.5 shadow-[0_12px_34px_-18px_rgba(184,123,81,0.42)] dark:border-[#d97757]/30 dark:bg-[linear-gradient(135deg,rgba(48,48,46,0.96),rgba(61,61,58,0.93),rgba(48,48,46,0.96))]"
      : "inline-flex h-[1.7rem] rounded-full border border-[#d1cfc5]/70 bg-[linear-gradient(135deg,rgba(255,251,246,0.97),rgba(252,242,228,0.94),rgba(255,248,240,0.97))] px-2.5 shadow-[0_10px_26px_-20px_rgba(184,123,81,0.4)] dark:border-[#d97757]/28 dark:bg-[linear-gradient(135deg,rgba(38,24,18,0.94),rgba(53,34,24,0.9),rgba(32,21,16,0.95))]";

  return (
    <span
      className={`estimate-thinking-shell relative inline-flex max-w-full items-center gap-1.5 overflow-hidden ${shellCls} ${
        variant === "inline" ? "min-w-0 self-center" : "whitespace-nowrap"
      } ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <span className="estimate-thinking-sheen absolute inset-0" aria-hidden />
      <span className="estimate-thinking-glow absolute inset-y-0 left-2 w-8 rounded-full blur-xl" aria-hidden />
      <span className="relative flex shrink-0 items-center justify-center">
        <span className="estimate-thinking-icon-halo absolute inset-[-0.3rem] rounded-full" aria-hidden />
        <SparklesIcon className={`${iconCls} estimate-thinking-icon relative shrink-0`} />
      </span>
      <span
        className={`estimate-thinking-text relative min-w-0 ${variant === "inline" ? "truncate" : ""} ${textCls}`}
      >
        {message}
      </span>
      <style jsx>{`
        .estimate-thinking-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255, 244, 214, 0.05) 30%,
            rgba(255, 248, 235, 0.36) 50%,
            rgba(255, 241, 209, 0.08) 70%,
            transparent 100%
          );
          transform: translateX(-150%);
          animation: estimate-thinking-shimmer 3.8s ease-in-out infinite;
          pointer-events: none;
        }
        .estimate-thinking-sheen {
          background: radial-gradient(circle at 18% 50%, rgba(251, 191, 36, 0.18), transparent 42%);
          pointer-events: none;
        }
        .estimate-thinking-glow {
          background: rgba(245, 158, 11, 0.18);
          animation: estimate-thinking-glow 4.2s ease-in-out infinite;
          pointer-events: none;
        }
        .estimate-thinking-icon-halo {
          background: radial-gradient(circle, rgba(251, 191, 36, 0.28), transparent 70%);
          animation: estimate-thinking-breathe 3.4s ease-in-out infinite;
        }
        .estimate-thinking-icon {
          animation: estimate-thinking-float 3.4s ease-in-out infinite;
        }
        .estimate-thinking-text {
          letter-spacing: 0.015em;
          text-shadow: 0 1px 10px rgba(184, 123, 81, 0.08);
        }
        @keyframes estimate-thinking-shimmer {
          0% {
            transform: translateX(-150%);
          }
          55%,
          100% {
            transform: translateX(150%);
          }
        }
        @keyframes estimate-thinking-glow {
          0%,
          100% {
            opacity: 0.45;
            transform: scaleX(0.9);
          }
          50% {
            opacity: 0.9;
            transform: scaleX(1.15);
          }
        }
        @keyframes estimate-thinking-breathe {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.92);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }
        @keyframes estimate-thinking-float {
          0%,
          100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-0.5px) scale(1.04);
          }
        }
      `}</style>
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
    <div className="relative flex flex-col items-center justify-center gap-3 py-8">
      <div className="estimate-thinking-hero-ring relative flex h-16 w-16 items-center justify-center rounded-full border border-[#d1cfc5]/70 bg-[#faf9f5] shadow-[0_20px_64px_-28px_rgba(184,123,81,0.46)] dark:border-[#d97757]/28 dark:bg-[radial-gradient(circle_at_30%_30%,rgba(56,36,24,0.98),rgba(120,53,15,0.24),rgba(31,20,15,0.96))]">
        <span className="estimate-thinking-hero-orbit absolute inset-0 rounded-full" aria-hidden />
        <span className="estimate-thinking-hero-sheen absolute inset-0 rounded-full" aria-hidden />
        <SparklesIcon
          className="estimate-thinking-hero-icon relative h-7 w-7 shrink-0 text-amber-500/90 dark:text-amber-300/90"
          aria-hidden
        />
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="estimate-thinking-hero-text text-sm font-semibold text-[#4d4c48] dark:text-[#b0aea5]">
          {message}
        </p>
        {subMessage ? (
          <p className="max-w-[260px] text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-500">{subMessage}</p>
        ) : null}
      </div>
      <style jsx>{`
        .estimate-thinking-hero-ring::after {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            rgba(245, 158, 11, 0.05),
            rgba(217, 119, 6, 0.24),
            rgba(255, 247, 227, 0.48),
            rgba(251, 191, 36, 0.24),
            rgba(245, 158, 11, 0.05)
          );
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 1px));
          animation: estimate-thinking-hero-spin 7.5s linear infinite;
          pointer-events: none;
        }
        .estimate-thinking-hero-orbit {
          box-shadow: inset 0 0 28px rgba(251, 191, 36, 0.16);
          animation: estimate-thinking-breathe 3.8s ease-in-out infinite;
        }
        .estimate-thinking-hero-sheen {
          background: linear-gradient(
            120deg,
            transparent 10%,
            rgba(255, 241, 214, 0.04) 34%,
            rgba(255, 248, 235, 0.56) 50%,
            rgba(255, 241, 214, 0.08) 66%,
            transparent 90%
          );
          transform: translateX(-135%) rotate(10deg);
          animation: estimate-thinking-shimmer 4.1s ease-in-out infinite;
          pointer-events: none;
        }
        .estimate-thinking-hero-icon {
          animation: estimate-thinking-float 3.6s ease-in-out infinite;
        }
        .estimate-thinking-hero-text {
          text-shadow: 0 1px 16px rgba(184, 123, 81, 0.14);
        }
        @keyframes estimate-thinking-hero-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
