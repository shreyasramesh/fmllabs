"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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
}

const CATEGORY_META: Record<BrainDumpCategory, { label: string; color: string; icon: JSX.Element }> = {
  reflection: {
    label: "Reflection",
    color: "#5BA3D9",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.25 3a.75.75 0 01-.75.75H1.75a.75.75 0 010-1.5H3a.75.75 0 01.75.75zm14.5 0a.75.75 0 01-.75.75h-1.25a.75.75 0 010-1.5H17a.75.75 0 01.75.75zM7.172 14.828a.75.75 0 010 1.061l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm7.656 0a.75.75 0 011.061 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
      </svg>
    ),
  },
  concept: {
    label: "Concept",
    color: "#9B5FD6",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.25 3a.75.75 0 01-.75.75H1.75a.75.75 0 010-1.5H3a.75.75 0 01.75.75zm14.5 0a.75.75 0 01-.75.75h-1.25a.75.75 0 010-1.5H17a.75.75 0 01.75.75z" />
      </svg>
    ),
  },
  experiment: {
    label: "30-Day Experiment",
    color: "#E5A030",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path fillRule="evenodd" d="M8 7V3.5c0-.276.224-.5.5-.5h3c.276 0 .5.224.5.5V7l3.82 6.573c.34.586-.152 1.327-.82 1.327H5c-.668 0-1.16-.74-.82-1.327L8 7z" clipRule="evenodd" />
      </svg>
    ),
  },
};

const ALL_CATEGORIES: BrainDumpCategory[] = ["reflection", "concept", "experiment"];

interface LandingBrainDumpProps {
  language?: LanguageCode;
  onSaved?: (category: BrainDumpCategory) => void;
}

export function LandingBrainDump({ language = "en", onSaved }: LandingBrainDumpProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [fields, setFields] = useState<BrainDumpFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  const reCategorize = useCallback(
    async (newCategory: BrainDumpCategory) => {
      if (!fields || fields.category === newCategory) return;
      setPhase("categorizing");
      try {
        const res = await fetch("/api/me/brain-dump/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript }),
        });
        if (!res.ok) throw new Error("Re-categorization failed");
        const raw = (await res.json()) as BrainDumpFields;
        setFields({ ...raw, category: newCategory });
        setPhase("review");
      } catch {
        setPhase("review");
      }
    },
    [fields, transcript]
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

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={startRecording}
        aria-label="Brain Dump — voice capture"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 transition-transform hover:scale-105 active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
          <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
        </svg>
      </button>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) resetAll();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900 sm:rounded-2xl sm:p-6">
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
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground placeholder:text-neutral-400 focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:placeholder:text-neutral-500"
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
                    disabled={phase === "saving"}
                    onClick={() => void reCategorize(cat)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
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
              disabled={phase === "saving"}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base font-semibold text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />

            {/* Category-specific fields */}
            {fields.category === "reflection" && (
              <textarea
                value={fields.reflectionText ?? ""}
                onChange={(e) => setFields({ ...fields, reflectionText: e.target.value })}
                disabled={phase === "saving"}
                rows={5}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
              />
            )}

            {fields.category === "concept" && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    Summary
                  </label>
                  <textarea
                    value={fields.conceptSummary ?? ""}
                    onChange={(e) => setFields({ ...fields, conceptSummary: e.target.value })}
                    disabled={phase === "saving"}
                    rows={4}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    Enrichment prompt
                  </label>
                  <textarea
                    value={fields.conceptEnrichmentPrompt ?? ""}
                    onChange={(e) =>
                      setFields({ ...fields, conceptEnrichmentPrompt: e.target.value })
                    }
                    disabled={phase === "saving"}
                    rows={2}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </>
            )}

            {fields.category === "experiment" && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    Description
                  </label>
                  <textarea
                    value={fields.experimentDescription ?? ""}
                    onChange={(e) =>
                      setFields({ ...fields, experimentDescription: e.target.value })
                    }
                    disabled={phase === "saving"}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    How to follow through
                  </label>
                  <textarea
                    value={fields.experimentHowTo ?? ""}
                    onChange={(e) => setFields({ ...fields, experimentHowTo: e.target.value })}
                    disabled={phase === "saving"}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    Tips
                  </label>
                  <textarea
                    value={fields.experimentTips ?? ""}
                    onChange={(e) => setFields({ ...fields, experimentTips: e.target.value })}
                    disabled={phase === "saving"}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-foreground focus:border-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetAll}
                disabled={phase === "saving"}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={phase === "saving" || !fields.title.trim()}
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
    </div>
  );
}
