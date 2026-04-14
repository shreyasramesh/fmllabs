"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ThinkingEstimateLabel } from "@/components/landing/brain-dump/EstimateThinkingLabel";
import { HighlightedQuickNoteText } from "@/components/landing/brain-dump/HighlightedQuickNoteText";
import { useTheme } from "@/components/ThemeProvider";
import {
  validateHighlightSegments,
} from "@/lib/quick-note-highlights";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";
import type { CalorieTrackingNutritionFacts } from "@/lib/gemini";

export type NutritionEstimateDetailItem = {
  name: string;
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
};

export type EntryEstimateModalMeta =
  | { status: "idle" }
  | { status: "thinking" }
  | {
      status: "done";
      calories: number | null;
      exerciseCaloriesBurned: number | null;
      sourceCount: number;
      confidence: string;
      intent: string;
      /** Set for local sleep preview metadata (no nutrition API). */
      sleepHours?: number | null;
      reasoning: string;
      assumptions: string[];
      nutritionItems: NutritionEstimateDetailItem[];
      nutritionNotes: string;
      exerciseNotes: string;
      proteinGrams: number | null;
      carbsGrams: number | null;
      fatGrams: number | null;
      facts?: CalorieTrackingNutritionFacts | null;
      confidenceScore: number;
      highlightSpans?: QuickNoteHighlightSegment[];
    };

function macroLabel(g: number | null, suffix: string): string {
  if (g == null || !Number.isFinite(g)) return "—";
  return `${Math.round(g * 10) / 10}${suffix}`;
}

function macroCaloriesLabel(grams: number | null, caloriesPerGram: number): string {
  if (grams == null || !Number.isFinite(grams)) return "—";
  return `${Math.round(grams * caloriesPerGram)} cal`;
}

function confidencePillMeta(confidence: string) {
  const normalized = confidence.trim().toLowerCase();
  if (normalized === "high") {
    return {
      label: "Solid",
      className:
        "border-[#D9E8BE]/80 bg-[#EEF6DE] text-[#3F6F15] dark:border-[#6D8E3A]/25 dark:bg-[#1C2813] dark:text-[#CBE89E]",
    };
  }
  if (normalized === "medium" || normalized === "moderate") {
    return {
      label: "Moderate",
      className:
        "border-[#F0DEB7]/80 bg-[#FBF0DA] text-[#9A6210] dark:border-[#A36C1D]/25 dark:bg-[#2C1F12] dark:text-[#F0CA87]",
    };
  }
  return {
    label: "Low",
    className:
      "border-[#E9D1CC]/80 bg-[#F8E8E4] text-[#9A4D3F] dark:border-[#8A4A3D]/25 dark:bg-[#2B1816] dark:text-[#E7B5AA]",
  };
}

