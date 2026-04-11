"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  NutritionAmyNoteBody,
  CaptureDraftSentenceRow,
  CapturePersistedEntryRow,
  AMY_JOURNAL_LIST_GRID,
  DeleteEntryIcon,
  NOTES_LIKE_TEXTAREA,
  type BrainDumpCaptureEntry,
} from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { SparklesIcon } from "@/components/SharedIcons";
import type { EntryEstimateModalMeta } from "@/components/landing/brain-dump/EntryEstimateDetailModal";
import { HighlightedQuickNoteText } from "@/components/landing/brain-dump/HighlightedQuickNoteText";
import { flushSentencesFromTyping } from "@/components/landing/brain-dump/sentence-entries";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";
import { EstimateThinkingHero } from "@/components/landing/brain-dump/EstimateThinkingLabel";
import {
  JOURNAL_CATEGORY_DOT_BASE,
  journalContextDotClass,
  journalTypeDotClass,
} from "@/components/landing/brain-dump/journal-category-tag-styles";

export {
  JOURNAL_CATEGORY_DOT_BASE,
  JOURNAL_CATEGORY_TAG_PILL_CLASS,
  journalContextDotClass,
  journalTypeDotClass,
} from "@/components/landing/brain-dump/journal-category-tag-styles";

/** Matches journal list chips in app/chat/journal/new/page.tsx */
export function journalTypeBadgeClass(cat: BrainDumpCategory): string {
  switch (cat) {
    case "nutrition":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    case "exercise":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "reflection":
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
    case "concept":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200";
    case "experiment":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200";
    case "weight":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200";
    case "sleep":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-200";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

export type BrainDumpJournalContextRowSource = "transcript" | "weight" | "sleep";

export interface BrainDumpJournalContextRow {
  id: string;
  /** Transcript vs native weight/sleep row (non-transcript rows skip transcript delete). */
  rowSource?: BrainDumpJournalContextRowSource;
  /** Same line(s) the user sees in capture — enriched entry or first journal line, not the Gemini title. */
  bodyText: string;
  /** Optional inline detail shown directly on the row. */
  secondaryText?: string;
  categoryLabel: string;
  journalCategory: "nutrition" | "exercise" | "spend" | "weight" | "sleep" | "reflection" | undefined;
  time: string;
  /** e.g. "420 cal" intake or "-180 cal" burn; null if unknown */
  caloriesSummary: string | null;
  /** Spend ($), weight (kg), or sleep (h) for the right rail; mutually exclusive with calories for those types. */
  metricSummary: string | null;
  /** Habit completion auto-journal: show a check on the right. */
  habitCompletionCheck?: boolean;
  /** Gemini-authored highlight spans for `bodyText`. */
  highlightSegments?: QuickNoteHighlightSegment[];
  /** Reflection / brain-dump transcript: show 1:1 mentor control. */
  showMentorCta?: boolean;
  /** For ordering in Quick Note stream (oldest → newest). */
  sortAtMs?: number;
}

function MentorHumansIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HabitDoneCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const NOTE_TITLE_CLS =
  "w-full border-0 border-b border-transparent bg-transparent pb-1.5 text-2xl font-semibold tracking-tight text-foreground placeholder:text-neutral-400 focus:border-neutral-200/80 focus:outline-none focus:ring-0 dark:focus:border-neutral-600";

const NOTE_BODY_CLS =
  `w-full min-h-[12rem] flex-1 resize-none border-0 bg-transparent text-[17px] leading-[1.55] text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:placeholder:text-neutral-500 ${NOTES_LIKE_TEXTAREA}`;

const INSET_GROUP_CLS =
  "overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-50/90 dark:border-neutral-700/80 dark:bg-neutral-800/40";

const INSET_ROW_CLS =
  "flex items-center gap-3 border-b border-neutral-200/70 px-3 py-2.5 last:border-b-0 dark:border-neutral-700/60";

type SheetPhase = "recording" | "categorizing" | "saving";

export interface BrainDumpFields {
  category: BrainDumpCategory;
  title: string;
  reflectionText?: string;
  conceptSummary?: string;
  conceptEnrichmentPrompt?: string;
  experimentDescription?: string;
  experimentHowTo?: string;
  experimentTips?: string;
  nutritionText?: string;
  exerciseText?: string;
  weightKg?: number;
  sleepHours?: number;
  hrvMs?: number | null;
}

interface CategoryMeta {
  label: string;
  color: string;
  icon: React.ReactNode;
}

interface BrainDumpSheetFrameProps {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  onBackdropClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  phase: SheetPhase;
  onClose: () => void;
  /** Recording / categorizing */
  onPrimaryCapture?: () => void;
  capturePrimaryDisabled?: boolean;
  capturePrimaryLabel?: string;
  children: React.ReactNode;
}

export function BrainDumpSheetFrame({
  overlayRef,
  onBackdropClick,
  phase,
  onClose,
  onPrimaryCapture,
  capturePrimaryDisabled,
  capturePrimaryLabel = "Done",
  children,
}: BrainDumpSheetFrameProps) {
  const isCapture = phase === "recording" || phase === "categorizing";
  const showCapturePrimary = isCapture && onPrimaryCapture && phase === "recording";

  return (
    <div
      ref={overlayRef as React.Ref<HTMLDivElement>}
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        data-brain-dump-dialog="true"
        aria-modal="true"
        aria-labelledby="brain-dump-sheet-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.25rem] border border-neutral-200/80 bg-[var(--background)] shadow-2xl dark:border-neutral-700/80 sm:h-auto sm:max-h-[min(92dvh,860px)] sm:rounded-3xl sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200/70 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:border-neutral-700/60 sm:px-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[15px] font-medium text-[#295a8a] dark:text-blue-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            Cancel
          </button>
          <h2 id="brain-dump-sheet-title" className="truncate text-center text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {phase === "categorizing" ? "Sorting your note…" : phase === "saving" ? "Saving…" : "Quick note"}
          </h2>
          <div className="flex w-[72px] justify-end">
            {showCapturePrimary ? (
              <button
                type="button"
                onClick={onPrimaryCapture}
                disabled={capturePrimaryDisabled}
                className="rounded-lg px-3 py-2 text-[15px] font-semibold text-[#295a8a] disabled:opacity-40 dark:text-blue-300"
              >
                {capturePrimaryLabel}
              </button>
            ) : (
              <span className="w-14" aria-hidden />
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}

const GHOST_OPEN_BTN =
  "appearance-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:focus-visible:ring-blue-400/30";

const JOURNAL_SECONDARY_TEXT_CLASS =
  "mt-0.5 block text-[11px] leading-snug text-emerald-700 dark:text-emerald-300";

function journalContextRowMetricToneClass(cat: BrainDumpJournalContextRow["journalCategory"]): string {
  if (cat === "spend") return "text-amber-700 dark:text-amber-300";
  if (cat === "sleep") return "text-indigo-600 dark:text-indigo-400";
  if (cat === "weight") return "text-teal-700 dark:text-teal-300";
  return "text-neutral-700 dark:text-neutral-200";
}

function isJournalContextRowDeletable(row: BrainDumpJournalContextRow): boolean {
  return (
    row.rowSource === undefined ||
    row.rowSource === "transcript" ||
    row.rowSource === "weight" ||
    row.rowSource === "sleep"
  );
}

const REFLECTION_NEW_CONV_BTN_BASE =
  "inline-flex items-center gap-1 rounded-full border border-[#B87B51]/45 bg-[#B87B51]/12 font-semibold text-[#7C522D] dark:border-[#D6A67E]/50 dark:bg-[#D6A67E]/15 dark:text-[#F3D6B7]";

function ReflectionBrainIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M12 18v-3" />
    </svg>
  );
}

/** Minimal sparkline for Quick Note weight (kg) or sleep (h) trend, oldest → newest. */
function MiniTrendSparkline({
  values,
  className,
  width = 52,
}: {
  values: number[];
  className?: string;
  width?: number;
}) {
  if (values.length === 0) return null;
  const w = width;
  const h = 18;
  const pad = 1.5;
  const vals = values.length === 1 ? [values[0]!, values[0]!] : values;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / Math.max(1, vals.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  });
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function JournalContextRowSheet({
  row,
  onOpenJournalContextEntry,
  onDeleteJournalContextEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
}: {
  row: BrainDumpJournalContextRow;
  onOpenJournalContextEntry?: (id: string) => void;
  onDeleteJournalContextEntry?: (id: string) => void;
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  /** Deep insights — opens chooser with response style + citation toggles (separate from 1:1). */
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  /** Recent weights for inline sparkline on weight rows (from tracker, oldest → newest). */
  weightTrendSparklineKg?: number[];
  /** Recent sleep hours for inline sparkline on sleep rows (oldest → newest). */
  sleepTrendSparklineHours?: number[];
}) {
  const sheetHighlightSegments = row.highlightSegments ?? [];
  const dotCls = journalContextDotClass(row.journalCategory);
  const burn = row.caloriesSummary?.startsWith("-");
  const open = () => onOpenJournalContextEntry?.(row.id);
  const hasCal = row.caloriesSummary != null && row.caloriesSummary !== "";
  const hasMetric = row.metricSummary != null && row.metricSummary !== "";
  const metricOnLeft =
    (row.journalCategory === "weight" || row.journalCategory === "sleep") && hasMetric;
  /** Nutrition / exercise: calories inline (minimal), not in the wide right rail. */
  const caloriesOnLeft =
    hasCal &&
    (row.journalCategory === "nutrition" || row.journalCategory === "exercise") &&
    !row.showMentorCta;
  const leftRailTrendValues =
    row.journalCategory === "weight"
      ? weightTrendSparklineKg
      : row.journalCategory === "sleep"
        ? sleepTrendSparklineHours
        : undefined;
  const effectiveHasMetric = hasMetric && !metricOnLeft;
  const effectiveHasCal = hasCal && !caloriesOnLeft;
  const showDash =
    !row.showMentorCta && !effectiveHasCal && !effectiveHasMetric && !row.habitCompletionCheck;
  const rightRail =
    row.showMentorCta && (onOpenReflectionConversationChooser || onOpenReflectionMentor) ? (
      <span className="inline-flex flex-row flex-wrap items-center justify-end gap-1">
        {onOpenReflectionConversationChooser ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenReflectionConversationChooser({ reflectionText: row.bodyText });
            }}
            className={`${REFLECTION_NEW_CONV_BTN_BASE} h-7 w-7 justify-center p-0`}
            aria-label="Deep insights — choose session style and metacognition"
          >
            <ReflectionBrainIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
          </button>
        ) : null}
        {onOpenReflectionMentor ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenReflectionMentor({ reflectionText: row.bodyText });
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[#295a8a]/35 bg-[#295a8a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#295a8a] dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-200"
            aria-label="1:1 mentor"
          >
            <MentorHumansIcon />
            <span>1:1</span>
          </button>
        ) : null}
      </span>
    ) : showDash ? (
    <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>
  ) : (
    <span className="inline-flex items-center justify-end gap-1.5">
      {effectiveHasCal ? (
        <span
          className={`inline-flex items-center gap-1 text-[15px] font-medium tabular-nums ${
            burn ? "text-emerald-600 dark:text-emerald-400" : "text-blue-500 dark:text-blue-400"
          }`}
        >
          <SparklesIcon className="h-4 w-4 shrink-0" />
          {row.caloriesSummary}
        </span>
      ) : null}
      {effectiveHasMetric ? (
        <span className={`text-[15px] font-medium tabular-nums ${journalContextRowMetricToneClass(row.journalCategory)}`}>
          {row.metricSummary}
        </span>
      ) : null}
      {row.habitCompletionCheck ? (
        <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400" title="Habit completed">
          <HabitDoneCheckIcon className="h-4 w-4" />
        </span>
      ) : null}
    </span>
  );
  const timeOnly = row.time ? (
    <span className="text-[7.7px] tabular-nums text-neutral-400 dark:text-neutral-500">{row.time}</span>
  ) : null;

  /** Weight / sleep / nutrition / exercise: one tight line; avoids 1fr grid dead space. */
  const compactPrimarySheet =
    !row.showMentorCta && (metricOnLeft || caloriesOnLeft);
  if (compactPrimarySheet) {
    if (caloriesOnLeft) {
      return (
        <div className="flex w-full items-start gap-2 py-1.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40">
          <button
            type="button"
            onClick={open}
            disabled={!onOpenJournalContextEntry}
            title={row.categoryLabel}
            className={`min-w-0 flex-1 text-left disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
          >
            <span className="flex items-start gap-2">
              <span className={`mt-[0.35rem] ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-1.5">
                  <HighlightedQuickNoteText
                    text={row.bodyText}
                    segments={sheetHighlightSegments}
                    as="span"
                    className="min-w-0 flex-1 text-[17px] leading-tight text-foreground"
                  />
                  {row.habitCompletionCheck ? (
                    <span
                      className="mt-[0.2rem] inline-flex shrink-0 text-emerald-600 dark:text-emerald-400"
                      title="Habit completed"
                    >
                      <HabitDoneCheckIcon className="h-4 w-4" />
                    </span>
                  ) : null}
                </span>
                {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
              </span>
            </span>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-0.5 self-start pt-0.5 text-right">
            <span
              className={`text-[14px] font-semibold tabular-nums leading-none ${
                burn ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {row.caloriesSummary}
            </span>
            {timeOnly}
          </div>
          <button
            type="button"
            onClick={() => void onDeleteJournalContextEntry?.(row.id)}
            disabled={!onDeleteJournalContextEntry || !isJournalContextRowDeletable(row)}
            className="shrink-0 self-start appearance-none rounded-lg border-0 bg-transparent p-1 pt-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
            aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
          >
            <DeleteEntryIcon />
          </button>
        </div>
      );
    }

    return (
      <div className="flex w-full items-center gap-2 py-1.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40">
        <button
          type="button"
          onClick={open}
          disabled={!onOpenJournalContextEntry}
          title={row.categoryLabel}
          className={`min-w-0 flex-1 text-left disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="inline-flex min-w-0 shrink-0 items-center gap-2">
                <span className={`${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
                <HighlightedQuickNoteText
                  text={row.bodyText}
                  segments={sheetHighlightSegments}
                  as="span"
                  className="min-w-0 shrink text-[17px] leading-tight text-foreground"
                />
                {metricOnLeft ? (
                  <span
                    className={`shrink-0 text-[13px] font-semibold tabular-nums ${journalContextRowMetricToneClass(row.journalCategory)}`}
                  >
                    {row.metricSummary}
                  </span>
                ) : null}
                {row.habitCompletionCheck ? (
                  <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400" title="Habit completed">
                    <HabitDoneCheckIcon className="h-4 w-4" />
                  </span>
                ) : null}
              </span>
              {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
            </span>
            {leftRailTrendValues && leftRailTrendValues.length > 0 ? (
              <MiniTrendSparkline
                values={leftRailTrendValues}
                width={132}
                className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
              />
            ) : null}
            {timeOnly}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void onDeleteJournalContextEntry?.(row.id)}
          disabled={!onDeleteJournalContextEntry || !isJournalContextRowDeletable(row)}
          className="ml-auto shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
          aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
        >
          <DeleteEntryIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${AMY_JOURNAL_LIST_GRID} py-1.5 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40`}
    >
      <button
        type="button"
        onClick={open}
        disabled={!onOpenJournalContextEntry}
        title={row.categoryLabel}
        className={`col-start-1 row-start-1 row-span-2 min-w-0 self-center text-left disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
      >
        <span className="flex items-start gap-2">
          <span className={`mt-[0.4rem] ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
          {metricOnLeft ? (
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <HighlightedQuickNoteText
                  text={row.bodyText}
                  segments={sheetHighlightSegments}
                  as="span"
                  className="shrink-0 text-[17px] leading-tight text-foreground whitespace-pre-wrap break-words"
                />
                <span
                  className={`shrink-0 text-[15px] font-semibold tabular-nums ${journalContextRowMetricToneClass(row.journalCategory)}`}
                >
                  {row.metricSummary}
                </span>
                {leftRailTrendValues && leftRailTrendValues.length > 0 ? (
                  <MiniTrendSparkline
                    values={leftRailTrendValues}
                    className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
                  />
                ) : null}
              </span>
              {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <HighlightedQuickNoteText
                text={row.bodyText}
                segments={sheetHighlightSegments}
                as="span"
                className="min-w-0 flex-1 text-[17px] leading-tight text-foreground whitespace-pre-wrap break-words"
              />
              {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
            </span>
          )}
        </span>
      </button>
      <div className="col-start-2 row-start-1 flex justify-end self-center text-right" aria-live="polite">
        {row.showMentorCta && (onOpenReflectionConversationChooser || onOpenReflectionMentor) ? (
          rightRail
        ) : (
          <button
            type="button"
            onClick={open}
            disabled={!onOpenJournalContextEntry}
            className={`max-w-[min(100%,12rem)] disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
          >
            {rightRail}
          </button>
        )}
      </div>
      {timeOnly ? (
        <button
          type="button"
          onClick={open}
          disabled={!onOpenJournalContextEntry}
          className={`col-start-2 row-start-2 justify-self-end self-end text-right disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
        >
          {timeOnly}
        </button>
      ) : (
        <span className="col-start-2 row-start-2 justify-self-end self-end" aria-hidden />
      )}
      <button
        type="button"
        onClick={() => void onDeleteJournalContextEntry?.(row.id)}
        disabled={!onDeleteJournalContextEntry || !isJournalContextRowDeletable(row)}
        className="col-start-3 row-start-1 row-span-2 justify-self-end self-center appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
        aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
      >
        <DeleteEntryIcon />
      </button>
    </div>
  );
}

/** Saved lines in Quick Note: body reads like freeform notes; category & details follow. */
function JournalContextRowNoteStream({
  row,
  onOpenJournalContextEntry,
  onDeleteJournalContextEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
}: {
  row: BrainDumpJournalContextRow;
  onOpenJournalContextEntry?: (id: string) => void;
  onDeleteJournalContextEntry?: (id: string) => void;
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  weightTrendSparklineKg?: number[];
  sleepTrendSparklineHours?: number[];
}) {
  const dotCls = journalContextDotClass(row.journalCategory);
  const burn = row.caloriesSummary?.startsWith("-");
  const open = () => onOpenJournalContextEntry?.(row.id);
  const hasCal = row.caloriesSummary != null && row.caloriesSummary !== "";
  const hasMetric = row.metricSummary != null && row.metricSummary !== "";
  const metricOnLeft =
    (row.journalCategory === "weight" || row.journalCategory === "sleep") && hasMetric;
  const caloriesOnLeft =
    hasCal &&
    (row.journalCategory === "nutrition" || row.journalCategory === "exercise") &&
    !row.showMentorCta;
  const leftRailTrendValues =
    row.journalCategory === "weight"
      ? weightTrendSparklineKg
      : row.journalCategory === "sleep"
        ? sleepTrendSparklineHours
        : undefined;
  const effectiveHasMetric = hasMetric && !metricOnLeft;
  const effectiveHasCal = hasCal && !caloriesOnLeft;
  const cal = effectiveHasCal ? (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums leading-none ${
        burn ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
      }`}
    >
      <SparklesIcon className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
      {row.caloriesSummary}
    </span>
  ) : null;
  const metric = effectiveHasMetric ? (
    <span
      className={`inline-flex text-[12px] font-medium tabular-nums leading-none ${journalContextRowMetricToneClass(row.journalCategory)}`}
    >
      {row.metricSummary}
    </span>
  ) : null;
  const habitCheck = row.habitCompletionCheck ? (
    <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400" title="Habit completed">
      <HabitDoneCheckIcon className="h-3.5 w-3.5" />
    </span>
  ) : null;
  const reflectionMentorActions =
    row.showMentorCta && (onOpenReflectionConversationChooser || onOpenReflectionMentor) ? (
      <span className="inline-flex shrink-0 flex-row flex-wrap items-center justify-end gap-1">
        {onOpenReflectionConversationChooser ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenReflectionConversationChooser({ reflectionText: row.bodyText });
            }}
            className={`${REFLECTION_NEW_CONV_BTN_BASE} h-6 w-6 shrink-0 justify-center p-0`}
            aria-label="Deep insights — choose session style and metacognition"
          >
            <ReflectionBrainIcon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          </button>
        ) : null}
        {onOpenReflectionMentor ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenReflectionMentor({ reflectionText: row.bodyText });
            }}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#295a8a]/35 bg-[#295a8a]/10 px-1.5 py-px text-[10px] font-semibold text-[#295a8a] dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-200"
            aria-label="1:1 mentor"
          >
            <MentorHumansIcon className="h-3 w-3" />
            1:1
          </button>
        ) : null}
      </span>
    ) : null;

  const rawDisplay = row.bodyText.trim();
  const singleLineForHighlights = rawDisplay.replace(/\s+/g, " ").trim();
  const canHighlight = rawDisplay.length > 0 && !/[\r\n]/.test(rawDisplay);
  const highlightSegments = canHighlight ? (row.highlightSegments ?? []) : [];

  const compactPrimaryStream =
    !row.showMentorCta && (metricOnLeft || caloriesOnLeft);
  if (compactPrimaryStream && rawDisplay) {
    if (caloriesOnLeft) {
      return (
        <article className="mb-3 min-w-0">
          <div className="flex w-full items-start gap-2">
            <button
              type="button"
              onClick={open}
              disabled={!onOpenJournalContextEntry}
              title={`${row.categoryLabel}: ${row.bodyText}`}
              className={`min-w-0 flex-1 text-left disabled:cursor-default ${GHOST_OPEN_BTN}`}
            >
              <span className="flex items-start gap-2 text-[16px] leading-snug">
                <span className={`mt-[0.35rem] ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start gap-1.5">
                    {canHighlight ? (
                      <HighlightedQuickNoteText
                        text={singleLineForHighlights}
                        segments={highlightSegments}
                        className="min-w-0 flex-1 whitespace-normal break-words text-[16px] leading-snug text-foreground"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{rawDisplay}</span>
                    )}
                    {row.habitCompletionCheck ? (
                      <span
                        className="mt-[0.15rem] inline-flex shrink-0 text-emerald-600 dark:text-emerald-400"
                        title="Habit completed"
                      >
                        <HabitDoneCheckIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </span>
                  {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-0.5 self-start pt-0.5 text-right">
              <span
                className={`text-[12px] font-semibold tabular-nums leading-none ${
                  burn ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {row.caloriesSummary}
              </span>
              {row.time ? (
                <span className="text-[7px] tabular-nums text-neutral-400 dark:text-neutral-500">
                  {row.time}
                </span>
              ) : null}
            </div>
            {onDeleteJournalContextEntry && isJournalContextRowDeletable(row) ? (
              <button
                type="button"
                onClick={() => void onDeleteJournalContextEntry(row.id)}
                className="shrink-0 self-start appearance-none rounded-md border-0 bg-transparent p-0.5 pt-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
                aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
              >
                <DeleteEntryIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </article>
      );
    }

    return (
      <article className="mb-3 min-w-0">
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={open}
            disabled={!onOpenJournalContextEntry}
            title={`${row.categoryLabel}: ${row.bodyText}`}
            className={`min-w-0 flex-1 text-left disabled:cursor-default ${GHOST_OPEN_BTN}`}
          >
            <span className="flex min-w-0 items-center gap-2 text-[16px] leading-snug">
              <span className="min-w-0 flex-1">
                <span className="inline-flex min-w-0 shrink-0 items-center gap-2">
                  <span className={`${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
                  {canHighlight ? (
                    <HighlightedQuickNoteText
                      text={singleLineForHighlights}
                      segments={highlightSegments}
                      className="min-w-0 shrink whitespace-normal break-words text-[16px] leading-snug text-foreground"
                    />
                  ) : (
                    <span className="min-w-0 shrink whitespace-pre-wrap break-words">{rawDisplay}</span>
                  )}
                  {metricOnLeft ? (
                    <span
                      className={`shrink-0 text-[12px] font-semibold tabular-nums leading-none ${journalContextRowMetricToneClass(row.journalCategory)}`}
                    >
                      {row.metricSummary}
                    </span>
                  ) : null}
                  {row.habitCompletionCheck ? (
                    <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400" title="Habit completed">
                      <HabitDoneCheckIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </span>
                {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
              </span>
              {leftRailTrendValues && leftRailTrendValues.length > 0 ? (
                <MiniTrendSparkline
                  values={leftRailTrendValues}
                  width={144}
                  className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
                />
              ) : null}
              {row.time ? (
                <span className="shrink-0 text-[7px] tabular-nums text-neutral-400 dark:text-neutral-500">
                  {row.time}
                </span>
              ) : null}
            </span>
          </button>
          {onDeleteJournalContextEntry && isJournalContextRowDeletable(row) ? (
            <button
              type="button"
              onClick={() => void onDeleteJournalContextEntry(row.id)}
              className="ml-auto shrink-0 appearance-none rounded-md border-0 bg-transparent p-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
              aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
            >
              <DeleteEntryIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="mb-3 min-w-0">
      <button
        type="button"
        onClick={open}
        disabled={!onOpenJournalContextEntry}
        title={rawDisplay ? `${row.categoryLabel}: ${row.bodyText}` : row.categoryLabel}
        className={`flex w-full items-start gap-2 text-left text-[16px] leading-snug text-foreground disabled:cursor-default ${GHOST_OPEN_BTN}`}
      >
        <span className={`mt-[0.35rem] ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
        <span className="min-w-0 flex-1">
          {metricOnLeft && rawDisplay ? (
            <>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {canHighlight ? (
                  <HighlightedQuickNoteText
                    text={singleLineForHighlights}
                    segments={highlightSegments}
                    className="shrink-0 whitespace-normal break-words text-[16px] leading-snug text-foreground"
                  />
                ) : (
                  <span className="shrink-0 whitespace-pre-wrap break-words text-[16px] leading-snug">{rawDisplay}</span>
                )}
                <span
                  className={`shrink-0 text-[13px] font-semibold tabular-nums leading-none ${journalContextRowMetricToneClass(row.journalCategory)}`}
                >
                  {row.metricSummary}
                </span>
                {leftRailTrendValues && leftRailTrendValues.length > 0 ? (
                  <MiniTrendSparkline
                    values={leftRailTrendValues}
                    className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
                  />
                ) : null}
              </span>
              {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
            </>
          ) : rawDisplay ? (
            <>
              {canHighlight ? (
                <HighlightedQuickNoteText
                  text={singleLineForHighlights}
                  segments={highlightSegments}
                  className="whitespace-normal break-words text-[16px] leading-snug text-foreground"
                />
              ) : (
                <span className="block whitespace-pre-wrap break-words">{rawDisplay}</span>
              )}
              {row.secondaryText ? <span className={JOURNAL_SECONDARY_TEXT_CLASS}>{row.secondaryText}</span> : null}
            </>
          ) : (
            "—"
          )}
        </span>
      </button>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {reflectionMentorActions}
        {cal ? (
          <button
            type="button"
            onClick={open}
            disabled={!onOpenJournalContextEntry}
            className={`shrink-0 disabled:cursor-default ${GHOST_OPEN_BTN}`}
          >
            {cal}
          </button>
        ) : null}
        {metric ? (
          <button
            type="button"
            onClick={open}
            disabled={!onOpenJournalContextEntry}
            className={`shrink-0 disabled:cursor-default ${GHOST_OPEN_BTN}`}
          >
            {metric}
          </button>
        ) : null}
        {habitCheck}
        {row.time ? (
          <span className="shrink-0 text-[7px] tabular-nums text-neutral-400 dark:text-neutral-500">{row.time}</span>
        ) : null}
        {onDeleteJournalContextEntry && isJournalContextRowDeletable(row) ? (
          <button
            type="button"
            onClick={() => void onDeleteJournalContextEntry(row.id)}
            className="shrink-0 appearance-none rounded-md border-0 bg-transparent p-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
            aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
          >
            <DeleteEntryIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

interface CaptureViewProps {
  captureEntries: BrainDumpCaptureEntry[];
  setCaptureEntries: React.Dispatch<React.SetStateAction<BrainDumpCaptureEntry[]>>;
  sentenceDraft: string;
  setSentenceDraft: React.Dispatch<React.SetStateAction<string>>;
  phase: "recording" | "categorizing";
  /** When the draft is empty, Enter runs categorize + save (same as Done). */
  onRequestFinishNote?: () => void;
  /** Journal rows already saved for the landing dashboard day (read-only context). */
  journalContextRows?: BrainDumpJournalContextRow[];
  onOpenJournalContextEntry?: (id: string) => void;
  onDeleteJournalContextEntry?: (id: string) => void;
  /** Opens 1:1 mentor picker (reflection / brain-dump rows). */
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  /** Deep insights (conversation chooser) — response style, metacognition + citations (separate from 1:1). */
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  /** Modal sheet vs mobile full-tab layout. */
  layout?: "sheet" | "fullScreen";
  /** Mobile Quick Note: Enter saves one line via Gemini (no local row first). */
  saveLineOnEnter?: boolean;
  onSaveLine?: (text: string, frozenMeta: EntryEstimateModalMeta) => Promise<void>;
  lineSaveBusy?: boolean;
  /** Recent weight samples (kg) for sparkline on weight rows; oldest → newest. */
  weightTrendSparklineKg?: number[];
  /** Recent sleep hours for sparkline on sleep rows; oldest → newest. */
  sleepTrendSparklineHours?: number[];
}

export function BrainDumpCaptureView({
  captureEntries,
  setCaptureEntries,
  sentenceDraft,
  setSentenceDraft,
  phase,
  onRequestFinishNote,
  journalContextRows = [],
  onOpenJournalContextEntry,
  onDeleteJournalContextEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  layout = "sheet",
  saveLineOnEnter = false,
  onSaveLine,
  lineSaveBusy = false,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
}: CaptureViewProps) {
  const draftMetaRef = useRef<EntryEstimateModalMeta>({ status: "idle" });
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const syncDraftMeta = useCallback((m: EntryEstimateModalMeta) => {
    draftMetaRef.current = m;
  }, []);

  const full = layout === "fullScreen";
  const quickNoteStreamEndRef = useRef<HTMLDivElement>(null);
  const prevJournalCountRef = useRef<number | null>(null);

  const journalRowsOrdered = React.useMemo(() => {
    if (journalContextRows.length === 0) return journalContextRows;
    const withKey = journalContextRows.map((r) => ({
      row: r,
      ms: r.sortAtMs ?? 0,
    }));
    const allHaveMs = withKey.every((x) => x.ms > 0);
    if (allHaveMs) {
      return [...withKey].sort((a, b) => a.ms - b.ms).map((x) => x.row);
    }
    return journalContextRows;
  }, [journalContextRows]);

  useLayoutEffect(() => {
    if (!full) return;
    quickNoteStreamEndRef.current?.scrollIntoView({ block: "end" });
  }, [full]);

  useLayoutEffect(() => {
    if (!full) return;
    const prev = prevJournalCountRef.current;
    if (prev != null && journalContextRows.length > prev) {
      quickNoteStreamEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
    prevJournalCountRef.current = journalContextRows.length;
  }, [full, journalContextRows.length]);

  if (phase === "categorizing" && !saveLineOnEnter) {
    return <EstimateThinkingHero />;
  }

  const handleDraftValue = (raw: string) => {
    if (saveLineOnEnter) {
      setSentenceDraft(raw);
      return;
    }
    const { commits, rest } = flushSentencesFromTyping(raw);
    if (commits.length > 0) {
      const snap = draftMetaRef.current;
      setCaptureEntries((prev) => [
        ...prev,
        ...commits.map((t) => ({
          id: crypto.randomUUID(),
          text: t,
          frozenMeta: commits.length === 1 ? snap : { status: "idle" as const },
        })),
      ]);
      setSentenceDraft(rest);
    } else {
      setSentenceDraft(raw);
    }
  };

  const commitDraftOnEnter = () => {
    void (async () => {
      const t = sentenceDraft.trim();
      if (saveLineOnEnter) {
        if (t && onSaveLine) {
          await onSaveLine(t, draftMetaRef.current);
          setSentenceDraft("");
        }
        return;
      }
      if (t) {
        const snap = draftMetaRef.current;
        setCaptureEntries((prev) => [...prev, { id: crypto.randomUUID(), text: t, frozenMeta: snap }]);
        setSentenceDraft("");
        return;
      }
      onRequestFinishNote?.();
    })();
  };

  const removeEntry = (id: string) => {
    setCaptureEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const journalRowsSheet =
    journalRowsOrdered.length > 0 ? (
      <div className="pb-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
          Today on your journal
        </p>
        {journalRowsOrdered.map((row) => (
          <JournalContextRowSheet
            key={row.id}
            row={row}
            onOpenJournalContextEntry={onOpenJournalContextEntry}
            onDeleteJournalContextEntry={onDeleteJournalContextEntry}
            onOpenReflectionMentor={onOpenReflectionMentor}
            onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
            weightTrendSparklineKg={weightTrendSparklineKg}
            sleepTrendSparklineHours={sleepTrendSparklineHours}
          />
        ))}
      </div>
    ) : null;

  if (full) {
    return (
      <>
        <div className="flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom,0px))] min-h-0 w-full flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-24 [-webkit-overflow-scrolling:touch]">
            {journalRowsOrdered.map((row) => (
              <JournalContextRowNoteStream
                key={row.id}
                row={row}
                onOpenJournalContextEntry={onOpenJournalContextEntry}
                onDeleteJournalContextEntry={onDeleteJournalContextEntry}
                onOpenReflectionMentor={onOpenReflectionMentor}
                onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
                weightTrendSparklineKg={weightTrendSparklineKg}
                sleepTrendSparklineHours={sleepTrendSparklineHours}
              />
            ))}
            {!saveLineOnEnter
              ? captureEntries.map((entry) => (
                  <div key={entry.id} className="mb-3">
                    <CapturePersistedEntryRow entry={entry} onDelete={removeEntry} />
                  </div>
                ))
              : null}
            <div
              className={
                journalRowsOrdered.length > 0 || (!saveLineOnEnter && captureEntries.length > 0)
                  ? "mt-2"
                  : undefined
              }
            >
              <CaptureDraftSentenceRow
                draft={sentenceDraft}
                onDraftValue={handleDraftValue}
                onEnterCommit={commitDraftOnEnter}
                onMetaChange={syncDraftMeta}
                disabled={lineSaveBusy}
                variant="fullScreen"
                showEstimateDetailTap
                textAreaRef={draftTextareaRef}
              />
            </div>
            <div ref={quickNoteStreamEndRef} className="h-px w-full shrink-0 scroll-mt-12" aria-hidden />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Type and we&apos;ll file it in the right journal. Enter commits a line; Enter on an empty line (or Done) saves
        immediately — no review screen.
      </p>
      <div
        className="min-h-[min(52dvh,360px)] flex-1 overflow-y-auto rounded-xl bg-white/60 px-3 py-2 pb-24 dark:bg-neutral-900/25"
        role="list"
      >
        {journalRowsSheet}
        {captureEntries.map((entry) => (
          <CapturePersistedEntryRow key={entry.id} entry={entry} onDelete={removeEntry} />
        ))}
        <CaptureDraftSentenceRow
          draft={sentenceDraft}
          onDraftValue={handleDraftValue}
          onEnterCommit={commitDraftOnEnter}
          onMetaChange={syncDraftMeta}
          textAreaRef={draftTextareaRef}
        />
      </div>
    </div>
  );
}

interface ReviewViewProps {
  fields: BrainDumpFields;
  setFields: React.Dispatch<React.SetStateAction<BrainDumpFields | null>>;
  disabled: boolean;
  allCategories: BrainDumpCategory[];
  categoryMeta: Record<BrainDumpCategory, CategoryMeta>;
  onSwitchCategory: (cat: BrainDumpCategory) => void;
}

export function BrainDumpReviewView({
  fields,
  setFields,
  disabled,
  allCategories,
  categoryMeta,
  onSwitchCategory,
}: ReviewViewProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => titleInputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, []);

  const cat = fields.category;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <span className={`${JOURNAL_CATEGORY_DOT_BASE} ${journalTypeDotClass(cat)}`} aria-hidden />
          {categoryMeta[cat].label}
        </span>
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Tap below to change type</span>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {allCategories.map((c) => {
          const meta = categoryMeta[c];
          const active = fields.category === c;
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onSwitchCategory(c)}
              className={`flex shrink-0 items-center gap-1 rounded-full text-[10px] font-medium transition-colors ${
                active
                  ? "px-2 py-1 bg-neutral-100 text-foreground ring-2 ring-offset-1 ring-offset-[var(--background)] ring-neutral-400/50 dark:bg-neutral-800 dark:ring-neutral-500"
                  : "bg-neutral-100/90 px-2.5 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200/90 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/80"
              }`}
            >
              <span className={`${JOURNAL_CATEGORY_DOT_BASE} ${journalTypeDotClass(c)}`} aria-hidden />
              {meta.icon}
              {meta.label}
            </button>
          );
        })}
      </div>

      <input
        ref={titleInputRef}
        type="text"
        value={fields.title}
        onChange={(e) => setFields({ ...fields, title: e.target.value })}
        disabled={disabled}
        placeholder="Title"
        className={NOTE_TITLE_CLS}
        aria-label="Note title"
      />

      {cat === "reflection" && (
        <textarea
          value={fields.reflectionText ?? ""}
          onChange={(e) => setFields({ ...fields, reflectionText: e.target.value })}
          disabled={disabled}
          placeholder="Journal entry"
          className={NOTE_BODY_CLS}
          rows={12}
          aria-label="Reflection"
        />
      )}

      {cat === "nutrition" && (
        <NutritionAmyNoteBody
          value={fields.nutritionText ?? ""}
          onChange={(next) => setFields({ ...fields, nutritionText: next })}
          disabled={disabled}
          aria-label="Nutrition log"
        />
      )}

      {cat === "exercise" && (
        <textarea
          value={fields.exerciseText ?? ""}
          onChange={(e) => setFields({ ...fields, exerciseText: e.target.value })}
          disabled={disabled}
          placeholder="Describe your workout"
          className={NOTE_BODY_CLS}
          rows={12}
          aria-label="Exercise log"
        />
      )}

      {cat === "concept" && (
        <>
          <textarea
            value={fields.conceptSummary ?? ""}
            onChange={(e) => setFields({ ...fields, conceptSummary: e.target.value })}
            disabled={disabled}
            placeholder="Concept summary"
            className={NOTE_BODY_CLS}
            rows={10}
            aria-label="Concept summary"
          />
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/80">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEnrichmentOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-neutral-600 dark:text-neutral-300"
              aria-expanded={enrichmentOpen}
            >
              Coach enrichment prompt
              <span className="text-neutral-400">{enrichmentOpen ? "−" : "+"}</span>
            </button>
            {enrichmentOpen ? (
              <div className="border-t border-neutral-200/80 px-3 py-2 dark:border-neutral-700/80">
                <textarea
                  value={fields.conceptEnrichmentPrompt ?? ""}
                  onChange={(e) => setFields({ ...fields, conceptEnrichmentPrompt: e.target.value })}
                  disabled={disabled}
                  rows={3}
                  className="w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-foreground placeholder:text-neutral-400 focus:outline-none"
                  placeholder="When should your coach use this idea?"
                />
              </div>
            ) : null}
          </div>
        </>
      )}

      {cat === "experiment" && (
        <div className="space-y-4">
          <section>
            <p className="mb-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">Description</p>
            <textarea
              value={fields.experimentDescription ?? ""}
              onChange={(e) => setFields({ ...fields, experimentDescription: e.target.value })}
              disabled={disabled}
              rows={4}
              className={`${NOTE_BODY_CLS} min-h-[5rem]`}
            />
          </section>
          <section className={INSET_GROUP_CLS}>
            <div className={INSET_ROW_CLS + " flex-col items-stretch"}>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">How to follow through</p>
              <textarea
                value={fields.experimentHowTo ?? ""}
                onChange={(e) => setFields({ ...fields, experimentHowTo: e.target.value })}
                disabled={disabled}
                rows={4}
                className="mt-1 w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed focus:outline-none"
              />
            </div>
            <div className={INSET_ROW_CLS + " flex-col items-stretch"}>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Tips</p>
              <textarea
                value={fields.experimentTips ?? ""}
                onChange={(e) => setFields({ ...fields, experimentTips: e.target.value })}
                disabled={disabled}
                rows={4}
                className="mt-1 w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed focus:outline-none"
              />
            </div>
          </section>
        </div>
      )}

      {cat === "weight" && (
        <div className={INSET_GROUP_CLS}>
          <div className={INSET_ROW_CLS}>
            <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">Weight</span>
            <input
              type="number"
              step="0.1"
              min="20"
              max="400"
              value={fields.weightKg ?? ""}
              onChange={(e) =>
                setFields({
                  ...fields,
                  weightKg: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              disabled={disabled}
              className="w-28 border-0 bg-transparent text-right text-[17px] font-medium tabular-nums focus:outline-none"
              aria-label="Weight in kg"
            />
            <span className="text-sm text-neutral-400">kg</span>
          </div>
        </div>
      )}

      {cat === "sleep" && (
        <div className={INSET_GROUP_CLS}>
          <label className={INSET_ROW_CLS}>
            <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">Hours slept</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={fields.sleepHours ?? ""}
              onChange={(e) =>
                setFields({
                  ...fields,
                  sleepHours: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              disabled={disabled}
              className="w-24 border-0 bg-transparent text-right text-[17px] font-medium tabular-nums focus:outline-none"
            />
          </label>
          <label className={INSET_ROW_CLS}>
            <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">HRV (optional)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={fields.hrvMs ?? ""}
              onChange={(e) =>
                setFields({
                  ...fields,
                  hrvMs: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              disabled={disabled}
              className="w-24 border-0 bg-transparent text-right text-[17px] font-medium tabular-nums focus:outline-none"
              placeholder="—"
            />
            <span className="text-xs text-neutral-400">ms</span>
          </label>
        </div>
      )}

      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
        Discard changes with Cancel above.
      </p>
    </div>
  );
}
