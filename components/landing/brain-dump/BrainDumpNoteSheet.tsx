"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { BrainDumpCategory } from "@/lib/gemini";
import { BrainDumpImageIngestBar } from "@/components/landing/brain-dump/BrainDumpImageIngestBar";
import type { JournalImageAnalysis, JournalImageAutoKind } from "@/lib/journal-image-analysis";
import {
  JOURNAL_IMAGE_ANALYSES_BRIDGE_EVENT,
  type JournalImageAnalysesBridgeDetail,
} from "@/lib/journal-image-analyses-bridge";
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
import { flushSentencesFromTyping, normalizeQuickNoteBodyForMatch } from "@/components/landing/brain-dump/sentence-entries";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";
import { SleepDurationPicker } from "@/components/landing/SleepDurationPicker";
import { roundSleepHoursToMinute } from "@/lib/sleep-duration";
import {
  JOURNAL_CATEGORY_DOT_BASE,
  journalContextDotClass,
  journalTypeDotClass,
} from "@/components/landing/brain-dump/journal-category-tag-styles";
import type { LandingHabitCompletionMap } from "@/components/landing/types";
import {
  WELLNESS_CATEGORIES,
  WELLNESS_CATEGORY_META,
  NUDGES_BY_CATEGORY,
  type WellnessCategory,
  type WellnessNudge,
} from "@/lib/wellness-nudges";

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

export interface QuickNoteDaySummary {
  intakeCal: number;
  burnCal: number;
  netCal: number;
  latestWeightKg: number | null;
  totalSleepH: number | null;
  hasCalories: boolean;
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
  /** Habits the user has tagged this entry to. */
  habitTags?: string[];
  /** Gemini-authored highlight spans for `bodyText`. */
  highlightSegments?: QuickNoteHighlightSegment[];
  /** Reflection / brain-dump transcript: show 1:1 mentor control. */
  showMentorCta?: boolean;
  /** For ordering in Quick Note stream (oldest → newest). */
  sortAtMs?: number;
  /** Raw hour (0-23) from journalEntryHour — used to pre-populate the time editor. */
  entryHour?: number;
  /** Raw minute (0-59) from journalEntryMinute — used to pre-populate the time editor. */
  entryMinute?: number;
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
  onPrimaryCapture: _onPrimaryCapture,
  capturePrimaryDisabled: _capturePrimaryDisabled,
  capturePrimaryLabel: _capturePrimaryLabel = "Done",
  children,
}: BrainDumpSheetFrameProps) {
  const titleText =
    phase === "categorizing" ? "Sorting your note…" : phase === "saving" ? "Saving…" : "Quick note";

  const closeIconBtn = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      aria-label="Close"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );

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
        <header className="flex shrink-0 items-center justify-end gap-2 border-b border-neutral-200/70 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:border-neutral-700/60 sm:px-3 sm:py-2.5">
          <h2 id="brain-dump-sheet-title" className="sr-only">
            {titleText}
          </h2>
          {closeIconBtn}
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
  "mt-0.5 text-[11px] leading-snug text-emerald-700 dark:text-emerald-300";

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

function shouldKeepJournalContextTitleInline(cat: BrainDumpJournalContextRow["journalCategory"]): boolean {
  return cat === "weight" || cat === "sleep";
}

const REFLECTION_NEW_CONV_BTN_BASE =
  "inline-flex items-center gap-1 rounded-full border border-[#c96442]/45 bg-[#c96442]/12 font-semibold text-[#4d4c48] dark:border-[#d97757]/50 dark:bg-[#d97757]/15 dark:text-[#b0aea5]";
const REFLECTION_ACTION_PILL_BASE =
  "inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
