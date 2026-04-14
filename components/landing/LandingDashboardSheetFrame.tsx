"use client";

import React from "react";

/**
 * Landing dashboard overlays: on mobile, slides up from the bottom (like image review).
 * From `sm` and up, behaves like a centered card with padding.
 */
export function LandingDashboardSheetFrame({
  onBackdropClick,
  ariaLabel,
  zClass = "z-[52]",
  maxWidthClass = "sm:max-w-[min(94vw,560px)]",
  maxHeightClass = "max-h-[min(92dvh,900px)] sm:max-h-[88vh]",
  children,
}: {
  onBackdropClick: () => void;
  ariaLabel?: string;
  zClass?: string;
  maxWidthClass?: string;
  maxHeightClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 ${zClass} flex flex-col justify-end bg-black/50 animate-fade-in backdrop-blur-sm sm:items-center sm:justify-center sm:p-4`}
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={`relative flex min-h-0 w-full flex-col overflow-hidden border border-neutral-200 bg-background shadow-xl animate-fade-in-up dark:border-neutral-700 sm:rounded-3xl ${maxWidthClass} ${maxHeightClass} rounded-t-[1.25rem] pb-[env(safe-area-inset-bottom,0px)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
