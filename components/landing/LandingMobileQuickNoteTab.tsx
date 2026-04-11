"use client";

import React, { useEffect } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import {
  BrainDumpCaptureView,
  type BrainDumpJournalContextRow,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

interface LandingMobileQuickNoteTabProps {
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
  onOpenJournalEntry?: (transcriptId: string) => void;
  onDeleteJournalEntry?: (transcriptId: string) => void;
  onOpenReflectionMentor?: (ctx?: { reflectionText: string }) => void;
  onOpenReflectionConversationChooser?: (ctx?: { reflectionText: string }) => void;
  weightTrendSparklineKg?: number[];
  sleepTrendSparklineHours?: number[];
}

export function LandingMobileQuickNoteTab({
  onSaved,
  journalContextRows = [],
  onOpenJournalEntry,
  onDeleteJournalEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
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
    handleTranscriptionToDraft,
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
      <BrainDumpCaptureView
        captureEntries={captureEntries}
        setCaptureEntries={setCaptureEntries}
        sentenceDraft={captureDraft}
        setSentenceDraft={setCaptureDraft}
        phase={phase === "categorizing" ? "categorizing" : "recording"}
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
      />
    </div>
  );
}
