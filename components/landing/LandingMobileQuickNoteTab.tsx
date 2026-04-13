"use client";

import React, { useEffect } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  BrainDumpCaptureView,
  type BrainDumpJournalContextRow,
  type QuickNoteDaySummary,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

// ─── Skeleton loading ─────────────────────────────────────────────────────────
function SkeletonRow({ textWidth }: { textWidth: "w-1/2" | "w-2/3" | "w-5/6" }) {
  return (
    <div className="flex items-start gap-2 border-b border-neutral-200 dark:border-white/[.15] py-3 animate-pulse">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800 ${textWidth}`} />
        </div>
        <div className="ml-4 h-2.5 w-1/4 rounded bg-neutral-100 dark:bg-neutral-800/60" />
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <div className="h-3.5 w-12 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-neutral-700/50" />
      </div>
    </div>
  );
}

function QuickNoteSkeletonView({ label }: { label: string }) {
  return (
    <div className="w-full px-1">
      <p className="mb-3 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">{label}</p>
      <SkeletonRow textWidth="w-2/3" />
      <SkeletonRow textWidth="w-1/2" />
      <SkeletonRow textWidth="w-5/6" />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface LandingMobileQuickNoteTabProps {
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
  /** When true, shows skeleton rows and disables entry capture. */
  isLoading?: boolean;
  /** Label shown above skeleton rows while loading. */
  loadingLabel?: string;
  /** Aggregated stats for the selected day. */
  daySummary?: QuickNoteDaySummary;
  /** Consecutive days with at least one journal entry. */
  journalStreak?: number;
  /** Yesterday's weight in kg, for delta display. */
  prevDayWeightKg?: number | null;
  /** Yesterday's sleep hours, for delta display. */
  prevDaySleepH?: number | null;
  onOpenJournalEntry?: (transcriptId: string) => void;
  onDeleteJournalEntry?: (transcriptId: string) => void;
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  weightTrendSparklineKg?: number[];
  sleepTrendSparklineHours?: number[];
  availableHabits?: Array<{ _id: string; name: string }>;
  onTagContextEntry?: (rowId: string) => void;
  habitsById?: Record<string, string>;
  onEditContextEntry?: (rowId: string, newText: string) => Promise<void>;
  onReorderContextEntry?: (rowId: string, newSortMs: number) => Promise<void>;
}

export function LandingMobileQuickNoteTab({
  onSaved,
  journalContextRows = [],
  isLoading = false,
  loadingLabel = "Loading…",
  daySummary,
  journalStreak,
  prevDayWeightKg,
  prevDaySleepH,
  onOpenJournalEntry,
  onDeleteJournalEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
  availableHabits = [],
  onTagContextEntry,
  habitsById = {},
  onEditContextEntry,
  onReorderContextEntry,
}: LandingMobileQuickNoteTabProps) {
  const {
    phase,
    captureEntries,
    setCaptureEntries,
    captureDraft,
    setCaptureDraft,
    error,
    startRecording,
    saveSingleLine,
    pendingHabitTags,
    setPendingHabitTags,
  } = useBrainDumpCapture({ onSaved });

  useEffect(() => {
    startRecording();
  }, [startRecording]);

  return (
    <div className="flex min-h-0 w-full flex-col px-3 sm:px-4">
      {error ? (
        <div className="mb-3 shrink-0 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {isLoading ? (
        <QuickNoteSkeletonView label={loadingLabel} />
      ) : (
        <BrainDumpCaptureView
          captureEntries={captureEntries}
          setCaptureEntries={setCaptureEntries}
          sentenceDraft={captureDraft}
          setSentenceDraft={setCaptureDraft}
          phase={phase === "recording" ? "recording" : phase === "saving" ? "saving" : "categorizing"}
          journalContextRows={journalContextRows}
          onOpenJournalContextEntry={onOpenJournalEntry}
          onDeleteJournalContextEntry={onDeleteJournalEntry}
          onOpenReflectionMentor={onOpenReflectionMentor}
          onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
          layout="fullScreen"
          saveLineOnEnter
          onSaveLine={saveSingleLine}
          lineSaveBusy={phase !== "recording"}
          weightTrendSparklineKg={weightTrendSparklineKg}
          sleepTrendSparklineHours={sleepTrendSparklineHours}
          availableHabits={availableHabits}
          pendingHabitTags={pendingHabitTags}
          onPendingHabitTagsChange={setPendingHabitTags}
          onTagContextEntry={onTagContextEntry}
          habitsById={habitsById}
          onEditContextEntry={onEditContextEntry}
          onReorderContextEntry={onReorderContextEntry}
          daySummary={daySummary}
          journalStreak={journalStreak}
          prevDayWeightKg={prevDayWeightKg ?? null}
          prevDaySleepH={prevDaySleepH ?? null}
        />
      )}
    </div>
  );
}
