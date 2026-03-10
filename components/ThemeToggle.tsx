"use client";

import { useTheme } from "./ThemeProvider";

function getMoonPhaseEmoji(phase: number | null): string {
  if (phase == null) return "🌙";
  const normalized = ((phase % 1) + 1) % 1;
  if (normalized < 0.0625 || normalized >= 0.9375) return "🌑";
  if (normalized < 0.1875) return "🌒";
  if (normalized < 0.3125) return "🌓";
  if (normalized < 0.4375) return "🌔";
  if (normalized < 0.5625) return "🌕";
  if (normalized < 0.6875) return "🌖";
  if (normalized < 0.8125) return "🌗";
  return "🌘";
}

export function ThemeToggle({ inverted, moonPhase }: { inverted?: boolean; moonPhase?: number | null }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl transition-colors duration-300 ease-in-out ${
        inverted
          ? "text-neutral-100 dark:text-neutral-900 hover:text-neutral-200 dark:hover:text-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-200"
          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      }`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <span className="w-5 h-5 text-base leading-none flex items-center justify-center" aria-hidden>
          {getMoonPhaseEmoji(moonPhase ?? null)}
        </span>
      )}
    </button>
  );
}
