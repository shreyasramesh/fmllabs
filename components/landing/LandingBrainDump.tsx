"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { SparklesIcon } from "@/components/SharedIcons";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { LanguageCode } from "@/lib/languages";
import {
  BrainDumpCaptureView,
  BrainDumpSheetFrame,
  type BrainDumpFields,
  type BrainDumpJournalContextRow,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import type { BrainDumpCaptureEntry } from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { flushSentencesFromTyping } from "@/components/landing/brain-dump/sentence-entries";

type Phase = "idle" | "recording" | "categorizing" | "saving";

interface LandingBrainDumpProps {
  language?: LanguageCode;
  /** Categories that were persisted (one per saved segment). */
  onSaved?: (categories: BrainDumpCategory[]) => void;
  journalContextRows?: BrainDumpJournalContextRow[];
  onOpenJournalEntry?: (transcriptId: string) => void;
  onDeleteJournalEntry?: (transcriptId: string) => void;
}

export function LandingBrainDump({
  language = "en",
  onSaved,
  journalContextRows = [],
  onOpenJournalEntry,
  onDeleteJournalEntry,
}: LandingBrainDumpProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [captureEntries, setCaptureEntries] = useState<BrainDumpCaptureEntry[]>([]);
  const [captureDraft, setCaptureDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const transcript = useMemo(
    () => [...captureEntries.map((e) => e.text), captureDraft].map((s) => s.trim()).filter(Boolean).join(" "),
    [captureEntries, captureDraft]
  );

  const resetAll = useCallback(() => {
    setPhase("idle");
    setCaptureEntries([]);
    setCaptureDraft("");
    setError(null);
  }, []);

  const handleTranscription = useCallback((text: string) => {
    setCaptureDraft((prev) => {
      const merged = prev ? `${prev} ${text}` : text;
      const { commits, rest } = flushSentencesFromTyping(merged);
      if (commits.length > 0) {
        setCaptureEntries((e) => [
          ...e,
          ...commits.map((t) => ({
            id: crypto.randomUUID(),
            text: t,
            frozenMeta: { status: "idle" as const },
          })),
        ]);
        return rest;
      }
      return merged;
    });
  }, []);

  const startRecording = useCallback(() => {
    setCaptureEntries([]);
    setCaptureDraft("");
    setError(null);
    setPhase("recording");
  }, []);

  const finishRecording = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      resetAll();
      return;
    }
    setPhase("categorizing");
    setError(null);
    try {
      const catRes = await fetch("/api/me/brain-dump/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!catRes.ok) {
        const data = await catRes.json().catch(() => ({}));
        throw new Error(data.error || "Categorization failed");
      }
      const catData = (await catRes.json()) as { entries?: BrainDumpFields[] };
      const entries = Array.isArray(catData.entries) ? catData.entries : [];
      if (entries.length === 0 || entries.some((e) => !e.title?.trim())) {
        throw new Error("Could not prepare this note for saving");
      }

      setPhase("saving");
      const saveRes = await fetch("/api/me/brain-dump/save-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      const saveData = (await saveRes.json()) as { results?: { category: BrainDumpCategory }[] };
      const categories = saveData.results?.map((r) => r.category) ?? [];
      onSaved?.(categories);
      resetAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("recording");
    }
  }, [transcript, resetAll, onSaved]);

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
        className="fixed right-6 z-50 isolate flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 voice-fab bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
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
      onPrimaryCapture={() => void finishRecording()}
      capturePrimaryDisabled={!transcript.trim() || phase !== "recording"}
      capturePrimaryLabel="Done"
    >
      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {(phase === "recording" || phase === "categorizing") && (
        <BrainDumpCaptureView
          captureEntries={captureEntries}
          setCaptureEntries={setCaptureEntries}
          sentenceDraft={captureDraft}
          setSentenceDraft={setCaptureDraft}
          phase={phase}
          language={language}
          onTranscription={handleTranscription}
          onRequestFinishNote={() => void finishRecording()}
          journalContextRows={journalContextRows}
          onOpenJournalContextEntry={onOpenJournalEntry}
          onDeleteJournalContextEntry={onDeleteJournalEntry}
        />
      )}

      {phase === "saving" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#295a8a] dark:border-neutral-600 dark:border-t-blue-400"
            aria-hidden
          />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Saving your note…</p>
        </div>
      )}
    </BrainDumpSheetFrame>,
    document.body
  );
}
