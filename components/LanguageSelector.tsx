"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "./LanguageProvider";
import { LANGUAGES, getLanguageName, type LanguageCode } from "@/lib/languages";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right?: number; left?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-language-dropdown]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current && typeof window !== "undefined") {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(180, window.innerWidth - 32);
      const wouldOverflowLeft = rect.right - dropdownWidth < 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
      setPosition(
        wouldOverflowLeft
          ? {
              top: openUpward ? undefined : rect.bottom + 4,
              bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
              left: 16,
            }
          : {
              top: openUpward ? undefined : rect.bottom + 4,
              bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
              right: window.innerWidth - rect.right,
            }
      );
    } else {
      setPosition(null);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={`Language: ${getLanguageName(language)}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          data-language-dropdown
          role="listbox"
          className="fixed py-1 min-w-[160px] max-w-[min(180px,calc(100vw-2rem))] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-lg z-[100] max-h-[min(70vh,320px)] overflow-y-auto"
          style={{
            ...(position.top !== undefined ? { top: position.top, bottom: "auto" } : { bottom: position.bottom, top: "auto" }),
            ...(position.left !== undefined
              ? { left: position.left, right: "auto" }
              : { right: position.right ?? "auto", left: "auto" }),
          }}
        >
          {LANGUAGES.map(({ code, name }) => (
            <button
              key={code}
              role="option"
              aria-selected={language === code}
              type="button"
              onClick={() => {
                setLanguage(code as LanguageCode);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                language === code
                  ? "bg-accent text-white font-semibold border-l-4 border-accent"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              {language === code && <span className="text-white shrink-0" aria-hidden>✓</span>}
              {name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
