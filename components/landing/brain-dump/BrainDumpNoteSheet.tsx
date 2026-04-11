"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import type { LanguageCode } from "@/lib/languages";
import {
  NutritionAmyNoteBody,
  CaptureDraftSentenceRow,
  CapturePersistedEntryRow,
  AMY_PERSISTED_ROW_GRID,
  DeleteEntryIcon,
  type BrainDumpCaptureEntry,
} from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { SparklesIcon } from "@/components/SharedIcons";
import type { EntryEstimateModalMeta } from "@/components/landing/brain-dump/EntryEstimateDetailModal";
import { flushSentencesFromTyping } from "@/components/landing/brain-dump/sentence-entries";

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
      return "bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100";
    case "sleep":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-200";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

/** Chip for saved journal rows in Quick note (includes spend; uncategorized → reflection). */
export function journalContextChipClass(
  journalCategory: "nutrition" | "exercise" | "spend" | undefined
): string {
  if (journalCategory === "nutrition") return journalTypeBadgeClass("nutrition");
  if (journalCategory === "exercise") return journalTypeBadgeClass("exercise");
  if (journalCategory === "spend") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200";
  }
  return journalTypeBadgeClass("reflection");
}

const NOTE_TITLE_CLS =
  "w-full border-0 border-b border-transparent bg-transparent pb-1.5 text-2xl font-semibold tracking-tight text-foreground placeholder:text-neutral-400 focus:border-neutral-200/80 focus:outline-none focus:ring-0 dark:focus:border-neutral-600";

const NOTE_BODY_CLS =
  "w-full min-h-[12rem] flex-1 resize-none border-0 bg-transparent text-[17px] leading-[1.55] text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:placeholder:text-neutral-500";

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

export interface BrainDumpJournalContextRow {
  id: string;
  /** Same line(s) the user sees in capture — enriched entry or first journal line, not the Gemini title. */
  bodyText: string;
  categoryLabel: string;
  journalCategory: "nutrition" | "exercise" | "spend" | undefined;
  time: string;
  /** e.g. "420 cal" intake or "-180 cal" burn; null if unknown */
  caloriesSummary: string | null;
}

interface CaptureViewProps {
  captureEntries: BrainDumpCaptureEntry[];
  setCaptureEntries: React.Dispatch<React.SetStateAction<BrainDumpCaptureEntry[]>>;
  sentenceDraft: string;
  setSentenceDraft: React.Dispatch<React.SetStateAction<string>>;
  phase: "recording" | "categorizing";
  language: LanguageCode;
  onTranscription: (text: string) => void;
  /** When the draft is empty, Enter runs categorize + save (same as Done). */
  onRequestFinishNote?: () => void;
  /** Journal rows already saved for the landing dashboard day (read-only context). */
  journalContextRows?: BrainDumpJournalContextRow[];
  onOpenJournalContextEntry?: (id: string) => void;
  onDeleteJournalContextEntry?: (id: string) => void;
}

