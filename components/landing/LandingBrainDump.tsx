"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { LanguageCode } from "@/lib/languages";

type Phase = "idle" | "recording" | "categorizing" | "review" | "saving";

interface BrainDumpFields {
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
  "nutrition", "exercise", "weight", "sleep", "reflection", "concept", "experiment",
];

const INPUT_CLS =
  "w-full rounded-xl border border-neutral-400/85 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-500/55 dark:bg-neutral-800";

interface LandingBrainDumpProps {
  language?: LanguageCode;
  onSaved?: (category: BrainDumpCategory) => void;
}

export function LandingBrainDump({ language = "en", onSaved }: LandingBrainDumpProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<BrainDumpFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const resetAll = useCallback(() => {
    setPhase("idle");
    setTranscript("");
    setFields(null);
    setError(null);
  }, []);

  const handleTranscription = useCallback((text: string) => {
    setTranscript((prev) => (prev ? prev + " " + text : text));
  }, []);

  const startRecording = useCallback(() => {
    setTranscript("");
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
        aria-label="Brain Dump — voice capture"
        className="fixed right-6 z-50 isolate flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 voice-fab bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
      >
        <span className="voice-fab-wave" aria-hidden />
        <span className="voice-fab-wave" style={{ animationDelay: "1.5s" }} aria-hidden />
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
          <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
        </svg>
      </button>,
      document.body
    );
  }

  const disabled = phase === "saving";

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) resetAll();
      }}
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900 sm:rounded-2xl sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Brain Dump</h2>
          <button
            type="button"
            onClick={resetAll}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Recording phase */}
        {(phase === "recording" || phase === "categorizing") && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {phase === "categorizing"
                ? "Analyzing your brain dump…"
                : "Speak freely — the AI will sort it out."}
            </p>

            {phase === "recording" && (
              <>
                {transcript && (
                  <div className="w-full rounded-xl bg-neutral-50 p-3 text-sm text-foreground dark:bg-neutral-800">
                    {transcript}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <VoiceInputButton
                    onTranscription={handleTranscription}
                    language={language}
                    ariaLabel="Record brain dump"
                    compactStopWhileListening
                  />
                  {transcript.trim() && (
                    <button
                      type="button"
                      onClick={() => void finishRecording()}
                      className="rounded-xl border border-[#B87B51] bg-[#FBF4EC] px-4 py-2.5 text-sm font-semibold text-[#7C522D] transition-colors hover:bg-[#F5E6D3] dark:border-[#B87B51] dark:bg-[#3A2A1A] dark:text-[#D6A67E] dark:hover:bg-[#4A3520]"
                    >
                      Done — Categorize
                    </button>
                  )}
                </div>

                {!transcript.trim() && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Or type below
                  </p>
                )}

                <textarea
                  className={INPUT_CLS + " placeholder:text-neutral-400 dark:placeholder:text-neutral-500"}
                  placeholder="Type your brain dump here…"
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              </>
            )}

            {phase === "categorizing" && (
              <div className="flex h-20 items-center justify-center">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            )}
          </div>
        )}

        {/* Review phase */}
        {(phase === "review" || phase === "saving") && fields && (
          <div className="flex flex-col gap-4">
            {/* Category selector */}
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const isActive = fields.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={disabled}
                    onClick={() => switchCategory(cat)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      isActive
                        ? "text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                    }`}
                    style={isActive ? { backgroundColor: meta.color } : undefined}
                  >
                    {meta.icon}
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <input
              type="text"
              value={fields.title}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              disabled={disabled}
              className="w-full rounded-xl border border-neutral-400/85 bg-neutral-50 px-3 py-2 text-base font-semibold text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-500/55 dark:bg-neutral-800"
            />

            {/* --- Category-specific fields --- */}

            {fields.category === "reflection" && (
              <textarea
                value={fields.reflectionText ?? ""}
                onChange={(e) => setFields({ ...fields, reflectionText: e.target.value })}
                disabled={disabled}
                rows={5}
                className={INPUT_CLS}
              />
            )}

            {fields.category === "concept" && (
              <>
                <FieldLabel label="Summary">
                  <textarea value={fields.conceptSummary ?? ""} onChange={(e) => setFields({ ...fields, conceptSummary: e.target.value })} disabled={disabled} rows={4} className={INPUT_CLS} />
                </FieldLabel>
                <FieldLabel label="Enrichment prompt">
                  <textarea value={fields.conceptEnrichmentPrompt ?? ""} onChange={(e) => setFields({ ...fields, conceptEnrichmentPrompt: e.target.value })} disabled={disabled} rows={2} className={INPUT_CLS} />
                </FieldLabel>
              </>
            )}

            {fields.category === "experiment" && (
              <>
                <FieldLabel label="Description">
                  <textarea value={fields.experimentDescription ?? ""} onChange={(e) => setFields({ ...fields, experimentDescription: e.target.value })} disabled={disabled} rows={3} className={INPUT_CLS} />
                </FieldLabel>
                <FieldLabel label="How to follow through">
                  <textarea value={fields.experimentHowTo ?? ""} onChange={(e) => setFields({ ...fields, experimentHowTo: e.target.value })} disabled={disabled} rows={3} className={INPUT_CLS} />
                </FieldLabel>
                <FieldLabel label="Tips">
                  <textarea value={fields.experimentTips ?? ""} onChange={(e) => setFields({ ...fields, experimentTips: e.target.value })} disabled={disabled} rows={3} className={INPUT_CLS} />
                </FieldLabel>
              </>
            )}

            {fields.category === "nutrition" && (
              <FieldLabel label="What did you eat or drink?">
                <textarea
                  value={fields.nutritionText ?? ""}
                  onChange={(e) => setFields({ ...fields, nutritionText: e.target.value })}
                  disabled={disabled}
                  rows={4}
                  className={INPUT_CLS}
                />
              </FieldLabel>
            )}

            {fields.category === "exercise" && (
              <FieldLabel label="Describe your workout">
                <textarea
                  value={fields.exerciseText ?? ""}
                  onChange={(e) => setFields({ ...fields, exerciseText: e.target.value })}
                  disabled={disabled}
                  rows={4}
                  className={INPUT_CLS}
                />
              </FieldLabel>
            )}

            {fields.category === "weight" && (
              <FieldLabel label="Weight (kg)">
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
                  className={INPUT_CLS}
                />
              </FieldLabel>
            )}

            {fields.category === "sleep" && (
              <>
                <FieldLabel label="Hours slept">
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
                    className={INPUT_CLS}
                  />
                </FieldLabel>
                <FieldLabel label="HRV (ms) — optional">
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
                    className={INPUT_CLS}
                  />
                </FieldLabel>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetAll}
                disabled={disabled}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={disabled || !fields.title.trim()}
                className="rounded-xl border border-[#B87B51] bg-[#FBF4EC] px-5 py-2 text-sm font-semibold text-[#7C522D] transition-colors hover:bg-[#F5E6D3] disabled:opacity-50 dark:border-[#B87B51] dark:bg-[#3A2A1A] dark:text-[#D6A67E] dark:hover:bg-[#4A3520]"
              >
                {phase === "saving" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </span>
                ) : (
                  `Save as ${CATEGORY_META[fields.category].label}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {children}
    </div>
  );
}
