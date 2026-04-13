"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { SparklesIcon } from "@/components/SharedIcons";
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
}

export function LandingBrainDump({
  onSaved,
  journalContextRows = [],
  onOpenJournalEntry,
  onDeleteJournalEntry,
  onOpenReflectionMentor,
  onOpenReflectionConversationChooser,
  weightTrendSparklineKg,
  sleepTrendSparklineHours,
}: LandingBrainDumpProps) {
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
  } = useBrainDumpCapture({ onSaved });

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

  if (phase === "idle") {
    return createPortal(
      <button
        type="button"
        onClick={startRecording}
        aria-label="Brain Dump — speak with Gemini"
        className="hidden md:flex fixed right-6 z-50 isolate h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 voice-fab bottom-6"
      >
        <span className="voice-fab-wave" aria-hidden />
        <span className="voice-fab-wave" style={{ animationDelay: "1.5s" }} aria-hidden />
        <SparklesIcon className="relative z-10 h-[18px] w-[18px]" />
      </button>,
      document.body
    );
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
        />
    </BrainDumpSheetFrame>,
    document.body
  );
}