const REFLECTION_ACTION_PILL_WIDE = "h-7 w-[4.6rem]";
const REFLECTION_ACTION_PILL_COMPACT = "h-6 w-[4rem] text-[10px]";
const REFLECTION_MENTOR_BTN_BASE =
  "border border-[#295a8a]/35 bg-[#295a8a]/10 text-[#295a8a] dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-200";

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
  kind,
  className,
  width = 88,
  compact = false,
}: {
  values: number[];
  kind: "weight" | "sleep";
  className?: string;
  width?: number;
  /** Shorter chart for single-row inline layout between title and timestamp. */
  compact?: boolean;
}) {
  if (values.length === 0) return null;
  const w = width;
  const h = compact ? 24 : 36;
  const topPad = compact ? 5 : 10;
  const bottomPad = compact ? 5 : 9;
  const sidePad = 2;
  const vals = values.length === 1 ? [values[0]!, values[0]!] : values;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const points = vals.map((v, i) => {
    const x = sidePad + (i / Math.max(1, vals.length - 1)) * (w - 2 * sidePad);
    const y = topPad + (1 - (v - min) / range) * (h - topPad - bottomPad);
    return { x, y, value: v, index: i };
  });
  const pts = points.map((point) => `${point.x},${point.y}`);

  const formatValue = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    const numeric = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    return kind === "weight" ? `${numeric}kg` : `${numeric}hrs`;
  };

  const lastPoint = points[points.length - 1]!;
  const minPoint = points.reduce((best, point) => (point.value < best.value ? point : best), points[0]!);
  const maxPoint = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]!);
  const labels = [
    { point: maxPoint, placement: "above" as const },
    { point: minPoint, placement: "below" as const },
    {
      point: lastPoint,
      placement: lastPoint.y > h / 2 ? ("above" as const) : ("below" as const),
    },
  ].filter(
    (entry, idx, arr) => arr.findIndex((other) => other.point.index === entry.point.index) === idx
  );
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
        strokeWidth={compact ? 1 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={pts.join(" ")}
      />
      {labels.map(({ point, placement }) => {
        const label = formatValue(point.value);
        const approxWidth = label.length * 4.2;
        const textX = Math.min(w - approxWidth / 2 - 1, Math.max(approxWidth / 2 + 1, point.x));
        const fs = compact ? 5.2 : 6.2;
        const textY =
          placement === "above"
            ? Math.max(compact ? 5 : 6.5, point.y - (compact ? 4 : 6))
            : Math.min(h - 1.5, point.y + (compact ? 7 : 10));
        return (
          <g key={`spark-label-${point.index}`}>
            <circle cx={point.x} cy={point.y} r={compact ? 1.4 : 1.8} fill="currentColor" />
            <text
              x={textX}
              y={textY}
              fontSize={fs}
              fontWeight="600"
              textAnchor="middle"
              fill="currentColor"
            >
              {label}
            </text>
          </g>
        );
      })}
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
  onTagContextEntry,
  habitsById = {},
  onEditContextEntry,
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
  onTagContextEntry?: (id: string) => void;
  habitsById?: Record<string, string>;
  onEditContextEntry?: (rowId: string, newText: string, opts?: { hour?: number; minute?: number }) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const editTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const canEdit = !!onEditContextEntry && row.rowSource === "transcript" &&
    (row.journalCategory === "reflection" || row.journalCategory === "nutrition" ||
     row.journalCategory === "exercise" || row.journalCategory === "spend" || row.journalCategory === undefined);

  const startEdit = () => {
    setEditDraft(row.bodyText);
    setEditing(true);
    requestAnimationFrame(() => { editTextareaRef.current?.focus(); });
  };

  const cancelEdit = () => { setEditing(false); };

  const saveEdit = async () => {
    const trimmed = editDraft.trim();
    if (!trimmed || !onEditContextEntry || editSaving) return;
    setEditSaving(true);
    try {
      await onEditContextEntry(row.id, trimmed);
      setEditing(false);
    } catch { /* silent - parent shows errors */ } finally {
      setEditSaving(false);
    }
  };

  const dotCls = journalContextDotClass(row.journalCategory);
  const burn = row.caloriesSummary?.startsWith("-");
  const open = () => onOpenJournalContextEntry?.(row.id);
  const habitNames = (row.habitTags ?? []).map((id) => habitsById[id]).filter(Boolean);
  const editPencilBtn = canEdit ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-350 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      title="Edit entry"
      aria-label={`Edit journal entry: ${row.bodyText.slice(0, 40)}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
      </svg>
    </button>
  ) : null;

  const tagBtn = onTagContextEntry ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onTagContextEntry(row.id); }}
      className="shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-violet-400 shadow-none outline-none ring-0 transition-colors hover:bg-violet-50 hover:text-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30 dark:text-violet-500 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
      title="Tag to a habit"
      aria-label={`Tag entry to a habit: ${row.bodyText.slice(0, 40)}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    </button>
  ) : null;

  const inlineEditForm = editing ? (
    <div className="flex flex-col gap-2 py-1.5">
      <textarea
        ref={editTextareaRef}
        value={editDraft}
        onChange={(e) => setEditDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelEdit();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
        }}
        disabled={editSaving}
        rows={3}
        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[15px] leading-snug text-foreground focus:border-[#295a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#295a8a]/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800/60 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/20"
        aria-label="Edit entry text"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdit}
          disabled={editSaving}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!editDraft.trim() || editSaving}
          onClick={() => void saveEdit()}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {editSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  ) : null;

  const SHEET_PILL_CLS = "inline-flex items-center gap-0.5 rounded-full border border-violet-200 bg-violet-50 px-1 py-px text-[7px] font-medium text-violet-700 dark:border-violet-700/40 dark:bg-violet-950/40 dark:text-violet-300";
  const sheetPillIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-2 w-2 shrink-0">
      <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
  const habitPillItems = habitNames.map((name) => (
    <span key={name} className={SHEET_PILL_CLS}>{sheetPillIcon}{name}</span>
  ));
  const habitPills = habitPillItems.length > 0 ? (
    <div className="flex flex-wrap gap-0.5 pl-[22px]">{habitPillItems}</div>
  ) : null;
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
            className={`${REFLECTION_NEW_CONV_BTN_BASE} ${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_WIDE}`}
            aria-label="Deep insights — choose session style and metacognition"
          >
            <ReflectionBrainIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
            <span>Deep</span>
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
            className={`${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_WIDE} ${REFLECTION_MENTOR_BTN_BASE}`}
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

  // Right-rail analysis value for this entry type.
  const sheetRightAnalysis = caloriesOnLeft ? (
    <span className={`text-[14px] font-semibold tabular-nums leading-none ${burn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
      {row.caloriesSummary}
    </span>
  ) : metricOnLeft && leftRailTrendValues && leftRailTrendValues.length > 0 ? (
    <MiniTrendSparkline
      values={leftRailTrendValues}
      kind={row.journalCategory === "weight" ? "weight" : "sleep"}
      width={100}
      className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
    />
  ) : effectiveHasCal ? (
    <span className={`inline-flex items-center gap-1 text-[14px] font-medium tabular-nums ${burn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
      <SparklesIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {row.caloriesSummary}
    </span>
  ) : effectiveHasMetric ? (
    <span className={`text-[14px] font-medium tabular-nums ${journalContextRowMetricToneClass(row.journalCategory)}`}>
      {row.metricSummary}
    </span>
  ) : null;

  // Reflection mentor action buttons shown below the text in the left column.
  const sheetMentorBtns = row.showMentorCta && (onOpenReflectionConversationChooser || onOpenReflectionMentor) ? (
    <>
      {onOpenReflectionConversationChooser ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenReflectionConversationChooser({ reflectionText: row.bodyText }); }}
          className={`${REFLECTION_NEW_CONV_BTN_BASE} ${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_WIDE}`}
          aria-label="Deep insights — choose session style and metacognition"
        >
          <ReflectionBrainIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
          <span>Deep</span>
        </button>
      ) : null}
      {onOpenReflectionMentor ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenReflectionMentor({ reflectionText: row.bodyText }); }}
          className={`${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_WIDE} ${REFLECTION_MENTOR_BTN_BASE}`}
          aria-label="1:1 mentor"
        >
          <MentorHumansIcon />
          <span>1:1</span>
        </button>
      ) : null}
    </>
  ) : null;

  return (
    <div className="border-b border-neutral-200 py-2.5 dark:border-white/[.15]">
      {inlineEditForm}
      {!editing && (
        <div className="flex items-start gap-2 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40">
          {/* LEFT: text + edit + tag inline, secondary/mentor/pills below */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <button
                type="button"
                onClick={open}
                disabled={!onOpenJournalContextEntry}
                title={row.bodyText ? `${row.categoryLabel}: ${row.bodyText}` : row.categoryLabel}
                className={`inline-flex min-w-0 shrink items-baseline gap-1.5 text-left text-[17px] leading-tight disabled:cursor-default disabled:opacity-100 ${GHOST_OPEN_BTN}`}
              >
                <span className={`mt-[0.25rem] shrink-0 ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
                <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">{row.bodyText || "—"}</span>
                {metricOnLeft ? (
                  <span className={`shrink-0 text-[14px] font-semibold tabular-nums leading-none ${journalContextRowMetricToneClass(row.journalCategory)}`}>
                    {row.metricSummary}
                  </span>
                ) : null}
                {row.habitCompletionCheck ? (
                  <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400" title="Habit completed">
                    <HabitDoneCheckIcon className="h-4 w-4" />
                  </span>
                ) : null}
              </button>
              {editPencilBtn}
              {tagBtn}
            </div>
            {row.secondaryText ? (
              <div className={`pl-[14px] text-left ${JOURNAL_SECONDARY_TEXT_CLASS}`}>{row.secondaryText}</div>
            ) : null}
            {sheetMentorBtns ? (
              <div className="mt-0.5 flex flex-wrap gap-1 pl-5">{sheetMentorBtns}</div>
            ) : null}
            {habitPills}
          </div>
          {/* RIGHT: analysis+delete on top, time below */}
          <div className="flex shrink-0 flex-col items-end gap-0.5 self-start pt-[2px]">
            <div className="flex items-center gap-1.5">
              {sheetRightAnalysis}
              <button
                type="button"
                onClick={() => void onDeleteJournalContextEntry?.(row.id)}
                disabled={!onDeleteJournalContextEntry || !isJournalContextRowDeletable(row)}
                className="hidden shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-red-400/30"
                aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
              >
                <DeleteEntryIcon />
              </button>
            </div>
            {timeOnly}
          </div>
        </div>
      )}
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
  onTagContextEntry,
  habitsById = {},
  onEditContextEntry,
  isNew = false,
  prevDayWeightKg = null,
  prevDaySleepH = null,
  isDragging = false,
  isDragTarget = false,
  onDragHandleTouchStart,
}: {
  row: BrainDumpJournalContextRow;
  onOpenJournalContextEntry?: (id: string) => void;
  onDeleteJournalContextEntry?: (id: string) => void;
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  weightTrendSparklineKg?: number[];
  sleepTrendSparklineHours?: number[];
  onTagContextEntry?: (id: string) => void;
  habitsById?: Record<string, string>;
  onEditContextEntry?: (rowId: string, newText: string, opts?: { hour?: number; minute?: number }) => Promise<void>;
  isNew?: boolean;
  prevDayWeightKg?: number | null;
  prevDaySleepH?: number | null;
  isDragging?: boolean;
  isDragTarget?: boolean;
  onDragHandleTouchStart?: (e: React.TouchEvent) => void;
}) {
  const [nsEditing, setNsEditing] = React.useState(false);
  const [nsEditDraft, setNsEditDraft] = React.useState("");
  const [nsEditTimeDraft, setNsEditTimeDraft] = React.useState(""); // "HH:MM" 24-h for <input type="time">
  const [nsEditSaving, setNsEditSaving] = React.useState(false);
  const nsEditTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Swipe-to-delete — latch-open pattern:
  // • Swipe left past SWIPE_THRESHOLD → row latches open, delete button stays visible
  // • Tap delete button → confirms deletion
  // • Swipe right while open → snaps closed
  const swipeTouchStartXRef = React.useRef<number | null>(null);
  const [swipeX, setSwipeX] = React.useState(0);
  const [swipeLatchOpen, setSwipeLatchOpen] = React.useState(false);
  const SWIPE_THRESHOLD = 80;
  // Width the row sits at when latched open (just enough to show the delete button)
  const LATCH_X = -SWIPE_THRESHOLD;
  const canDelete = !!onDeleteJournalContextEntry && isJournalContextRowDeletable(row);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDelete) return;
    swipeTouchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeTouchStartXRef.current === null || !canDelete) return;
    const dx = (e.touches[0]?.clientX ?? 0) - swipeTouchStartXRef.current;
    if (swipeLatchOpen) {
      // When already latched, let the user drag from the latched position
      const next = LATCH_X + dx;
      if (next <= 0) setSwipeX(Math.max(next, LATCH_X - 20));
    } else {
      if (dx < 0) setSwipeX(Math.max(dx, LATCH_X - 20));
    }
  };
  const handleTouchEnd = () => {
    swipeTouchStartXRef.current = null;
    if (!canDelete) return;
    if (swipeLatchOpen) {
      // If dragged noticeably rightward from latched position, close; otherwise stay open
      if (swipeX > LATCH_X / 2) {
        setSwipeX(0);
        setSwipeLatchOpen(false);
      } else {
        setSwipeX(LATCH_X);
      }
    } else {
      if (swipeX <= -SWIPE_THRESHOLD) {
        // Latch open instead of immediately deleting
        setSwipeX(LATCH_X);
        setSwipeLatchOpen(true);
      } else {
        setSwipeX(0);
      }
    }
  };

  const handleSwipedDeleteClick = () => {
    setSwipeX(0);
    setSwipeLatchOpen(false);
    void onDeleteJournalContextEntry!(row.id);
  };

  const nsCanEdit = !!onEditContextEntry && row.rowSource === "transcript" &&
    (row.journalCategory === "reflection" || row.journalCategory === "nutrition" ||
     row.journalCategory === "exercise" || row.journalCategory === "spend" || row.journalCategory === undefined);

  const nsStartEdit = () => {
    setNsEditDraft(row.bodyText);
    // Pre-populate time from raw hour/minute; fall back to parsing the display string
    const h = row.entryHour;
    const m = row.entryMinute;
    if (typeof h === "number" && typeof m === "number") {
      setNsEditTimeDraft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
    } else if (row.time) {
      // Parse display string like "9:19 AM"
      const match = /(\d+):(\d+)\s*(AM|PM)?/i.exec(row.time);
      if (match) {
        let hh = parseInt(match[1]!, 10);
        const mm = parseInt(match[2]!, 10);
        const period = match[3]?.toUpperCase();
        if (period === "PM" && hh !== 12) hh += 12;
        if (period === "AM" && hh === 12) hh = 0;
        setNsEditTimeDraft(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      } else {
        setNsEditTimeDraft("");
      }
    } else {
      setNsEditTimeDraft("");
    }
    setNsEditing(true);
    requestAnimationFrame(() => { nsEditTextareaRef.current?.focus(); });
  };

  const nsCancelEdit = () => setNsEditing(false);

  const nsSaveEdit = async () => {
    const trimmed = nsEditDraft.trim();
    if (!onEditContextEntry || nsEditSaving) return;
    setNsEditSaving(true);
    try {
      // Parse time draft into hour/minute if changed
      let timeOpts: { hour: number; minute: number } | undefined;
      const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(nsEditTimeDraft);
      if (timeMatch) {
        const h = parseInt(timeMatch[1]!, 10);
        const m = parseInt(timeMatch[2]!, 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          const origH = row.entryHour;
          const origM = row.entryMinute;
          if (h !== origH || m !== origM) {
            timeOpts = { hour: h, minute: m };
          }
        }
      }
      await onEditContextEntry(row.id, trimmed, timeOpts);
      setNsEditing(false);
    } catch { /* silent */ } finally {
      setNsEditSaving(false);
    }
  };

  const dotCls = journalContextDotClass(row.journalCategory);
  const burn = row.caloriesSummary?.startsWith("-");
  const open = () => onOpenJournalContextEntry?.(row.id);
  const nsHabitNames = (row.habitTags ?? []).map((id) => habitsById[id]).filter(Boolean);
  const nsTagBtn = onTagContextEntry ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onTagContextEntry(row.id); }}
      className="shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-violet-400 shadow-none outline-none ring-0 transition-colors hover:bg-violet-50 hover:text-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30 dark:text-violet-500 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
      title="Tag to a habit"
      aria-label={`Tag entry to a habit: ${row.bodyText.slice(0, 40)}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    </button>
  ) : null;
  const NS_PILL_CLS = "inline-flex items-center gap-0.5 rounded-full border border-violet-200 bg-violet-50 px-1 py-px text-[7px] font-medium text-violet-700 dark:border-violet-700/40 dark:bg-violet-950/40 dark:text-violet-300";
  const nsPillIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-2 w-2 shrink-0">
      <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
  const nsHabitPillItems = nsHabitNames.map((name) => (
    <span key={name} className={NS_PILL_CLS}>{nsPillIcon}{name}</span>
  ));
  const nsTimeEl = row.time ? (
    <span className="shrink-0 text-[7px] tabular-nums text-neutral-400 dark:text-neutral-500">{row.time}</span>
  ) : null;
  const nsHabitPills = nsHabitPillItems.length > 0 ? (
    <div className="flex flex-wrap gap-0.5 pl-[22px]">{nsHabitPillItems}</div>
  ) : null;
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
        burn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
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
            className={`${REFLECTION_NEW_CONV_BTN_BASE} ${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_COMPACT} shrink-0`}
            aria-label="Deep insights — choose session style and metacognition"
          >
            <ReflectionBrainIcon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
            <span>Deep</span>
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
            className={`${REFLECTION_ACTION_PILL_BASE} ${REFLECTION_ACTION_PILL_COMPACT} ${REFLECTION_MENTOR_BTN_BASE} shrink-0`}
            aria-label="1:1 mentor"
          >
            <MentorHumansIcon className="h-3 w-3" />
            1:1
          </button>
        ) : null}
      </span>
    ) : null;

  const nsEditPencilBtn = nsCanEdit ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); nsStartEdit(); }}
      className="shrink-0 appearance-none rounded-md border-0 bg-transparent p-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      title="Edit entry"
      aria-label={`Edit journal entry: ${row.bodyText.slice(0, 40)}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
      </svg>
    </button>
  ) : null;

  const nsInlineEditForm = nsEditing ? (
    <div className="mb-3 flex flex-col gap-2 py-1">
      <textarea
        ref={nsEditTextareaRef}
        value={nsEditDraft}
        onChange={(e) => setNsEditDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") nsCancelEdit();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void nsSaveEdit();
        }}
        disabled={nsEditSaving}
        rows={3}
        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[15px] leading-snug text-foreground focus:border-[#295a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#295a8a]/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800/60 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/20"
        aria-label="Edit entry text"
      />
      <div className="flex items-center gap-2">
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
          <input
            type="time"
            value={nsEditTimeDraft}
            onChange={(e) => setNsEditTimeDraft(e.target.value)}
            disabled={nsEditSaving}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[12px] text-foreground focus:border-[#295a8a]/40 focus:outline-none focus:ring-2 focus:ring-[#295a8a]/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800/60"
            aria-label="Entry time"
          />
        </label>
        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={nsCancelEdit}
            disabled={nsEditSaving}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={nsEditSaving}
            onClick={() => void nsSaveEdit()}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {nsEditSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const rawDisplay = row.bodyText.trim();

  // Day-over-day delta badge for weight and sleep rows
  const deltaBadge: React.ReactNode = (() => {
    if (row.journalCategory === "weight" && prevDayWeightKg !== null && row.metricSummary) {
      const todayKg = parseFloat(row.metricSummary);
      if (!Number.isNaN(todayKg)) {
        const diff = todayKg - prevDayWeightKg;
        if (Math.abs(diff) >= 0.05) {
          const sign = diff > 0 ? "↑" : "↓";
          const tone =
            diff > 0
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400";
          return (
            <span className={`text-[10px] tabular-nums font-medium ${tone}`}>
              {sign} {Math.abs(diff).toFixed(1)} kg
            </span>
          );
        }
      }
    }
    if (row.journalCategory === "sleep" && prevDaySleepH !== null && row.metricSummary) {
      const todayH = parseFloat(row.metricSummary);
      if (!Number.isNaN(todayH)) {
        const diffH = todayH - prevDaySleepH;
        if (Math.abs(diffH) >= 0.1) {
          const sign = diffH > 0 ? "↑" : "↓";
          const diffMin = Math.round(Math.abs(diffH) * 60);
          const label = diffMin >= 60 ? `${(Math.abs(diffH)).toFixed(1)} h` : `${diffMin} min`;
          const tone =
            diffH > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400";
          return (
            <span className={`text-[10px] tabular-nums font-medium ${tone}`}>
              {sign} {label}
            </span>
          );
        }
      }
    }
    return null;
  })();

  /** Inline between title and timestamp for weight/sleep rows (saves a full extra row). */
  const nsTrendSparkline =
    metricOnLeft && leftRailTrendValues && leftRailTrendValues.length > 0 ? (
      <MiniTrendSparkline
        values={leftRailTrendValues}
        kind={row.journalCategory === "weight" ? "weight" : "sleep"}
        width={100}
        compact
        className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
      />
    ) : null;

  // Right-rail analysis: calories for nutrition/exercise; otherwise cal/metric when not shown on left / not in middle sparkline.
  const nsRightAnalysis = caloriesOnLeft ? (
    <span
      className={`text-[12px] font-semibold tabular-nums leading-none ${
        burn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      }`}
    >
      {row.caloriesSummary}
    </span>
  ) : nsTrendSparkline != null ? null : cal ?? metric ?? null;

  const swipeProgress = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);

  // Drag handle — only for reorderable transcript rows
  const isDraggable = !!onDragHandleTouchStart &&
    (row.rowSource === "transcript" || row.rowSource === "sleep" || row.rowSource === "weight");
  const dragHandle = isDraggable ? (
    <button
      type="button"
      className="touch-none shrink-0 cursor-grab p-0.5 text-neutral-300 active:cursor-grabbing dark:text-neutral-600"
      aria-label="Drag to reorder"
      tabIndex={-1}
      onTouchStart={onDragHandleTouchStart}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
        <circle cx="5" cy="3" r="1.2" />
        <circle cx="11" cy="3" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="13" r="1.2" />
        <circle cx="11" cy="13" r="1.2" />
      </svg>
    </button>
  ) : null;

  return (
    <article
      className={`relative min-w-0 overflow-hidden border-b border-neutral-200 pb-3 pt-2 dark:border-white/[.15]${isNew ? " animate-fade-in-up" : ""}${isDragging ? " opacity-50" : ""}${isDragTarget && !isDragging ? " bg-neutral-50 dark:bg-neutral-800/40" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Red delete affordance revealed by swipe — tappable when latched open */}
      {canDelete && swipeX < 0 ? (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-3"
          style={{ opacity: swipeLatchOpen ? 1 : swipeProgress }}
        >
          <button
            type="button"
            onClick={swipeLatchOpen ? handleSwipedDeleteClick : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-transform ${swipeLatchOpen ? "scale-100" : "scale-90"}`}
            aria-label="Delete entry"
            tabIndex={swipeLatchOpen ? 0 : -1}
          >
            <DeleteEntryIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: (swipeX === 0 || swipeLatchOpen) ? "transform 0.2s ease" : "none",
        }}
      >
        {nsInlineEditForm}
        {!nsEditing && (
          <div className={`flex gap-1.5 ${nsTrendSparkline ? "items-center" : "items-start"}`}>
            {dragHandle}
            <div className={`min-w-0 ${nsTrendSparkline ? "shrink" : "flex-1"}`}>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <button
                  type="button"
                  onClick={open}
                  disabled={!onOpenJournalContextEntry}
                  title={rawDisplay ? `${row.categoryLabel}: ${row.bodyText}` : row.categoryLabel}
                  className={`inline-flex min-w-0 shrink items-baseline gap-1.5 text-left text-[16px] leading-snug disabled:cursor-default ${GHOST_OPEN_BTN}`}
                >
                  <span className={`mt-[0.25rem] shrink-0 ${JOURNAL_CATEGORY_DOT_BASE} ${dotCls}`} aria-hidden />
                  <span className="min-w-0 whitespace-pre-wrap break-words">{rawDisplay || "—"}</span>
                  {metricOnLeft ? (
                    <span className={`shrink-0 text-[13px] font-semibold tabular-nums leading-none ${journalContextRowMetricToneClass(row.journalCategory)}`}>
                      {row.metricSummary}
                    </span>
                  ) : null}
                  {habitCheck}
                </button>
                {nsEditPencilBtn}
                {nsTagBtn}
              </div>
              {row.secondaryText ? (
                <div className={`pl-[14px] text-left ${JOURNAL_SECONDARY_TEXT_CLASS}`}>{row.secondaryText}</div>
              ) : null}
              {reflectionMentorActions ? (
                <div className="mt-0.5 flex flex-wrap gap-1 pl-5">{reflectionMentorActions}</div>
              ) : null}
              {nsHabitPills}
            </div>
            {nsTrendSparkline ? (
              <div className="flex min-w-0 flex-1 items-center justify-center px-0.5">
                {nsTrendSparkline}
              </div>
            ) : null}
            {/* RIGHT: analysis (non-sparkline rows) + delete, delta, time */}
            <div
              className={`flex shrink-0 flex-col items-end gap-0.5 ${nsTrendSparkline ? "self-center" : "self-start pt-[2px]"}`}
            >
              <div className="flex items-center gap-1.5">
                {!metricOnLeft ? nsRightAnalysis : null}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void onDeleteJournalContextEntry!(row.id)}
                    className="hidden shrink-0 appearance-none rounded-md border-0 bg-transparent p-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 sm:inline-flex dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-red-400/30"
                    aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
                  >
                    <DeleteEntryIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {deltaBadge}
              {row.time ? (
                <span className="text-[7px] tabular-nums text-neutral-400 dark:text-neutral-500">{row.time}</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Habit tag pill colors (match landing accent orange) ─────────────────────
const HABIT_PILL_CLS =
  "inline-flex items-center gap-0.5 rounded-full border border-[#c96442]/28 bg-[#c96442]/[0.09] px-1.5 py-px text-[9px] font-medium text-[#a85535] dark:border-[#d97757]/35 dark:bg-[#d97757]/12 dark:text-[#e8a088]";

function HabitTagIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

function HabitTagPicker({
  availableHabits,
  selectedIds,
  onToggle,
  open,
  onOpenChange,
}: {
  availableHabits: Array<{ _id: string; name: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const hasSelected = selectedIds.length > 0;
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {/* Selected tags row */}
      {hasSelected ? (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const h = availableHabits.find((x) => x._id === id);
            if (!h) return null;
            return (
              <span key={id} className={HABIT_PILL_CLS}>
                <HabitTagIcon className="h-2 w-2 shrink-0" />
                {h.name}
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="ml-0.5 rounded-full p-px hover:bg-[#c96442]/15 dark:hover:bg-[#d97757]/20"
                  aria-label={`Remove habit tag: ${h.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-2 w-2">
                    <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`inline-flex w-fit items-center gap-0.5 rounded-full border px-2 py-px text-[10px] font-medium transition-colors ${
          hasSelected
            ? "border-[#c96442]/40 bg-[#c96442]/10 text-[#a85535] hover:bg-[#c96442]/16 dark:border-[#d97757]/45 dark:bg-[#d97757]/14 dark:text-[#e8a088] dark:hover:bg-[#d97757]/22"
            : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
        aria-expanded={open}
        aria-label="Link to a habit"
      >
        <HabitTagIcon className="h-2.5 w-2.5 shrink-0" />
        {hasSelected ? `${selectedIds.length} habit${selectedIds.length > 1 ? "s" : ""} linked` : "Link habit"}
      </button>
      {/* Picker dropdown */}
      {open ? (
        <div className="mt-0.5 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          {availableHabits.map((h) => {
            const selected = selectedIds.includes(h._id);
            return (
              <button
                key={h._id}
                type="button"
                onClick={() => { onToggle(h._id); }}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  selected
                    ? "border-[#c96442]/55 bg-[#c96442]/14 text-[#8f3f28] dark:border-[#d97757]/55 dark:bg-[#d97757]/18 dark:text-[#f0c4a8]"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-[#c96442]/35 hover:bg-[#c96442]/[0.07] hover:text-[#a85535] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-[#d97757]/40 dark:hover:bg-[#d97757]/12 dark:hover:text-[#e8a088]"
                }`}
                aria-pressed={selected}
              >
                {selected ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
                  </svg>
                ) : null}
                {h.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function QuickNoteWellnessNudgeBar({
  onNudgeCheck,
}: {
  onNudgeCheck?: (nudge: WellnessNudge) => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<WellnessCategory>("oxytocin");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const nudges = NUDGES_BY_CATEGORY[activeCategory];
  const activeMeta = WELLNESS_CATEGORY_META[activeCategory];

  const checkedCount = WELLNESS_NUDGES_ALL_IDS.reduce((n, id) => n + (checkedIds.has(id) ? 1 : 0), 0);
  const totalCount = WELLNESS_NUDGES_ALL_IDS.length;

  const handleToggle = useCallback(
    (nudge: WellnessNudge) => {
      if (checkedIds.has(nudge.id)) return;
      setCheckedIds((prev) => new Set(prev).add(nudge.id));
      onNudgeCheck?.(nudge);
    },
    [checkedIds, onNudgeCheck],
  );

  return (
    <div className="shrink-0 bg-transparent px-0 pb-0 pt-1">
      {/* ── collapsed pill (same visual language as hero habits) ── */}
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <div className="h-px min-w-[0.75rem] flex-1 bg-[#c9c7bf]/90 dark:bg-[#4d4c48]/90" aria-hidden />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex max-w-[min(100%,18rem)] shrink-0 items-center gap-0.5 rounded-full border border-[#c9c7bf]/90 bg-transparent px-2 py-1 text-[10px] font-medium text-[#4d4c48] shadow-none transition hover:border-[#c96442]/45 hover:bg-black/[0.04] dark:border-[#5e5d59]/90 dark:text-[#b0aea5] dark:hover:border-[#d97757]/50 dark:hover:bg-white/[0.05]"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide wellness nudges" : "Show wellness nudges"}
        >
          <span className="text-center leading-tight">
            <span className="tabular-nums text-[#c96442] dark:text-[#d97757]">
              {checkedCount} / {totalCount}
            </span>{" "}
            <span className="whitespace-nowrap font-normal text-[#5e5d59] opacity-90 dark:text-[#87867f]">
              no-screen daily nudges
            </span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-2.5 w-2.5 shrink-0 opacity-60 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div className="h-px min-w-[0.75rem] flex-1 bg-[#c9c7bf]/90 dark:bg-[#4d4c48]/90" aria-hidden />
      </div>

      {/* ── expanded: category tabs + description + checklist ── */}
      {expanded ? (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-[#e8e6dc]/70 bg-[#faf9f5]/65 shadow-none backdrop-blur-[6px] dark:border-[#3d3d3a]/70 dark:bg-[#141413]/55">
          {/* category tabs — highlighted labels */}
          <div className="flex gap-0 overflow-x-auto border-b border-[#e8e6dc]/80 px-0.5 dark:border-[#3d3d3a]/55 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {WELLNESS_CATEGORIES.map((cat) => {
              const meta = WELLNESS_CATEGORY_META[cat];
              const active = cat === activeCategory;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className="shrink-0 flex-1 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-semibold text-[#141413] transition-colors dark:text-[#faf9f5]"
                  aria-selected={active}
                  role="tab"
                >
                  <span
                    className="rounded-[2px] px-[3px] py-[1px]"
                    style={{ backgroundColor: active ? meta.highlight : "transparent" }}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* nudge checklist rows */}
          <div
            className="max-h-[min(36vh,280px)] overflow-y-auto [-webkit-overflow-scrolling:touch]"
            role="list"
          >
            {nudges.map((nudge) => {
              const done = checkedIds.has(nudge.id);
              return (
                <div
                  key={nudge.id}
                  role="listitem"
                  className="flex items-center gap-1.5 border-b border-[#e8e6dc]/80 px-2 py-1.5 last:border-b-0 dark:border-[#3d3d3a]/55"
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(nudge)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                      done
                        ? "border-[#c96442]/45 bg-[#c96442]/10 dark:border-[#d97757]/45 dark:bg-[#d97757]/12"
                        : "border-[#d4d2c9] dark:border-[#5e5d59]"
                    }`}
                    aria-label={done ? `${nudge.action} — saved` : `Save ${nudge.action} as journal entry`}
                    aria-pressed={done}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 16 16"
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="#c96442"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                      </svg>
                    ) : null}
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-left text-[12px] leading-snug transition-colors ${
                      done
                        ? "text-[#87867f] line-through dark:text-[#5e5d59]"
                        : "font-medium text-[#141413] dark:text-[#faf9f5]"
                    }`}
                  >
                    {nudge.action}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const WELLNESS_NUDGES_ALL_IDS = Object.values(NUDGES_BY_CATEGORY).flat().map((n) => n.id);

function quickNoteHeroHabitsTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function QuickNoteHeroHabitsBar({
  habits,
  completions,
  onToggle,
  onOpenHabitDetail,
}: {
  habits: Array<{ _id: string; name: string }>;
  completions: LandingHabitCompletionMap;
  onToggle: (habitId: string, dateKey: string) => void;
  onOpenHabitDetail?: (habitId: string) => void;
}) {
  const today = useMemo(quickNoteHeroHabitsTodayKey, []);
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(
    () =>
      habits.map((h) => ({
        ...h,
        doneToday: (completions[h._id] ?? []).includes(today),
      })),
    [habits, completions, today]
  );
  const doneCount = rows.filter((r) => r.doneToday).length;
  const total = rows.length;

  return (
    <div className="shrink-0 bg-transparent px-0 pb-[max(0.125rem,env(safe-area-inset-bottom,0px))] pt-1">
      <div className="flex w-full min-w-0 items-center gap-1.5">
        <div
          className="h-px min-w-[0.75rem] flex-1 bg-[#c9c7bf]/90 dark:bg-[#4d4c48]/90"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex max-w-[min(100%,18rem)] shrink-0 items-center gap-0.5 rounded-full border border-[#c9c7bf]/90 bg-transparent px-2 py-1 text-[10px] font-medium text-[#4d4c48] shadow-none transition hover:border-[#c96442]/45 hover:bg-black/[0.04] dark:border-[#5e5d59]/90 dark:text-[#b0aea5] dark:hover:border-[#d97757]/50 dark:hover:bg-white/[0.05]"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide hero habits" : "Show hero habits"}
        >
          <span className="text-center leading-tight">
            <span className="tabular-nums text-[#c96442] dark:text-[#d97757]">
              {doneCount} / {total}
            </span>{" "}
            <span className="whitespace-nowrap font-normal text-[#5e5d59] opacity-90 dark:text-[#87867f]">
              habits complete
            </span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-2.5 w-2.5 shrink-0 opacity-60 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div
          className="h-px min-w-[0.75rem] flex-1 bg-[#c9c7bf]/90 dark:bg-[#4d4c48]/90"
          aria-hidden
        />
      </div>
      {expanded ? (
        <div
          className="mt-1.5 max-h-[min(36vh,260px)] overflow-y-auto rounded-lg border border-[#e8e6dc]/70 bg-[#faf9f5]/65 shadow-none backdrop-blur-[6px] dark:border-[#3d3d3a]/70 dark:bg-[#141413]/55 [-webkit-overflow-scrolling:touch]"
          role="list"
        >
          {rows.map((habit) => (
            <div
              key={habit._id}
              role="listitem"
              className="flex items-center gap-1.5 border-b border-[#e8e6dc]/80 px-2 py-1.5 last:border-b-0 dark:border-[#3d3d3a]/55"
            >
              <button
                type="button"
                onClick={() => onToggle(habit._id, today)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                  habit.doneToday
                    ? "border-[#c96442]/45 bg-[#c96442]/10 dark:border-[#d97757]/45 dark:bg-[#d97757]/12"
                    : "border-[#d4d2c9] dark:border-[#5e5d59]"
                }`}
                aria-label={habit.doneToday ? `Mark ${habit.name} not done` : `Complete ${habit.name}`}
                aria-pressed={habit.doneToday}
              >
                {habit.doneToday ? (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-2.5 w-2.5"
                    fill="none"
                    stroke="#c96442"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                  </svg>
                ) : null}
              </button>
              {onOpenHabitDetail ? (
                <button
                  type="button"
                  onClick={() => onOpenHabitDetail(habit._id)}
                  className={`min-w-0 flex-1 text-left text-[12px] leading-snug transition-colors ${
                    habit.doneToday
                      ? "text-[#87867f] line-through dark:text-[#5e5d59]"
                      : "font-medium text-[#141413] hover:underline dark:text-[#faf9f5]"
                  }`}
                >
                  {habit.name}
                </button>
              ) : (
                <span
                  className={`min-w-0 flex-1 text-left text-[12px] leading-snug ${
                    habit.doneToday
                      ? "text-[#87867f] line-through dark:text-[#5e5d59]"
                      : "font-medium text-[#141413] dark:text-[#faf9f5]"
                  }`}
                >
                  {habit.name}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface CaptureViewProps {
  captureEntries: BrainDumpCaptureEntry[];
  setCaptureEntries: React.Dispatch<React.SetStateAction<BrainDumpCaptureEntry[]>>;
  sentenceDraft: string;
  setSentenceDraft: React.Dispatch<React.SetStateAction<string>>;
  phase: "recording" | "categorizing" | "saving";
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
  /** Habits available for tagging (hero + current experiment). */
  availableHabits?: Array<{ _id: string; name: string }>;
  /** Currently selected habit IDs pending submission. */
  pendingHabitTags?: string[];
  onPendingHabitTagsChange?: (tags: string[]) => void;
  /** Called when user clicks the tag button on a saved journal row. */
  onTagContextEntry?: (rowId: string) => void;
  /** habitsById lookup for displaying names on saved rows. */
  habitsById?: Record<string, string>;
  /** Called when user saves edited text for a saved row. Returns promise that resolves on server success. */
  onEditContextEntry?: (rowId: string, newText: string, opts?: { hour?: number; minute?: number }) => Promise<void>;
  /** Aggregated stats for the selected day (summary bar + footer). */
  daySummary?: QuickNoteDaySummary;
  /** Consecutive days with at least one journal entry. */
  journalStreak?: number;
  /** Yesterday's weight in kg for delta display on weight rows. */
  prevDayWeightKg?: number | null;
  /** Yesterday's sleep hours for delta display on sleep rows. */
  prevDaySleepH?: number | null;
  /** Called when user reorders a transcript row. newSortMs is the new sort override epoch-ms. */
  onReorderContextEntry?: (rowId: string, newSortMs: number) => Promise<void>;
  /** When true, hides the floating camera/gallery buttons (e.g. a modal is open on top). */
  hideImageIngestBar?: boolean;
  /** Pull-to-refresh callback — called when the user pulls down past the threshold. */
  onRefresh?: () => Promise<void> | void;
  /** Hero habits strip at bottom of mobile Quick Notes (check off for today). */
  quickNoteHeroHabits?: Array<{ _id: string; name: string }>;
  quickNoteHeroHabitCompletions?: LandingHabitCompletionMap;
  onQuickNoteToggleHeroHabit?: (habitId: string, dateKey: string) => void;
  onQuickNoteOpenHeroHabit?: (habitId: string) => void;
  /** When true, show daily wellness nudge bar (mobile Quick Notes). */
  showWellnessNudges?: boolean;
}

type ImageReviewDestination = "quick_note" | "commonplace" | "weight" | "sleep";

function imageKindHint(kind: JournalImageAutoKind | undefined): string | null {
  switch (kind) {
    case "nutrition":
      return "Food or drink";
    case "exercise":
      return "Workout or activity";
    case "generic_text":
      return "Text or quote";
    case "weight_scale":
      return "Weight scale";
    case "sleep_tracker":
      return "Sleep app / tracker";
    default:
      return null;
  }
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
  availableHabits = [],
  pendingHabitTags = [],
  onPendingHabitTagsChange,
  onTagContextEntry,
  habitsById = {},
  onEditContextEntry,
  daySummary,
  journalStreak,
  prevDayWeightKg = null,
  prevDaySleepH = null,
  onReorderContextEntry,
  hideImageIngestBar = false,
  onRefresh,
  quickNoteHeroHabits = [],
  quickNoteHeroHabitCompletions = {},
  onQuickNoteToggleHeroHabit,
  onQuickNoteOpenHeroHabit,
  showWellnessNudges = false,
}: CaptureViewProps) {
  const draftMetaRef = useRef<EntryEstimateModalMeta>({ status: "idle" });
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const syncDraftMeta = useCallback((m: EntryEstimateModalMeta) => {
    draftMetaRef.current = m;
  }, []);

  const [habitPickerOpen, setHabitPickerOpen] = React.useState(false);

  const handleNudgeSave = useCallback(
    async (nudge: WellnessNudge) => {
      if (onSaveLine) {
        await onSaveLine(nudge.action, { status: "idle" });
      }
    },
    [onSaveLine],
  );

  // ─── Pull-to-refresh ───────────────────────────────────────────────────────
  const PTR_THRESHOLD = 72;
  const PTR_MAX_PULL = 110;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const ptrTouchStartYRef = useRef<number | null>(null);
  const [ptrPullY, setPtrPullY] = useState(0);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);

  const handlePtrTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onRefresh) return;
    const container = scrollContainerRef.current;
    if (!container || container.scrollTop > 0) return;
    ptrTouchStartYRef.current = e.touches[0]?.clientY ?? null;
  }, [onRefresh]);

  const handlePtrTouchMove = useCallback((e: React.TouchEvent) => {
    if (!onRefresh || ptrTouchStartYRef.current === null || ptrRefreshing) return;
    const dy = (e.touches[0]?.clientY ?? 0) - ptrTouchStartYRef.current;
    if (dy <= 0) { setPtrPullY(0); return; }
    // Rubber-band resistance
    const pull = Math.min(PTR_MAX_PULL, dy * 0.45);
    setPtrPullY(pull);
  }, [onRefresh, ptrRefreshing]);

  const handlePtrTouchEnd = useCallback(() => {
    if (!onRefresh) return;
    ptrTouchStartYRef.current = null;
    if (ptrRefreshing) return;
    if (ptrPullY >= PTR_THRESHOLD) {
      setPtrRefreshing(true);
      setPtrPullY(0);
      void Promise.resolve(onRefresh()).finally(() => setPtrRefreshing(false));
    } else {
      setPtrPullY(0);
    }
  }, [onRefresh, ptrPullY, ptrRefreshing]);
  // ──────────────────────────────────────────────────────────────────────────

  // Image review state — analyses are held here until the user confirms or discards
  const [pendingImageAnalyses, setPendingImageAnalyses] = useState<JournalImageAnalysis[] | null>(null);
  const [pendingImageEditText, setPendingImageEditText] = useState("");
  const [imageReviewDestination, setImageReviewDestination] = useState<ImageReviewDestination>("quick_note");
  const [imageReviewCommonplaceSource, setImageReviewCommonplaceSource] = useState("");
  const [imageReviewCommonplaceAuthor, setImageReviewCommonplaceAuthor] = useState("");
  const [imageReviewWeightKg, setImageReviewWeightKg] = useState("");
  const [imageReviewSleepHours, setImageReviewSleepHours] = useState("");
  const [imageReviewHrvMs, setImageReviewHrvMs] = useState("");
  const [imageReviewBusy, setImageReviewBusy] = useState(false);
  const [imageReviewError, setImageReviewError] = useState<string | null>(null);
  /** Avoid hydration mismatch; portal image review to document.body (above tab bars / transformed ancestors). */
  const [imageReviewPortalReady, setImageReviewPortalReady] = useState(false);
  useEffect(() => {
    setImageReviewPortalReady(true);
  }, []);

  const revokePendingImagePreviews = useCallback((analyses: JournalImageAnalysis[] | null) => {
    if (!analyses) return;
    for (const a of analyses) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    }
  }, []);

  const handleImageAnalysesReady = useCallback((analyses: JournalImageAnalysis[]) => {
    const texts = analyses.map((a) => a.extractedText).filter(Boolean);
    if (texts.length === 0) return;
    setPendingImageAnalyses(analyses);
    setPendingImageEditText(texts.join("\n\n"));
  }, []);

  useEffect(() => {
    const onBridge = (e: Event) => {
      const detail = (e as CustomEvent<JournalImageAnalysesBridgeDetail>).detail;
      if (detail?.analyses?.length) handleImageAnalysesReady(detail.analyses);
    };
    window.addEventListener(JOURNAL_IMAGE_ANALYSES_BRIDGE_EVENT, onBridge);
    return () => window.removeEventListener(JOURNAL_IMAGE_ANALYSES_BRIDGE_EVENT, onBridge);
  }, [handleImageAnalysesReady]);

  useEffect(() => {
    if (!pendingImageAnalyses?.length) return;
    const a = pendingImageAnalyses[0]!;
    const kind = a.imageKind;
    let dest: ImageReviewDestination = "quick_note";
    if (kind === "generic_text") dest = "commonplace";
    else if (kind === "weight_scale") dest = "weight";
    else if (kind === "sleep_tracker") dest = "sleep";
    setImageReviewDestination(dest);
    setImageReviewCommonplaceSource((a.sceneLabel?.trim() || "Photo import").slice(0, 200));
    setImageReviewCommonplaceAuthor("");
    setImageReviewWeightKg(
      a.weightKgGuess != null && Number.isFinite(a.weightKgGuess) ? String(a.weightKgGuess) : ""
    );
    setImageReviewSleepHours(
      a.sleepHoursGuess != null && Number.isFinite(a.sleepHoursGuess) ? String(a.sleepHoursGuess) : ""
    );
    setImageReviewHrvMs(
      a.hrvMsGuess != null && Number.isFinite(a.hrvMsGuess) ? String(Math.round(a.hrvMsGuess)) : ""
    );
    setImageReviewError(null);
  }, [pendingImageAnalyses]);

  const imageReviewCanSave = useMemo(() => {
    if (imageReviewBusy) return false;
    const text = pendingImageEditText.trim();
    if (imageReviewDestination === "quick_note") return text.length > 0;
    if (imageReviewDestination === "commonplace")
      return text.length > 0 && imageReviewCommonplaceSource.trim().length > 0;
    if (imageReviewDestination === "weight") {
      const w = Number.parseFloat(imageReviewWeightKg.trim());
      return Number.isFinite(w) && w >= 20 && w <= 400;
    }
    if (imageReviewDestination === "sleep") {
      const h = Number.parseFloat(imageReviewSleepHours.trim());
      return Number.isFinite(h) && h >= 0.5 && h <= 24;
    }
    return false;
  }, [
    imageReviewBusy,
    imageReviewDestination,
    pendingImageEditText,
    imageReviewCommonplaceSource,
    imageReviewWeightKg,
    imageReviewSleepHours,
  ]);

  const handleImageReviewSave = useCallback(async () => {
    setImageReviewError(null);
    setImageReviewBusy(true);
    const analysesSnapshot = pendingImageAnalyses;
    try {
      const text = pendingImageEditText.trim();

      if (imageReviewDestination === "quick_note") {
        if (!text) {
          setImageReviewError("Add some text for your note.");
          return;
        }
        setSentenceDraft((prev) => {
          const prefix = prev.trim() ? prev.trimEnd() + "\n" : "";
          return prefix + text;
        });
      } else if (imageReviewDestination === "commonplace") {
        if (!text) {
          setImageReviewError("Text is required for a commonplace entry.");
          return;
        }
        const source = imageReviewCommonplaceSource.trim();
        if (!source) {
          setImageReviewError("Source is required (for example a book title).");
          return;
        }
        const res = await fetch("/api/me/commonplace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            source,
            ...(imageReviewCommonplaceAuthor.trim() ? { author: imageReviewCommonplaceAuthor.trim() } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not save commonplace entry.");
        }
      } else if (imageReviewDestination === "weight") {
        const w = Number.parseFloat(imageReviewWeightKg.trim());
        if (!Number.isFinite(w) || w < 20 || w > 400) {
          setImageReviewError("Enter a weight between 20 and 400 kg.");
          return;
        }
        const res = await fetch("/api/me/journal/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightKg: Math.round(w * 10) / 10 }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not save weight.");
        }
      } else if (imageReviewDestination === "sleep") {
        const h = Number.parseFloat(imageReviewSleepHours.trim());
        if (!Number.isFinite(h) || h < 0.5 || h > 24) {
          setImageReviewError("Sleep hours must be between 0.5 and 24.");
          return;
        }
        const body: Record<string, unknown> = { sleepHours: roundSleepHoursToMinute(h) };
        const hrvRaw = imageReviewHrvMs.trim();
        if (hrvRaw) {
          const hrv = Number.parseFloat(hrvRaw);
          if (Number.isFinite(hrv) && hrv >= 1 && hrv <= 300) {
            body.hrvMs = Math.round(hrv);
          }
        }
        const res = await fetch("/api/me/sleep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not save sleep.");
        }
      }

      revokePendingImagePreviews(analysesSnapshot);
      setPendingImageAnalyses(null);
      setPendingImageEditText("");
    } catch (e) {
      setImageReviewError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setImageReviewBusy(false);
    }
  }, [
    imageReviewDestination,
    pendingImageEditText,
    pendingImageAnalyses,
    imageReviewCommonplaceSource,
    imageReviewCommonplaceAuthor,
    imageReviewWeightKg,
    imageReviewSleepHours,
    imageReviewHrvMs,
    setSentenceDraft,
    revokePendingImagePreviews,
  ]);

  const handleImageReviewDiscard = useCallback(() => {
    revokePendingImagePreviews(pendingImageAnalyses);
    setPendingImageAnalyses(null);
    setPendingImageEditText("");
    setImageReviewError(null);
  }, [pendingImageAnalyses, revokePendingImagePreviews]);

  // Track new entry IDs for fade-in animation
  const prevRowIdsRef = React.useRef<Set<string>>(new Set());
  const [newRowIds, setNewRowIds] = React.useState<Set<string>>(new Set());
  /** Stagger index for each row on initial load — maps row.id → position in the first batch. */
  const [staggerIndexMap, setStaggerIndexMap] = React.useState<Map<string, number>>(new Map());

  // Drag-to-reorder state
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);
  const [dragLocalOrder, setDragLocalOrder] = React.useState<string[] | null>(null);
  const dragRowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const dragTouchStartY = React.useRef<number | null>(null);

  const togglePendingTag = useCallback((id: string) => {
    if (!onPendingHabitTagsChange) return;
    if (pendingHabitTags.includes(id)) {
      onPendingHabitTagsChange(pendingHabitTags.filter((t) => t !== id));
    } else {
      onPendingHabitTagsChange([...pendingHabitTags, id]);
    }
  }, [onPendingHabitTagsChange, pendingHabitTags]);

  const full = layout === "fullScreen";
  const quickNoteStreamEndRef = useRef<HTMLDivElement>(null);
  const prevJournalCountRef = useRef<number | null>(null);
  const captureBusy = phase === "categorizing";
  const draftDisabled = phase === "categorizing" || (!saveLineOnEnter && phase === "saving");

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

  // Track newly added rows for fade-in / staggered-load animation
  const isInitialLoadRef = React.useRef(true);
  useEffect(() => {
    const prevIds = prevRowIdsRef.current;
    const incoming = new Set<string>();
    for (const row of journalRowsOrdered) {
      if (!prevIds.has(row.id)) incoming.add(row.id);
    }
    if (incoming.size > 0) {
      setNewRowIds(incoming);
      // First time rows arrive: record per-row stagger indices so each row delays slightly more than the last.
      if (isInitialLoadRef.current) {
        const map = new Map<string, number>();
        let staggerIdx = 0;
        for (const row of journalRowsOrdered) {
          if (incoming.has(row.id)) map.set(row.id, staggerIdx++);
        }
        setStaggerIndexMap(map);
        isInitialLoadRef.current = false;
      } else {
        // Subsequent additions (new saves) get no stagger — appear instantly at index 0.
        setStaggerIndexMap(new Map());
      }
    }
    prevRowIdsRef.current = new Set(journalRowsOrdered.map((r) => r.id));
    if (incoming.size > 0) {
      // Hold the "new" flag long enough for the slowest staggered row to finish (max 12 rows × 45ms + 380ms).
      const holdMs = Math.min(incoming.size, 12) * 45 + 420;
      const t = window.setTimeout(() => {
        setNewRowIds(new Set());
        setStaggerIndexMap(new Map());
      }, holdMs);
      return () => window.clearTimeout(t);
    }
  }, [journalRowsOrdered]);

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
        if (lineSaveBusy) return;
        if (t && onSaveLine) {
          setSentenceDraft("");
          await onSaveLine(t, draftMetaRef.current);
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

  useEffect(() => {
    if (captureEntries.length === 0 || journalRowsOrdered.length === 0) return;
    setCaptureEntries((prev) => {
      const pendingEntries = prev.filter((e) => e.saveState === "pending");
      if (pendingEntries.length === 0) return prev;
      /** Remove a pending entry if any journal row arrived in the 3-minute window after we submitted it.
       * Gemini may rewrite the text entirely ("burma noodles" → "Burma Superstar tea leaf salad and garlic noodles"),
       * so we match purely on timing — not on text content. */
      const pendingIdsToRemove = new Set<string>();
      for (const entry of pendingEntries) {
        if (!entry.createdAtMs) continue;
        const hasMatchingRow = journalRowsOrdered.some(
          (row) => (row.sortAtMs ?? 0) >= entry.createdAtMs! - 5_000 &&
                   (row.sortAtMs ?? 0) <= entry.createdAtMs! + 180_000
        );
        if (hasMatchingRow) pendingIdsToRemove.add(entry.id);
      }
      if (pendingIdsToRemove.size === 0) return prev;
      return prev.filter((e) => !pendingIdsToRemove.has(e.id));
    });
  }, [captureEntries.length, journalRowsOrdered, setCaptureEntries]);

  // ── Drag-to-reorder helpers ──────────────────────────────────────────────
  const handleDragHandleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    e.stopPropagation();
    dragTouchStartY.current = e.touches[0]?.clientY ?? 0;
    setDragIdx(idx);
    setDragOverIdx(idx);
    setDragLocalOrder((prev) => prev ?? journalRowsOrdered.map((r) => r.id));
  // journalRowsOrdered captured via closure — intentionally excluded from deps for perf
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIdx === null) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const from = dragIdx;
    const refs = dragRowRefs.current;
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i];
      if (!el || i === from) continue;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if ((from < i && currentY > midY) || (from > i && currentY < midY)) {
        setDragLocalOrder((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(i, 0, moved);
          return next;
        });
        setDragIdx(i);
        setDragOverIdx(i);
        break;
      }
    }
  }, [dragIdx]);

  const handleDragTouchEnd = useCallback(() => {
    if (dragIdx === null || !dragLocalOrder || !onReorderContextEntry) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    // Compute new sortOverrideMs as midpoint between neighbours in the new order
    const newOrder = dragLocalOrder;
    const movedId = newOrder[dragIdx];
    if (movedId) {
      // Build a combined ordered list: dragLocalOrder IDs mapped back to rows
      const rowById = new Map(journalRowsOrdered.map((r) => [r.id, r]));
      const ordered = newOrder.map((id) => rowById.get(id)).filter((r): r is BrainDumpJournalContextRow => !!r);
      const prevRow = ordered[dragIdx - 1];
      const nextRow = ordered[dragIdx + 1];
      const prevMs = prevRow?.sortAtMs ?? 0;
      const nextMs = nextRow?.sortAtMs ?? (prevMs + 2000);
      const movedRow = ordered[dragIdx];
      const currentMs = movedRow?.sortAtMs ?? Date.now();
      let newSortMs: number;
      if (prevMs === 0 && nextMs > 0) {
        newSortMs = nextMs - 1000;
      } else if (prevMs > 0 && nextMs === 0) {
        newSortMs = prevMs + 1000;
      } else if (prevMs > 0 && nextMs > prevMs) {
        newSortMs = Math.round((prevMs + nextMs) / 2);
      } else {
        newSortMs = currentMs;
      }
      void onReorderContextEntry(movedId, newSortMs);
    }
    setDragIdx(null);
    setDragOverIdx(null);
    setDragLocalOrder(null);
  // journalRowsOrdered captured via closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIdx, dragLocalOrder, onReorderContextEntry]);

  // When a drag reorder is in progress, apply the local order override
  const displayRows = React.useMemo(() => {
    if (!dragLocalOrder) return journalRowsOrdered;
    const byId = new Map(journalRowsOrdered.map((r) => [r.id, r]));
    return dragLocalOrder.map((id) => byId.get(id)).filter((r): r is BrainDumpJournalContextRow => !!r);
  }, [journalRowsOrdered, dragLocalOrder]);

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
            onTagContextEntry={onTagContextEntry}
            habitsById={habitsById}
            onEditContextEntry={onEditContextEntry}
          />
        ))}
      </div>
    ) : null;

  if (full) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <BrainDumpImageIngestBar
          layout="floating"
          hintText={sentenceDraft}
          onAnalysesReady={handleImageAnalysesReady}
          disabled={draftDisabled}
          hidden={hideImageIngestBar || !!pendingImageAnalyses}
        />

        {/* Image-to-text review — portaled to body so fixed positioning is viewport-relative (LandingShell uses transform animations that trap fixed children). */}
        {pendingImageAnalyses && imageReviewPortalReady
          ? createPortal(
              <div
                className="fixed inset-0 z-[100] flex flex-col justify-end"
                onClick={handleImageReviewDiscard}
              >
            {/* scrim */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            {/* sheet */}
            <div
              className="relative max-h-[min(92dvh,100%)] overflow-y-auto overscroll-contain rounded-t-[1.5rem] border-t border-[#e8e6dc] bg-[#faf9f5] px-4 pb-[max(1.75rem,env(safe-area-inset-bottom,1.75rem))] pt-5 shadow-2xl dark:border-[#3d3d3a] dark:bg-[#1c1c1a]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* drag handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d4d2c9] dark:bg-[#4d4c48]" />

              {/* header */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-[15px] font-semibold text-[#141413] dark:text-[#faf9f5]">
                    Review & save
                  </p>
                  {imageKindHint(pendingImageAnalyses[0]?.imageKind) ? (
                    <p className="mt-0.5 text-[11px] text-[#87867f] dark:text-[#5e5d59]">
                      Detected: {imageKindHint(pendingImageAnalyses[0]?.imageKind)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleImageReviewDiscard}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#87867f] hover:bg-[#e8e6dc] dark:hover:bg-[#3d3d3a]"
                  aria-label="Discard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>

              {/* thumbnails */}
              {pendingImageAnalyses.some((a) => a.previewUrl) && (
                <div className="mb-3 flex gap-2">
                  {pendingImageAnalyses.map((a) =>
                    a.previewUrl ? (
                      <img
                        key={a.id}
                        src={a.previewUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl border border-[#e8e6dc] object-cover dark:border-[#3d3d3a]"
                      />
                    ) : null
                  )}
                </div>
              )}

              <p className="mb-2 text-[12px] text-[#87867f] dark:text-[#5e5d59]">
                Choose where this goes, edit the text if needed, then save.
              </p>

              {/* destination */}
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#87867f] dark:text-[#5e5d59]">
                Save to
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "quick_note" as const, label: "Quick note" },
                    { id: "commonplace" as const, label: "Commonplace" },
                    { id: "weight" as const, label: "Weight" },
                    { id: "sleep" as const, label: "Sleep" },
                  ] as const
                ).map((opt) => {
                  const on = imageReviewDestination === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setImageReviewDestination(opt.id)}
                      className={`rounded-xl border py-2 text-[13px] font-medium transition ${
                        on
                          ? "border-[#c96442] bg-[#c96442]/10 text-[#a85535] dark:border-[#d97757] dark:bg-[#d97757]/15 dark:text-[#faf9f5]"
                          : "border-[#e8e6dc] text-[#5e5d59] hover:bg-[#e8e6dc]/60 dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {imageReviewDestination === "commonplace" ? (
                <div className="mb-3 space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                      Source <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={imageReviewCommonplaceSource}
                      onChange={(e) => setImageReviewCommonplaceSource(e.target.value)}
                      placeholder="Book, article, speaker…"
                      className="w-full rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2 text-[14px] text-[#141413] outline-none focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                      Author <span className="text-[#87867f]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={imageReviewCommonplaceAuthor}
                      onChange={(e) => setImageReviewCommonplaceAuthor(e.target.value)}
                      placeholder="Author name"
                      className="w-full rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2 text-[14px] text-[#141413] outline-none focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
                    />
                  </div>
                </div>
              ) : null}

              {imageReviewDestination === "weight" ? (
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                    Weight (kg) <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={imageReviewWeightKg}
                    onChange={(e) => setImageReviewWeightKg(e.target.value)}
                    placeholder="e.g. 72.4"
                    className="w-full rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2 text-[14px] text-[#141413] outline-none focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
                  />
                </div>
              ) : null}

              {imageReviewDestination === "sleep" ? (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                      Sleep (hours) <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={imageReviewSleepHours}
                      onChange={(e) => setImageReviewSleepHours(e.target.value)}
                      placeholder="e.g. 7.25"
                      className="w-full rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2 text-[14px] text-[#141413] outline-none focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                      HRV (ms) <span className="text-[#87867f]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={imageReviewHrvMs}
                      onChange={(e) => setImageReviewHrvMs(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-full rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2 text-[14px] text-[#141413] outline-none focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
                    />
                  </div>
                </div>
              ) : null}

              <p className="mb-1 text-[11px] font-medium text-[#5e5d59] dark:text-[#87867f]">
                Extracted text {imageReviewDestination !== "quick_note" && imageReviewDestination !== "commonplace" ? (
                  <span className="font-normal text-[#87867f]"> (optional reference)</span>
                ) : null}
              </p>
              <textarea
                value={pendingImageEditText}
                onChange={(e) => setPendingImageEditText(e.target.value)}
                rows={imageReviewDestination === "weight" || imageReviewDestination === "sleep" ? 3 : 5}
                autoFocus
                className="mb-3 w-full resize-none rounded-xl border border-[#e8e6dc] bg-[#f5f4ed] px-3 py-2.5 text-[14px] leading-relaxed text-[#141413] outline-none transition focus:border-[#c96442]/50 focus:ring-2 focus:ring-[#c96442]/15 dark:border-[#3d3d3a] dark:bg-[#141413] dark:text-[#faf9f5]"
              />

              {imageReviewError ? (
                <p className="mb-3 text-[12px] text-red-600 dark:text-red-400" role="alert">
                  {imageReviewError}
                </p>
              ) : null}

              {/* actions */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleImageReviewDiscard}
                  disabled={imageReviewBusy}
                  className="flex-1 rounded-xl border border-[#e8e6dc] py-2.5 text-[14px] font-medium text-[#5e5d59] transition hover:bg-[#e8e6dc] disabled:opacity-40 dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void handleImageReviewSave()}
                  disabled={!imageReviewCanSave}
                  className="flex-[2] rounded-xl bg-[#c96442] py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#a85535] disabled:opacity-40 dark:bg-[#d97757] dark:hover:bg-[#c96442]"
                >
                  {imageReviewBusy ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving…
                    </span>
                  ) : imageReviewDestination === "quick_note" ? (
                    "Add to note"
                  ) : imageReviewDestination === "commonplace" ? (
                    "Save to commonplace"
                  ) : imageReviewDestination === "weight" ? (
                    "Log weight"
                  ) : (
                    "Log sleep"
                  )}
                </button>
              </div>
            </div>
              </div>,
              document.body
            )
          : null}

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain pb-14 [-webkit-overflow-scrolling:touch]"
            onTouchStart={handlePtrTouchStart}
            onTouchMove={handlePtrTouchMove}
            onTouchEnd={handlePtrTouchEnd}
          >
            {/* Pull-to-refresh indicator */}
            {onRefresh ? (
              <div
                aria-hidden
                style={{
                  height: ptrRefreshing ? PTR_THRESHOLD : ptrPullY,
                  transition: ptrPullY === 0 ? "height 0.25s ease" : undefined,
                  overflow: "hidden",
                }}
                className="flex shrink-0 items-end justify-center"
              >
                <div
                  style={{
                    opacity: ptrRefreshing ? 1 : Math.min(1, ptrPullY / PTR_THRESHOLD),
                    transform: ptrRefreshing
                      ? "none"
                      : `rotate(${Math.min(180, (ptrPullY / PTR_THRESHOLD) * 180)}deg)`,
                    transition: ptrPullY === 0 ? "opacity 0.25s ease, transform 0.25s ease" : undefined,
                  }}
                  className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#e8e6dc] text-[#87867f] shadow-sm dark:bg-[#3d3d3a] dark:text-[#a09e97]"
                >
                  {ptrRefreshing ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  )}
                </div>
              </div>
            ) : null}
            {displayRows.length === 0 && captureEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing logged yet</p>
                <p className="text-xs text-neutral-300 dark:text-neutral-600">Start typing below to add your first entry</p>
              </div>
            ) : null}
            {displayRows.map((row, i) => {
              const isNew = newRowIds.has(row.id);
              const staggerIdx = staggerIndexMap.get(row.id) ?? 0;
              return (
                <div
                  key={row.id}
                  ref={(el) => { dragRowRefs.current[i] = el; }}
                  onTouchMove={dragIdx !== null ? handleDragTouchMove : undefined}
                  onTouchEnd={dragIdx !== null ? handleDragTouchEnd : undefined}
                  style={isNew && staggerIdx > 0 ? { animationDelay: `${staggerIdx * 45}ms` } : undefined}
                >
                  <JournalContextRowNoteStream
                    row={row}
                    onOpenJournalContextEntry={onOpenJournalContextEntry}
                    onDeleteJournalContextEntry={onDeleteJournalContextEntry}
                    onOpenReflectionMentor={onOpenReflectionMentor}
                    onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
                    weightTrendSparklineKg={weightTrendSparklineKg}
                    sleepTrendSparklineHours={sleepTrendSparklineHours}
                    onTagContextEntry={onTagContextEntry}
                    habitsById={habitsById}
                    onEditContextEntry={onEditContextEntry}
                    isNew={isNew}
                    prevDayWeightKg={prevDayWeightKg}
                    prevDaySleepH={prevDaySleepH}
                    isDragging={dragIdx === i}
                    isDragTarget={dragOverIdx === i && dragIdx !== i}
                    onDragHandleTouchStart={onReorderContextEntry ? (e) => handleDragHandleTouchStart(i, e) : undefined}
                  />
                </div>
              );
            })}
            {captureEntries.map((entry) => (
              <div key={entry.id} className="mb-3">
                <CapturePersistedEntryRow entry={entry} onDelete={removeEntry} disabled={captureBusy} habitsById={habitsById} manualEstimate />
              </div>
            ))}
            <div
              className={
                journalRowsOrdered.length > 0 || captureEntries.length > 0
                  ? "mt-2"
                  : undefined
              }
            >
              <CaptureDraftSentenceRow
                draft={sentenceDraft}
                onDraftValue={handleDraftValue}
                onEnterCommit={commitDraftOnEnter}
                onMetaChange={syncDraftMeta}
                disabled={draftDisabled}
                variant="fullScreen"
                showEstimateDetailTap
                manualEstimate
                textAreaRef={draftTextareaRef}
              />
            </div>
            {phase !== "recording" &&
            !captureEntries.some((e) => e.saveState === "pending") ? (
              <p className="mt-2 px-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
                {phase === "saving" ? "Saving your note…" : "Categorizing your note…"}
              </p>
            ) : null}
            <div ref={quickNoteStreamEndRef} className="h-px w-full shrink-0 scroll-mt-12" aria-hidden />
          </div>
          {showWellnessNudges ? (
            <QuickNoteWellnessNudgeBar onNudgeCheck={handleNudgeSave} />
          ) : null}
          {quickNoteHeroHabits.length > 0 && onQuickNoteToggleHeroHabit ? (
            <QuickNoteHeroHabitsBar
              habits={quickNoteHeroHabits}
              completions={quickNoteHeroHabitCompletions}
              onToggle={onQuickNoteToggleHeroHabit}
              onOpenHabitDetail={onQuickNoteOpenHeroHabit}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Type and we&apos;ll file it in the right journal.
      </p>
      <div
        className="min-h-[min(52dvh,360px)] flex-1 overflow-y-auto rounded-xl bg-white/60 px-3 py-2 pb-24 dark:bg-neutral-900/25"
        role="list"
      >
        {journalRowsSheet}
        {captureEntries.map((entry) => (
          <CapturePersistedEntryRow key={entry.id} entry={entry} onDelete={removeEntry} disabled={captureBusy} habitsById={habitsById} />
        ))}
        <CaptureDraftSentenceRow
          draft={sentenceDraft}
          onDraftValue={handleDraftValue}
          onEnterCommit={commitDraftOnEnter}
          onMetaChange={syncDraftMeta}
          disabled={draftDisabled}
          textAreaRef={draftTextareaRef}
        />
        {phase !== "recording" ? (
          <p className="px-1 pt-2 text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
            {phase === "saving" ? "Saving your note…" : "Categorizing your note…"}
          </p>
        ) : null}
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
            <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">Sleep duration</span>
            <SleepDurationPicker
              valueHours={fields.sleepHours ?? 7.5}
              onChangeHours={(hours) =>
                setFields({
                  ...fields,
                  sleepHours: roundSleepHoursToMinute(hours),
                })
              }
              disabled={disabled}
              className="justify-end"
              selectClassName="min-w-[3.5rem] appearance-none border-0 bg-transparent text-right text-[17px] font-medium tabular-nums text-foreground focus:outline-none"
              separatorClassName="text-[17px] font-medium tabular-nums text-neutral-400"
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
