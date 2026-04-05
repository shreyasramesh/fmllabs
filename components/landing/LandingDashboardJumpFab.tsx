"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  LANDING_DASHBOARD_SECTIONS,
  scrollToLandingDashboardSection,
} from "@/lib/landing-dashboard-sections";

/**
 * Floating control above the bottom composer area when the landing dashboard is shown: opens a menu to jump to any dashboard section.
 */
export function LandingDashboardJumpFab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPanelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed right-6 z-[45] md:right-8"
      style={{
        /* Stacks above the Brain Dump voice FAB (bottom-6 = 1.5rem + h-14 = 3.5rem + 0.75rem gap). */
        bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="pointer-events-auto relative flex flex-col items-end">
        {open && (
          <div
            id={menuPanelId}
            role="menu"
            aria-label="Dashboard sections"
            className="absolute bottom-full right-0 z-[46] mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/35 bg-white/55 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/50"
          >
            <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-400">
              Jump to section
            </p>
            <ul className="max-h-[min(50vh,22rem)] space-y-0.5 overflow-y-auto">
              {LANDING_DASHBOARD_SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-white/60 dark:hover:bg-white/10"
                    onClick={() => {
                      scrollToLandingDashboardSection(s.id);
                      setOpen(false);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuPanelId : undefined}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 [-webkit-tap-highlight-color:transparent]"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close section menu" : "Open dashboard section menu"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