export function BrainDumpCaptureView({
  captureEntries,
  setCaptureEntries,
  sentenceDraft,
  setSentenceDraft,
  phase,
  language,
  onTranscription,
  onRequestFinishNote,
  journalContextRows = [],
  onOpenJournalContextEntry,
  onDeleteJournalContextEntry,
}: CaptureViewProps) {
  const draftMetaRef = useRef<EntryEstimateModalMeta>({ status: "idle" });
  const syncDraftMeta = useCallback((m: EntryEstimateModalMeta) => {
    draftMetaRef.current = m;
  }, []);

  if (phase === "categorizing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
        <span
          className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#295a8a] dark:border-neutral-600 dark:border-t-blue-400"
          aria-hidden
        />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Analyzing with Gemini…</p>
      </div>
    );
  }

  const handleDraftValue = (raw: string) => {
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
    const t = sentenceDraft.trim();
    if (t) {
      const snap = draftMetaRef.current;
      setCaptureEntries((prev) => [...prev, { id: crypto.randomUUID(), text: t, frozenMeta: snap }]);
      setSentenceDraft("");
      return;
    }
    onRequestFinishNote?.();
  };

  const removeEntry = (id: string) => {
    setCaptureEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Speak or type — we&apos;ll file it in the right journal. Enter commits a line; Enter on an empty line (or Done) saves
        immediately — no review screen.
      </p>
      <div
        className="min-h-[min(52dvh,360px)] flex-1 overflow-y-auto rounded-xl border border-neutral-200/70 bg-white/60 px-3 py-2 dark:border-neutral-700/60 dark:bg-neutral-900/25"
        role="list"
      >
        {journalContextRows.length > 0 ? (
          <div className="border-b border-neutral-200/60 pb-2 dark:border-neutral-700/50">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
              Today on your journal
            </p>
            {journalContextRows.map((row) => {
              const chipCls = journalContextChipClass(row.journalCategory);
              const burn = row.caloriesSummary?.startsWith("-");
              const open = () => onOpenJournalContextEntry?.(row.id);
              const calCol = (
                <>
                  {row.caloriesSummary ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[15px] font-medium tabular-nums ${
                        burn
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-blue-500 dark:text-blue-400"
                      }`}
                    >
                      <SparklesIcon className="h-4 w-4 shrink-0" />
                      {row.caloriesSummary}
                    </span>
                  ) : null}
                  {row.time ? (
                    <span className="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">{row.time}</span>
                  ) : null}
                  {!row.caloriesSummary && !row.time ? (
                    <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>
                  ) : null}
                </>
              );
              return (
                <div
                  key={row.id}
                  className={`${AMY_PERSISTED_ROW_GRID} rounded-lg py-2 transition-colors hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40`}
                >
                  <button
                    type="button"
                    onClick={open}
                    disabled={!onOpenJournalContextEntry}
                    className="min-w-0 text-left disabled:cursor-default disabled:opacity-100"
                  >
                    <span
                      className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${chipCls}`}
                    >
                      {row.categoryLabel}
                    </span>
                    <p className="text-[17px] leading-snug text-foreground whitespace-pre-wrap break-words">
                      {row.bodyText}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={open}
                    disabled={!onOpenJournalContextEntry}
                    className="justify-self-end self-start flex flex-col items-end gap-0.5 whitespace-nowrap pt-0.5 text-right disabled:cursor-default disabled:opacity-100"
                    aria-live="polite"
                  >
                    {calCol}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteJournalContextEntry?.(row.id)}
                    disabled={!onDeleteJournalContextEntry}
                    className="justify-self-end self-start rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    aria-label={`Delete journal entry: ${row.bodyText.slice(0, 40)}${row.bodyText.length > 40 ? "…" : ""}`}
                  >
                    <DeleteEntryIcon />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        {captureEntries.map((entry) => (
          <CapturePersistedEntryRow key={entry.id} entry={entry} onDelete={removeEntry} />
        ))}
        <CaptureDraftSentenceRow
          draft={sentenceDraft}
          onDraftValue={handleDraftValue}
          onEnterCommit={commitDraftOnEnter}
          onMetaChange={syncDraftMeta}
        />
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-center gap-3 border-t border-neutral-200/60 pt-3 dark:border-neutral-700/50">
        <VoiceInputButton
          onTranscription={onTranscription}
          language={language}
          ariaLabel="Dictate note"
          compactStopWhileListening
          className="!min-h-[48px] !min-w-[48px] !rounded-2xl !border-neutral-300/90 !bg-neutral-100/80 dark:!border-neutral-600 dark:!bg-neutral-800/80"
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
  const badgeCls = journalTypeBadgeClass(cat);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeCls}`}>
          {categoryMeta[cat].label}
        </span>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">Tap to change type</span>
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
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? journalTypeBadgeClass(c) + " ring-2 ring-offset-1 ring-offset-[var(--background)] ring-neutral-400/50 dark:ring-neutral-500"
                  : "bg-neutral-100/90 text-neutral-600 hover:bg-neutral-200/90 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/80"
              }`}
            >
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
