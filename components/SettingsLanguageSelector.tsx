"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";
import {
  LANGUAGES,
  LANGUAGE_REGIONS,
  getLanguageName,
} from "@/lib/languages";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

const langCodeSet = new Set(LANGUAGES.map((l) => l.code));

export function SettingsLanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regionsWithLangs = LANGUAGE_REGIONS.map((r) => ({
    ...r,
    languages: r.languages.filter((c) => langCodeSet.has(c)),
  })).filter((r) => r.languages.length > 0);

  useEffect(() => {
    const region = LANGUAGE_REGIONS.find((r) =>
      r.languages.includes(language) && langCodeSet.has(language)
    );
    if (region) setSelectedRegion(region.id);
  }, [language]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <GlobeIcon className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Tap a region
          </span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">→</span>
          <span className="px-2.5 py-1 rounded-lg text-sm font-medium bg-foreground/10 dark:bg-foreground/15 text-foreground border border-foreground/20">
            {getLanguageName(language)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {regionsWithLangs.map((region) => {
          const isExpanded = selectedRegion === region.id;
          const hasSelected = region.languages.includes(language);
          return (
            <div key={region.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedRegion(isExpanded ? null : region.id)
                }
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                  isExpanded || hasSelected
                    ? "bg-foreground/10 dark:bg-foreground/15 border-2 border-foreground/30 dark:border-foreground/40"
                    : "bg-foreground/10 dark:bg-foreground/15 hover:bg-foreground/15 dark:hover:bg-foreground/20 border-2 border-transparent"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {region.icon}
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {region.label}
                </span>
                {hasSelected && (
                  <span className="ml-auto text-xs text-foreground/70">
                    ✓
                  </span>
                )}
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-1 pl-0.5">
                  {region.languages.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLanguage(code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        language === code
                          ? "bg-foreground text-background"
                          : "bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                      }`}
                    >
                      {getLanguageName(code)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