export function EntryEstimateDetailModal({
  open,
  onClose,
  text,
  attemptedEstimate,
  meta,
}: {
  open: boolean;
  onClose: () => void;
  text: string;
  /** True when this line matched preview heuristics for an inline estimate or sleep summary. */
  attemptedEstimate: boolean;
  meta: EntryEstimateModalMeta;
}) {
  const [selectedHighlightReason, setSelectedHighlightReason] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSelectedHighlightReason(null);
    }
  }, [open]);

  const displayText = text.trim() || "—";
  const blockSegments = useMemo(() => {
    if (meta.status !== "done") return [];
    const t = text.trim();
    if (!t) return [];
    return validateHighlightSegments(t, meta.highlightSpans);
  }, [meta, text]);
  const shellClass = isDark
    ? "border-white/30 bg-[#111111]"
    : "border-neutral-200/75 bg-[var(--background)]";
  const dividerClass = isDark ? "border-white/18" : "border-neutral-200/70";
  const closeButtonClass = isDark
    ? "border-white/18 text-neutral-400 hover:bg-white/5"
    : "border-neutral-200/70 text-neutral-600 hover:bg-neutral-100";
  const quoteClass = isDark ? "bg-[#1A1A1A] text-neutral-100" : "bg-neutral-50 text-foreground";
  const noteClass = isDark
    ? "border-white/12 bg-[#181818] text-neutral-300"
    : "border-neutral-200/70 bg-white text-neutral-700";
  const macroPillClass = isDark
    ? "border-white/8 bg-[#181818] text-neutral-200"
    : "border-neutral-200/70 bg-neutral-50 text-neutral-700";
  const itemsListClass = isDark
    ? "divide-white/6 border-white/8 bg-[#141414]"
    : "divide-neutral-200/70 border-neutral-200/70 bg-transparent";

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex flex-col justify-end bg-black/35 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`pointer-events-auto flex min-h-0 max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-[1.25rem] border shadow-2xl sm:rounded-3xl ${shellClass} pb-[env(safe-area-inset-bottom,0px)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-estimate-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
          <div className={`flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 ${dividerClass}`}>
            <h2 id="entry-estimate-detail-title" className="text-lg font-semibold text-foreground">
              Entry details
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border transition-colors ${closeButtonClass}`}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <blockquote className={`mb-4 rounded-xl px-3 py-2.5 text-[17px] leading-snug ${quoteClass}`}>
              {meta.status === "done" ? (
                <HighlightedQuickNoteText
                  text={displayText}
                  segments={blockSegments}
                  as="p"
                  className="m-0 text-[17px] leading-snug text-foreground"
                  onHighlightPress={(segment) => {
                    setSelectedHighlightReason(segment.reason ?? null);
                  }}
                />
              ) : (
                displayText
              )}
            </blockquote>
            {selectedHighlightReason ? (
              <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${noteClass}`}>
                {selectedHighlightReason}
              </p>
            ) : null}

            {!attemptedEstimate && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No inline preview is available for this line yet. Saving still uses Gemini categorization for the final
                entry type.
              </p>
            )}

            {attemptedEstimate && meta.status === "thinking" && (
              <div className="flex justify-center py-2">
                <ThinkingEstimateLabel variant="prominent" />
              </div>
            )}

            {attemptedEstimate && meta.status === "idle" && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Preview unavailable right now. Saving still uses Gemini categorization for the final entry type.
              </p>
            )}

            {attemptedEstimate && meta.status === "done" && meta.intent === "sleep" ? (
              <div className="space-y-3 text-sm">
                <p className="text-xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {meta.sleepHours != null && meta.sleepHours > 0
                    ? `${Number.isInteger(meta.sleepHours) ? meta.sleepHours : Math.round(meta.sleepHours * 10) / 10} h`
                    : "Sleep"}
                </p>
                <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {meta.sleepHours != null && meta.sleepHours > 0
                    ? "This inline preview reads the duration in your note as sleep time. Saving still uses Gemini categorization."
                    : "This line looks like sleep for preview purposes. Add a duration (for example 7 hours) to show a clearer sleep preview."}
                </p>
              </div>
            ) : null}

            {attemptedEstimate && meta.status === "done" && meta.intent !== "sleep" ? (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {meta.exerciseCaloriesBurned != null && meta.exerciseCaloriesBurned > 0 ? (
                    <span className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      −{Math.round(meta.exerciseCaloriesBurned)} cal
                    </span>
                  ) : null}
                  {meta.calories != null ? (
                    <span className="text-xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {meta.exerciseCaloriesBurned != null && meta.exerciseCaloriesBurned > 0 ? "+" : null}
                      {Math.round(meta.calories)} cal
                    </span>
                  ) : meta.exerciseCaloriesBurned == null || meta.exerciseCaloriesBurned <= 0 ? (
                    <span className="text-neutral-500 dark:text-neutral-400">Calories unavailable</span>
                  ) : null}
                  <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                    Confidence:
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold ${confidencePillMeta(meta.confidence).className}`}
                  >
                    {confidencePillMeta(meta.confidence).label} ✓
                  </span>
                </div>

                {meta.exerciseNotes ? (
                  <p className="text-neutral-600 dark:text-neutral-400">{meta.exerciseNotes}</p>
                ) : null}

                {(meta.proteinGrams != null || meta.carbsGrams != null || meta.fatGrams != null) && (
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] ${macroPillClass}`}>
                      <span className="font-semibold">Protein</span>
                      <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                      <span className="tabular-nums">{macroLabel(meta.proteinGrams, "g")}</span>
                      <span className="mx-1 text-neutral-400 dark:text-neutral-500">/</span>
                      <span className="tabular-nums">{macroCaloriesLabel(meta.proteinGrams, 4)}</span>
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] ${macroPillClass}`}>
                      <span className="font-semibold">Carbs</span>
                      <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                      <span className="tabular-nums">{macroLabel(meta.carbsGrams, "g")}</span>
                      <span className="mx-1 text-neutral-400 dark:text-neutral-500">/</span>
                      <span className="tabular-nums">{macroCaloriesLabel(meta.carbsGrams, 4)}</span>
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] ${macroPillClass}`}>
                      <span className="font-semibold">Fat</span>
                      <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                      <span className="tabular-nums">{macroLabel(meta.fatGrams, "g")}</span>
                      <span className="mx-1 text-neutral-400 dark:text-neutral-500">/</span>
                      <span className="tabular-nums">{macroCaloriesLabel(meta.fatGrams, 9)}</span>
                    </span>
                  </div>
                )}

                {meta.nutritionNotes ? (
                  <p className="text-neutral-600 dark:text-neutral-400">{meta.nutritionNotes}</p>
                ) : null}

                {meta.reasoning ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      Reasoning
                    </p>
                    <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">{meta.reasoning}</p>
                  </div>
                ) : null}

                {meta.assumptions.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      Assumptions
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
                      {meta.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {meta.nutritionItems.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      Items ({meta.sourceCount} sources)
                    </p>
                    <ul className={`divide-y rounded-xl border ${itemsListClass}`}>
                      {meta.nutritionItems.map((item, i) => (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                            {item.calories != null ? `${Math.round(item.calories)} cal` : "—"}
                            {item.proteinGrams != null || item.carbsGrams != null || item.fatGrams != null
                              ? ` · Protein ${macroLabel(item.proteinGrams, "g")} (${macroCaloriesLabel(item.proteinGrams, 4)}) · Carbs ${macroLabel(item.carbsGrams, "g")} (${macroCaloriesLabel(item.carbsGrams, 4)}) · Fat ${macroLabel(item.fatGrams, "g")} (${macroCaloriesLabel(item.fatGrams, 9)})`
                              : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
    </div>,
    document.body
  );
}
