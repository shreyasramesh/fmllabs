"use client";

import React, { useEffect } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  BrainDumpCaptureView,
  type BrainDumpJournalContextRow,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

function QuickNoteLoadingView({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16">
      <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <div className="relative h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="absolute inset-y-0 w-1/2 rounded-full bg-neutral-400 dark:bg-neutral-500"
          style={{ animation: "quickNoteBar 1.4s ease-in-out infinite" }}
        />
      </div>
      <style>{`
        @keyframes quickNoteBar {
          0%   { left: -50%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

interface LandingMobileQuickNoteTabProps {
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
  /** When true, shows a loading animation and disables entry capture. */
  isLoading?: boolean;
  /** Label shown below the progress bar while loading, e.g. "Sleep entries". */
  loadingLabel?: string;
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
}

export function LandingMobileQuickNoteTab({
  onSaved,
  journalContextRows = [],
  isLoading = false,
  loadingLabel = "Loading…",
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
        <QuickNoteLoadingView label={loadingLabel} />
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
        />
      )}
    </div>
  );
}
