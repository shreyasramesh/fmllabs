"use client";

import React from "react";
import Link from "next/link";

import { MOBILE_BOTTOM_TABS, MobileTabIcon } from "@/components/landing/LandingMobileTabBar";

interface LandingAnonymousFeatureGridProps {
  /** Called when a feature card is tapped; host opens the sign-in prompt modal. */
  onFeatureClick: () => void;
  /** Optional override for the sign-in CTA (defaults to linking to /sign-in). */
  signInHref?: string;
  /** Optional override for the create account CTA. */
  signUpHref?: string;
}

/**
 * Anonymous-user replacement for the mobile landing body. Instead of exposing the
 * per-tab content (which requires an account to persist data), we surface every
 * feature as a card grid and route interactions to a sign-in prompt.
 */
export const LandingAnonymousFeatureGrid = React.memo(function LandingAnonymousFeatureGrid({
  onFeatureClick,
  signInHref = "/sign-in",
  signUpHref = "/sign-up",
}: LandingAnonymousFeatureGridProps) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-2">
      <header className="flex flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c96442] dark:text-[#d97757]">
          Explore the app
        </p>
        <h2 className="font-serif text-xl font-medium text-[#141413] dark:text-[#faf9f5]">
          Sign in to unlock every feature
        </h2>
        <p className="text-[12px] leading-relaxed text-[#5e5d59] dark:text-[#87867f]">
          Everything below becomes available once you create an account — your data stays on your device until then.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {MOBILE_BOTTOM_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={onFeatureClick}
            aria-label={`${tab.ariaLabel} — sign in required`}
            className="group flex flex-col items-start gap-1.5 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-3 text-left transition-colors hover:border-[#c96442]/50 hover:bg-[#f0eee6] active:scale-[0.98] dark:border-[#3d3d3a] dark:bg-[#30302e] dark:hover:border-[#d97757]/55 dark:hover:bg-[#3d3d3a]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f5f4ed] text-[#c96442] dark:bg-[#141413] dark:text-[#E8C3A0]">
              <MobileTabIcon tab={tab.key} active={false} />
            </span>
            <span className="text-[13px] font-semibold text-foreground">{tab.label}</span>
            <span className="line-clamp-2 text-[11px] leading-snug text-[#5e5d59] dark:text-[#87867f]">
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-1 flex flex-col items-center gap-2 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5]/70 p-4 text-center dark:border-[#3d3d3a] dark:bg-[#30302e]/60">
        <p className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">
          Ready to save your progress?
        </p>
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <Link
            href={signInHref}
            className="flex-1 min-w-[8rem] rounded-xl border-2 border-[#c96442] bg-[#f5f4ed] px-4 py-2.5 text-center text-sm font-semibold text-[#4d4c48] shadow-sm transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#faf9f5] dark:hover:bg-[#3d3d3a]"
          >
            Sign in
          </Link>
          <Link
            href={signUpHref}
            className="flex-1 min-w-[8rem] rounded-xl bg-foreground px-4 py-2.5 text-center text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
});
