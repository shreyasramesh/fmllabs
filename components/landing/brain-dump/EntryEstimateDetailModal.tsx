"use client";

import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ThinkingEstimateLabel } from "@/components/landing/brain-dump/EstimateThinkingLabel";
import { HighlightedQuickNoteText } from "@/components/landing/brain-dump/HighlightedQuickNoteText";
import {
  buildQuickNoteHighlightSegments,
  validateHighlightSegments,
} from "@/lib/quick-note-highlights";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";

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
      /** Set for local sleep summary (no nutrition API). */
      sleepHours?: number | null;
      reasoning: string;
      assumptions: string[];
      nutritionItems: NutritionEstimateDetailItem[];
      nutritionNotes: string;
      exerciseNotes: string;
      proteinGrams: number | null;
      carbsGrams: number | null;
      fatGrams: number | null;
      confidenceScore: number;
      highlightSpans?: QuickNoteHighlightSegment[];
    };

function macroLabel(g: number | null, suffix: string): string {
  if (g == null || !Number.isFinite(g)) return "—";
  return `${Math.round(g * 10) / 10}${suffix}`;
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
  /** True when this line matched food, exercise, or sleep heuristics (estimate or local summary). */
  attemptedEstimate: boolean;
  meta: EntryEstimateModalMeta;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const displayText = text.trim() || "—";
  const blockSegments = useMemo(() => {
    if (meta.status !== "done") return [];
    const t = text.trim();
    if (!t) return [];
    if (meta.highlightSpans?.length) {
      return validateHighlightSegments(t, meta.highlightSpans);
    }
    return buildQuickNoteHighlightSegments(t, {
      nutritionItemNames: meta.nutritionItems.map((i) => i.name),
    });
  }, [meta, text]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[65] bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
        aria-hidden
      >
        <div
          className="pointer-events-auto flex max-h-[min(85dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-neutral-200/90 bg-[var(--background)] shadow-2xl dark:border-neutral-700/80"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-estimate-detail-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200/80 px-4 py-3 dark:border-neutral-800">
            <h2 id="entry-estimate-detail-title" className="text-lg font-semibold text-foreground">
              Entry details
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <blockquote className="mb-4 rounded-xl bg-neutral-50 px-3 py-2.5 text-[17px] leading-snug text-foreground dark:bg-neutral-800/60">
              {meta.status === "done" ? (
                <HighlightedQuickNoteText
                  text={displayText}
                  segments={blockSegments}
                  as="p"
                  className="m-0 text-[17px] leading-snug text-foreground"
                />
              ) : (
                displayText
              )}
            </blockquote>

            {!attemptedEstimate && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                This line didn&apos;t match food, activity, or sleep wording, so no summary was shown. You can still edit
                it in your note.
              </p>
            )}

            {attemptedEstimate && meta.status === "thinking" && (
              <div className="flex justify-center py-2">
                <ThinkingEstimateLabel variant="prominent" />
              </div>
            )}

            {attemptedEstimate && meta.status === "idle" && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No estimate yet. Try again in a moment.
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
                    ? "This line is summarized as sleep from the duration in your note (not a calorie estimate)."
                    : "This line looks like sleep. Add a duration (for example 7 hours) to log time asleep more clearly."}
                </p>
              </div>
            ) : null}

            {attemptedEstimate && meta.status === "done" && meta.intent !== "sleep" ? (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {meta.confidence} confidence
                    {typeof meta.confidenceScore === "number" ? ` · ${meta.confidenceScore}/100` : null}
                  </span>
                </div>

                {meta.exerciseNotes ? (
                  <p className="text-neutral-600 dark:text-neutral-400">{meta.exerciseNotes}</p>
                ) : null}

                {(meta.proteinGrams != null || meta.carbsGrams != null || meta.fatGrams != null) && (
                  <p className="tabular-nums text-neutral-700 dark:text-neutral-300">
                    P {macroLabel(meta.proteinGrams, "g")} · C {macroLabel(meta.carbsGrams, "g")} · F{" "}
                    {macroLabel(meta.fatGrams, "g")}
                  </p>
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
                    <ul className="divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/80 dark:divide-neutral-700/60 dark:border-neutral-700/60">
                      {meta.nutritionItems.map((item, i) => (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                            {item.calories != null ? `${Math.round(item.calories)} cal` : "—"}
                            {item.proteinGrams != null || item.carbsGrams != null || item.fatGrams != null
                              ? ` · P ${macroLabel(item.proteinGrams, "g")} · C ${macroLabel(item.carbsGrams, "g")} · F ${macroLabel(
                                  item.fatGrams,
                                  "g"
                                )}`
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
      </div>
    </>,
    document.body
  );
}
