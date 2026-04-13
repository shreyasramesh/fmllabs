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
import { flushSentencesFromTyping } from "@/components/landing/brain-dump/sentence-entries";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";
import { SleepDurationPicker } from "@/components/landing/SleepDurationPicker";
import { roundSleepHoursToMinute } from "@/lib/sleep-duration";
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
  /** Habits the user has tagged this entry to. */
  habitTags?: string[];
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
  "inline-flex items-center gap-1 rounded-full border border-[#B87B51]/45 bg-[#B87B51]/12 font-semibold text-[#7C522D] dark:border-[#D6A67E]/50 dark:bg-[#D6A67E]/15 dark:text-[#F3D6B7]";
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
}: {
  values: number[];
  kind: "weight" | "sleep";
  className?: string;
  width?: number;
}) {
  if (values.length === 0) return null;
  const w = width;
  const h = 36;
  const topPad = 10;
  const bottomPad = 9;
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
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={pts.join(" ")}
      />
      {labels.map(({ point, placement }) => {
        const label = formatValue(point.value);
        const approxWidth = label.length * 4.2;
        const textX = Math.min(w - approxWidth / 2 - 1, Math.max(approxWidth / 2 + 1, point.x));
        const textY =
          placement === "above"
            ? Math.max(6.5, point.y - 6)
            : Math.min(h - 1.5, point.y + 10);
        return (
          <g key={`spark-label-${point.index}`}>
            <circle cx={point.x} cy={point.y} r="1.8" fill="currentColor" />
            <text
              x={textX}
              y={textY}
              fontSize="6.2"
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
  onEditContextEntry?: (rowId: string, newText: string) => Promise<void>;
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
    <div className="py-1.5">
      {inlineEditForm}
      {!editing && (
        <div className="flex items-start gap-2 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40">
          {/* LEFT: text + edit + tag + time inline, secondary/mentor/pills below */}
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
              {timeOnly}
            </div>
            {row.secondaryText ? (
              <div className={`pl-[14px] text-left ${JOURNAL_SECONDARY_TEXT_CLASS}`}>{row.secondaryText}</div>
            ) : null}
            {sheetMentorBtns ? (
              <div className="mt-0.5 flex flex-wrap gap-1 pl-5">{sheetMentorBtns}</div>
            ) : null}
            {habitPills}
          </div>
          {/* RIGHT: analysis + delete */}
          <div className="shrink-0 flex items-center gap-1.5 self-start pt-[2px]">
            {sheetRightAnalysis}
            <button
              type="button"
              onClick={() => void onDeleteJournalContextEntry?.(row.id)}
              disabled={!onDeleteJournalContextEntry || !isJournalContextRowDeletable(row)}
              className="shrink-0 appearance-none rounded-lg border-0 bg-transparent p-1 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-red-400/30"
              aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
            >
              <DeleteEntryIcon />
            </button>
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
  onEditContextEntry?: (rowId: string, newText: string) => Promise<void>;
}) {
  const [nsEditing, setNsEditing] = React.useState(false);
  const [nsEditDraft, setNsEditDraft] = React.useState("");
  const [nsEditSaving, setNsEditSaving] = React.useState(false);
  const nsEditTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const nsCanEdit = !!onEditContextEntry && row.rowSource === "transcript" &&
    (row.journalCategory === "reflection" || row.journalCategory === "nutrition" ||
     row.journalCategory === "exercise" || row.journalCategory === "spend" || row.journalCategory === undefined);

  const nsStartEdit = () => {
    setNsEditDraft(row.bodyText);
    setNsEditing(true);
    requestAnimationFrame(() => { nsEditTextareaRef.current?.focus(); });
  };

  const nsCancelEdit = () => setNsEditing(false);

  const nsSaveEdit = async () => {
    const trimmed = nsEditDraft.trim();
    if (!trimmed || !onEditContextEntry || nsEditSaving) return;
    setNsEditSaving(true);
    try {
      await onEditContextEntry(row.id, trimmed);
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
      <div className="flex items-center justify-end gap-2">
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
          disabled={!nsEditDraft.trim() || nsEditSaving}
          onClick={() => void nsSaveEdit()}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {nsEditSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  ) : null;

  const rawDisplay = row.bodyText.trim();

  // Right-rail analysis: calories for nutrition/exercise, sparkline for weight/sleep,
  // otherwise any leftover cal/metric value for entries that don't use the compact paths.
  const nsRightAnalysis = caloriesOnLeft ? (
    <span
      className={`text-[12px] font-semibold tabular-nums leading-none ${
        burn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      }`}
    >
      {row.caloriesSummary}
    </span>
  ) : metricOnLeft && leftRailTrendValues && leftRailTrendValues.length > 0 ? (
    <MiniTrendSparkline
      values={leftRailTrendValues}
      kind={row.journalCategory === "weight" ? "weight" : "sleep"}
      width={96}
      className={`shrink-0 ${journalContextRowMetricToneClass(row.journalCategory)}`}
    />
  ) : cal ?? metric ?? null;

  return (
    <article className="mb-3 min-w-0">
      {nsInlineEditForm}
      {!nsEditing && (
        <div className="flex items-start gap-2">
          {/* LEFT: text + edit + tag + time inline, secondary/pills below */}
          <div className="min-w-0 flex-1">
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
              {nsTimeEl}
            </div>
            {row.secondaryText ? (
              <div className={`pl-[14px] text-left ${JOURNAL_SECONDARY_TEXT_CLASS}`}>{row.secondaryText}</div>
            ) : null}
            {reflectionMentorActions ? (
              <div className="mt-0.5 flex flex-wrap gap-1 pl-5">{reflectionMentorActions}</div>
            ) : null}
            {nsHabitPills}
          </div>
          {/* RIGHT: analysis + delete */}
          <div className="shrink-0 flex items-center gap-1.5 self-start pt-[2px]">
            {nsRightAnalysis}
            {onDeleteJournalContextEntry && isJournalContextRowDeletable(row) ? (
              <button
                type="button"
                onClick={() => void onDeleteJournalContextEntry(row.id)}
                className="shrink-0 appearance-none rounded-md border-0 bg-transparent p-0.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-red-400/30"
                aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
              >
                <DeleteEntryIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Habit tag pill colors ────────────────────────────────────────────────────
const HABIT_PILL_CLS =
  "inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-700/40 dark:bg-violet-950/40 dark:text-violet-300";

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
                <HabitTagIcon className="h-2.5 w-2.5 shrink-0" />
                {h.name}
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/50"
                  aria-label={`Remove habit tag: ${h.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
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
        className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
          hasSelected
            ? "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50"
            : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
        aria-expanded={open}
        aria-label="Link to a habit"
      >
        <HabitTagIcon className="h-3 w-3 shrink-0" />
        {hasSelected ? `${selectedIds.length} habit${selectedIds.length > 1 ? "s" : ""} linked` : "Link habit"}
      </button>
      {/* Picker dropdown */}
      {open ? (
        <div className="mt-0.5 flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          {availableHabits.map((h) => {
            const selected = selectedIds.includes(h._id);
            return (
              <button
                key={h._id}
                type="button"
                onClick={() => { onToggle(h._id); }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  selected
                    ? "border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-200"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
                }`}
                aria-pressed={selected}
              >
                {selected ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
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
  onEditContextEntry?: (rowId: string, newText: string) => Promise<void>;
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
}: CaptureViewProps) {
  const draftMetaRef = useRef<EntryEstimateModalMeta>({ status: "idle" });
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const syncDraftMeta = useCallback((m: EntryEstimateModalMeta) => {
    draftMetaRef.current = m;
  }, []);

  const [habitPickerOpen, setHabitPickerOpen] = React.useState(false);

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
      const next = prev.filter(
        (entry) =>
          !(
            entry.saveState === "pending" &&
            journalRowsOrdered.some((row) => {
              if (row.bodyText.trim() !== entry.text.trim()) return false;
              if (!entry.createdAtMs) return true;
              return (row.sortAtMs ?? 0) >= entry.createdAtMs - 120000;
            })
          )
      );
      return next.length === prev.length ? prev : next;
    });
  }, [captureEntries.length, journalRowsOrdered, setCaptureEntries]);

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
                onTagContextEntry={onTagContextEntry}
                habitsById={habitsById}
                onEditContextEntry={onEditContextEntry}
              />
            ))}
            {captureEntries.map((entry) => (
              <div key={entry.id} className="mb-3">
                <CapturePersistedEntryRow entry={entry} onDelete={removeEntry} disabled={captureBusy} habitsById={habitsById} />
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
                textAreaRef={draftTextareaRef}
              />
            </div>
            {phase !== "recording" ? (
              <p className="mt-2 px-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
                {phase === "saving" ? "Saving your note…" : "Categorizing your note…"}
              </p>
            ) : null}
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
