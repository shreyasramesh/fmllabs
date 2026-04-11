"use client";

import React, { useEffect } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { LanguageCode } from "@/lib/languages";
import {
  BrainDumpCaptureView,
  type BrainDumpJournalContextRow,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import { useBrainDumpCapture } from "@/components/landing/brain-dump/useBrainDumpCapture";

interface LandingMobileQuickNoteTabProps {
  language?: LanguageCode;
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
  onOpenJournalEntry?: (transcriptId: string) => void;
  onDeleteJournalEntry?: (transcriptId: string) => void;
  onOpenReflectionMentor?: () => void;
}

export function LandingMobileQuickNoteTab({
  language = "en",
  onSaved,
  journalContextRows = [],
  onOpenJournalEntry,
  onDeleteJournalEntry,
  onOpenReflectionMentor,
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
        language={language}
        onTranscription={handleTranscriptionToDraft}
        journalContextRows={journalContextRows}
        onOpenJournalContextEntry={onOpenJournalEntry}
        onDeleteJournalContextEntry={onDeleteJournalEntry}
        onOpenReflectionMentor={onOpenReflectionMentor}
        layout="fullScreen"
        saveLineOnEnter
        onSaveLine={saveSingleLine}
        lineSaveBusy={phase !== "recording"}
      />
    </div>
  );
}
