"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { SparklesIcon } from "@/components/SharedIcons";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { LanguageCode } from "@/lib/languages";
import {
  BrainDumpCaptureView,
  BrainDumpReviewView,
  BrainDumpSheetFrame,
  type BrainDumpFields,
} from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import type { BrainDumpCaptureEntry } from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import { flushSentencesFromTyping } from "@/components/landing/brain-dump/sentence-entries";

type Phase = "idle" | "recording" | "categorizing" | "review" | "saving";

const ICON_CLS = "h-3.5 w-3.5";

const CATEGORY_META: Record<BrainDumpCategory, { label: string; color: string; icon: JSX.Element }> = {
  reflection: {
    label: "Reflection",
    color: "#5BA3D9",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6z" />
      </svg>
    ),
  },
  concept: {
    label: "Concept",
    color: "#9B5FD6",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path d="M10 1a6 6 0 00-3.815 10.631C7.06 12.505 7.5 13.47 7.5 14.5v.5h5v-.5c0-1.03.44-1.995 1.315-2.869A6 6 0 0010 1zM7.5 16.5a.5.5 0 01.5-.5h4a.5.5 0 010 1H8a.5.5 0 01-.5-.5zm1 1.5a.5.5 0 01.5-.5h2a.5.5 0 010 1H9a.5.5 0 01-.5-.5z" />
      </svg>
    ),
  },
  experiment: {
    label: "Experiment",
    color: "#E5A030",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path fillRule="evenodd" d="M8 7V3.5c0-.276.224-.5.5-.5h3c.276 0 .5.224.5.5V7l3.82 6.573c.34.586-.152 1.327-.82 1.327H5c-.668 0-1.16-.74-.82-1.327L8 7z" clipRule="evenodd" />
      </svg>
    ),
  },
  nutrition: {
    label: "Nutrition",
    color: "#4DA065",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616c.025.086.042.174.05.264l.39 4.3A4 4 0 0112.678 16H7.322a4 4 0 01-3.976-3.925l.39-4.3c.008-.09.025-.178.05-.264l-1.233-.617a1 1 0 01.894-1.789l1.599.8L9 4.322V3a1 1 0 011-1z" />
      </svg>
    ),
  },
  exercise: {
    label: "Exercise",
    color: "#D96050",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path d="M6.75 2a.75.75 0 00-.75.75v3.5H4.56l-.3-1.49A.75.75 0 003.52 4H1.75a.75.75 0 000 1.5h1.19l.6 3H3a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h.56l.3 1.49a.75.75 0 00.74.51h1.77a.75.75 0 000-1.5H5.18l-.2-1h2.52a.75.75 0 00.75-.75v-1.5A.75.75 0 007.5 8.5H6.94l-.19-.95V2.75A.75.75 0 006.75 2zm6.5 0a.75.75 0 00-.75.75v4.8l-.19.95H11.5a.75.75 0 00-.75.75v1.5c0 .414.336.75.75.75h2.52l-.2 1h-1.19a.75.75 0 000 1.5h1.77a.75.75 0 00.74-.51l.3-1.49h.56a.75.75 0 00.75-.75v-1.5a.75.75 0 00-.75-.75h-.54l.6-3h1.19a.75.75 0 000-1.5h-1.77a.75.75 0 00-.74.76l-.3 1.49H14V2.75a.75.75 0 00-.75-.75z" />
      </svg>
    ),
  },
  weight: {
    label: "Weight",
    color: "#B87B51",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path fillRule="evenodd" d="M10 2a3 3 0 00-2.83 2H3a1 1 0 00-.98 1.196l2 10A1 1 0 005 16h10a1 1 0 00.98-.804l2-10A1 1 0 0017 4h-4.17A3 3 0 0010 2zm0 1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  sleep: {
    label: "Sleep",
    color: "#6366f1",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={ICON_CLS}>
        <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
      </svg>
    ),
  },
};

const ALL_CATEGORIES: BrainDumpCategory[] = [
  "nutrition",
  "exercise",
  "weight",
  "sleep",
  "reflection",
  "concept",
  "experiment",
];

interface LandingBrainDumpProps {
  language?: LanguageCode;
  onSaved?: (category: BrainDumpCategory) => void;
}

export function LandingBrainDump({ language = "en", onSaved }: LandingBrainDumpProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [captureEntries, setCaptureEntries] = useState<BrainDumpCaptureEntry[]>([]);
  const [captureDraft, setCaptureDraft] = useState("");
  const [fields, setFields] = useState<BrainDumpFields | null>(null);
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
    setFields(null);
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
    setFields(null);
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
      const res = await fetch("/api/me/brain-dump/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Categorization failed");
      }
      const result = (await res.json()) as BrainDumpFields;
      setFields(result);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("recording");
    }
  }, [transcript, resetAll]);

  const switchCategory = useCallback(
    (newCategory: BrainDumpCategory) => {
      if (!fields || fields.category === newCategory) return;
      setFields({ ...fields, category: newCategory });
    },
    [fields]
  );

  const handleSave = useCallback(async () => {
    if (!fields) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/me/brain-dump/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      onSaved?.(fields.category);
      resetAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setPhase("review");
    }
  }, [fields, onSaved, resetAll]);

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

  const disabled = phase === "saving";

  return createPortal(
    <BrainDumpSheetFrame
      overlayRef={overlayRef}
      onBackdropClick={(e) => {
        if (e.target === overlayRef.current) resetAll();
      }}
      phase={phase}
      onClose={resetAll}
      onPrimaryCapture={() => void finishRecording()}
      capturePrimaryDisabled={!transcript.trim()}
      capturePrimaryLabel="Done"
      onSave={() => void handleSave()}
      saveDisabled={!fields?.title.trim()}
      saving={phase === "saving"}
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
        />
      )}

      {(phase === "review" || phase === "saving") && fields && (
        <BrainDumpReviewView
          fields={fields}
          setFields={setFields}
          disabled={disabled}
          allCategories={ALL_CATEGORIES}
          categoryMeta={CATEGORY_META}
          onSwitchCategory={switchCategory}
        />
      )}
    </BrainDumpSheetFrame>,
    document.body
  );
}
