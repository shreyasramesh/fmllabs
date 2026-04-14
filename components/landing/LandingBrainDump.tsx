"use client";

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { createPortal } from "react-dom";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  BrainDumpCaptureView,
  BrainDumpSheetFrame,
  type BrainDumpJournalContextRow,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

interface LandingBrainDumpProps {
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
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

export type LandingBrainDumpHandle = {
  startRecording: () => void;
};

export const LandingBrainDump = forwardRef<LandingBrainDumpHandle, LandingBrainDumpProps>(function LandingBrainDump(
  {
    onSaved,
    journalContextRows = [],
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
  },
  ref
) {
  const {
    phase,
    captureEntries,
    setCaptureEntries,
    captureDraft,
    setCaptureDraft,
    error,
    transcript,
    resetAll,
    startRecording,
    finishBatchTranscript,
    pendingHabitTags,
    setPendingHabitTags,
  } = useBrainDumpCapture({ onSaved });

  useImperativeHandle(ref, () => ({ startRecording }), [startRecording]);

  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (phase === "idle") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetAll();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, resetAll]);

  if (!mounted) return null;

  // No floating idle button on mobile — Quick Note tab handles capture; desktop uses LandingDesktopJournalSpeedDial.
  if (phase === "idle") {
    return null;
  }

  return createPortal(
    <BrainDumpSheetFrame
      overlayRef={overlayRef}
      onBackdropClick={(e) => {
        if (e.target === overlayRef.current) resetAll();
      }}
      phase={phase}
      onClose={resetAll}
      onPrimaryCapture={() => void finishBatchTranscript()}
      capturePrimaryDisabled={!transcript.trim() || phase !== "recording"}
      capturePrimaryLabel="Done"
    >
        {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <BrainDumpCaptureView
          captureEntries={captureEntries}
          setCaptureEntries={setCaptureEntries}
          sentenceDraft={captureDraft}
          setSentenceDraft={setCaptureDraft}
          phase={phase}
          onRequestFinishNote={() => void finishBatchTranscript()}
          journalContextRows={journalContextRows}
          onOpenJournalContextEntry={onOpenJournalEntry}
          onDeleteJournalContextEntry={onDeleteJournalEntry}
          onOpenReflectionMentor={onOpenReflectionMentor}
          onOpenReflectionConversationChooser={onOpenReflectionConversationChooser}
          layout="sheet"
          weightTrendSparklineKg={weightTrendSparklineKg}
          sleepTrendSparklineHours={sleepTrendSparklineHours}
          availableHabits={availableHabits}
          pendingHabitTags={pendingHabitTags}
          onPendingHabitTagsChange={setPendingHabitTags}
          onTagContextEntry={onTagContextEntry}
          habitsById={habitsById}
          onEditContextEntry={onEditContextEntry}
        />
    </BrainDumpSheetFrame>,
    document.body
  );
});

LandingBrainDump.displayName = "LandingBrainDump";
