"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUserType } from "./UserTypeProvider";
import { USER_TYPES, getUserTypeName, type UserTypeId } from "@/lib/user-types";

export function UserTypeSelector() {
  const { userType, setUserType } = useUserType();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right?: number; left?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-voice-style-dropdown]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current && typeof window !== "undefined") {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = Math.min(220, window.innerWidth - 32);
      const wouldOverflowLeft = rect.right - dropdownWidth < 16;
      setPosition(
        wouldOverflowLeft
          ? { top: rect.bottom + 4, left: 16 }
          : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
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
        aria-label={`Voice: ${getUserTypeName(userType)}`}
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
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        </svg>
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          data-voice-style-dropdown
          role="listbox"
          className="fixed py-1 min-w-[220px] max-w-[min(220px,calc(100vw-2rem))] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-lg z-[100] max-h-64 overflow-y-auto"
          style={{
            top: position.top,
            ...(position.left !== undefined
              ? { left: position.left, right: "auto" }
              : { right: position.right ?? "auto", left: "auto" }),
          }}
        >
          {USER_TYPES.map(({ id, name, description }) => (
            <button
              key={id}
              role="option"
              aria-selected={userType === id}
              type="button"
              onClick={() => {
                setUserType(id);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left transition-colors ${
                userType === id
                  ? "bg-neutral-100 dark:bg-neutral-800 text-foreground font-medium"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              <span className="block text-sm font-medium">{name}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {description}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
