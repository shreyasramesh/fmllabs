"use client";

import React, { useEffect } from "react";
import { Skeleton } from "boneyard-js/react";
import { MathCurveLoader } from "@/components/MathCurveLoader";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  BrainDumpCaptureView,
  type BrainDumpJournalContextRow,
  type QuickNoteDaySummary,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

// ─── Fixture: shown to boneyard CLI so it can snapshot real layout ─────────────
function QuickNoteFixture() {
  return (
    <div className="w-full px-1 space-y-0">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2 border-b border-[#e8e6dc] dark:border-white/[.10] py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d1cfc5] dark:bg-[#4d4c48]" />
              <div className={`h-3.5 rounded bg-[#e8e6dc] dark:bg-[#3d3d3a] ${["w-2/3", "w-1/2", "w-5/6"][i]}`} />
            </div>
            <div className="ml-3.5 h-2.5 w-1/4 rounded bg-[#f0eee6] dark:bg-[#30302e]" />
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="h-3.5 w-12 rounded bg-[#e8e6dc] dark:bg-[#3d3d3a]" />
            <div className="h-2.5 w-10 rounded bg-[#f0eee6] dark:bg-[#30302e]" />
          </div>
        </div>
      ))}
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
  /** When true, hides the floating camera/gallery FAB (e.g. a modal is open on top). */
  hideImageIngestBar?: boolean;
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
  hideImageIngestBar = false,
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
    <div className="flex min-h-0 min-w-0 w-full flex-col px-3 sm:px-4">
      {error ? (
        <div className="mb-3 shrink-0 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      ) : null}
      <MathCurveLoader visible={isLoading} />
      <Skeleton name="quick-note-tab" loading={isLoading} fixture={<QuickNoteFixture />}>
        <BrainDumpCaptureView
          captureEntries={captureEntries}
          setCaptureEntries={setCaptureEntries}
          sentenceDraft={captureDraft}
          setSentenceDraft={setCaptureDraft}
          phase={
            phase === "recording" || phase === "idle"
              ? "recording"
              : phase === "saving"
                ? "saving"
                : "categorizing"
          }
          journalContextRows={journalContextRows}
          onOpenJournalContextEntry={onOpenJournalEntry}
          onDeleteJournalContextEntry={onDeleteJournalEntry}
          onOpenReflectionMentor={onOpenReflectionMentor}
          onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
          layout="fullScreen"
          saveLineOnEnter
          onSaveLine={saveSingleLine}
          lineSaveBusy={phase === "categorizing" || phase === "saving"}
          weightTrendSparklineKg={weightTrendSparklineKg}
          sleepTrendSparklineHours={sleepTrendSparklineHours}
          availableHabits={availableHabits}
          pendingHabitTags={pendingHabitTags}
          onPendingHabitTagsChange={setPendingHabitTags}
          onTagContextEntry={onTagContextEntry}
          habitsById={habitsById}
          onEditContextEntry={onEditContextEntry}
          onReorderContextEntry={onReorderContextEntry}
          hideImageIngestBar={hideImageIngestBar}
          daySummary={daySummary}
          journalStreak={journalStreak}
          prevDayWeightKg={prevDayWeightKg ?? null}
          prevDaySleepH={prevDaySleepH ?? null}
        />
      </Skeleton>
    </div>
  );
}
