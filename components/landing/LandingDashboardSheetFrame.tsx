"use client";

import React, { useCallback, useRef, useState } from "react";

/**
 * Landing dashboard overlays: on mobile, slides up from the bottom (like image review).
 * From `sm` and up, behaves like a centered card with padding.
 *
 * Mobile: sheet has a fixed initial height (88dvh) so inner flex + overflow-y-auto regions
 * get a real max height; swipe up on the grabber expands to full viewport (100dvh).
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
  const [expanded, setExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchLastY = useRef<number | null>(null);

  const onGrabberTouchStart = useCallback((e: React.TouchEvent) => {
    const y = e.touches[0]?.clientY;
    touchStartY.current = y ?? null;
    touchLastY.current = y ?? null;
  }, []);

  const onGrabberTouchMove = useCallback((e: React.TouchEvent) => {
    touchLastY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onGrabberTouchEnd = useCallback(() => {
    const start = touchStartY.current;
    const end = touchLastY.current;
    touchStartY.current = null;
    touchLastY.current = null;
    if (start == null || end == null) return;
    const dy = end - start;
    if (dy < -28) setExpanded(true);
    else if (dy > 28) setExpanded(false);
  }, []);

  return (
    <div
      className={`fixed inset-0 ${zClass} flex flex-col justify-end bg-black/50 animate-fade-in backdrop-blur-sm sm:items-center sm:justify-center sm:p-4`}
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={`relative flex min-h-0 w-full flex-col overflow-hidden border border-neutral-200 bg-background shadow-xl animate-fade-in-up dark:border-neutral-700 sm:rounded-3xl ${maxWidthClass} ${maxHeightClass} rounded-t-[1.25rem] ${
          expanded
            ? "max-sm:!h-[100dvh] max-sm:!max-h-[100dvh]"
            : "max-sm:!h-[min(88dvh,900px)] max-sm:!max-h-[min(88dvh,900px)]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grabber: swipe up to use full screen so bottom actions stay reachable */}
        <div
          className="flex shrink-0 touch-none flex-col items-center pt-2 pb-1 sm:hidden"
          onTouchStart={onGrabberTouchStart}
          onTouchMove={onGrabberTouchMove}
          onTouchEnd={onGrabberTouchEnd}
          role="button"
          tabIndex={0}
          aria-label={expanded ? "Swipe down to shrink sheet" : "Swipe up to expand sheet to full screen"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
        >
          <div className="h-1 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
