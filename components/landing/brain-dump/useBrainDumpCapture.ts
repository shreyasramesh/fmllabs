"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { BrainDumpFields } from "@/components/landing/brain-dump/BrainDumpNoteSheet";
import type { BrainDumpCaptureEntry } from "@/components/landing/brain-dump/NutritionAmyNoteBody";
import type { EntryEstimateModalMeta } from "@/components/landing/brain-dump/EntryEstimateDetailModal";
import { flushSentencesFromTyping, shouldRunQuickEstimate } from "@/components/landing/brain-dump/sentence-entries";
import type { ClientQuickCalorieSnapshot } from "@/lib/quick-calorie-snapshot";

export type BrainDumpModalPhase = "idle" | "recording" | "categorizing" | "saving";

function doneMetaToQuickSnapshot(line: string, meta: EntryEstimateModalMeta): ClientQuickCalorieSnapshot | null {
  if (meta.status !== "done") return null;
  const t = line.trim();
  if (!t) return null;
  return {
    sourceText: t,
    intent: meta.intent,
    calories: meta.calories,
    exerciseCaloriesBurned: meta.exerciseCaloriesBurned,
    assumptions: meta.assumptions,
    nutritionNotes: meta.nutritionNotes,
    exerciseNotes: meta.exerciseNotes,
    proteinGrams: meta.proteinGrams,
    carbsGrams: meta.carbsGrams,
    fatGrams: meta.fatGrams,
    reasoning: meta.reasoning,
    highlightSpans: meta.highlightSpans ?? [],
  };
}

export function useBrainDumpCapture(options: {
  onSaved?: (categories: BrainDumpCategory[]) => void;
}) {
  const { onSaved } = options;
  const quickNoteSaveInFlightRef = useRef(false);
  const [phase, setPhase] = useState<BrainDumpModalPhase>("idle");
  const [captureEntries, setCaptureEntries] = useState<BrainDumpCaptureEntry[]>([]);
  const [captureDraft, setCaptureDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const startRecording = useCallback(() => {
    setCaptureEntries([]);
    setCaptureDraft("");
    setError(null);
    setPhase("recording");
  }, []);

  const persistEntries = useCallback(
    async (entries: BrainDumpFields[], clientQuickCalories?: ClientQuickCalorieSnapshot[]) => {
      if (entries.length === 0 || entries.some((e) => !e.title?.trim())) {
        throw new Error("Could not prepare this note for saving");
      }
      setPhase("saving");
      const payload: Record<string, unknown> = { entries };
      if (clientQuickCalories && clientQuickCalories.length > 0) {
        payload.clientQuickCalories = clientQuickCalories;
      }
      const saveRes = await fetch("/api/me/brain-dump/save-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      const saveData = (await saveRes.json()) as { results?: { category: BrainDumpCategory }[] };
      const categories = saveData.results?.map((r) => r.category) ?? [];
      onSaved?.(categories);
    },
    [onSaved]
  );

  const categorizeText = useCallback(async (text: string) => {
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
    return Array.isArray(catData.entries) ? catData.entries : [];
  }, []);

  /** Mobile Quick Note: one line → categorize + save. Stays on tab (phase returns to recording). */
  const saveSingleLine = useCallback(
    async (line: string, frozenMeta: EntryEstimateModalMeta) => {
      const text = line.trim();
      if (!text) return;
      if (quickNoteSaveInFlightRef.current) return;
      quickNoteSaveInFlightRef.current = true;
      setPhase("categorizing");
      setError(null);
      try {
        const snap =
          frozenMeta.status === "done" && shouldRunQuickEstimate(text)
            ? doneMetaToQuickSnapshot(text, frozenMeta)
            : null;
        const entries = await categorizeText(text);

        const quickCals =
          snap && entries.length === 1 ? ([snap] satisfies ClientQuickCalorieSnapshot[]) : undefined;
        await persistEntries(entries, quickCals);
        setPhase("recording");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setPhase("recording");
      } finally {
        quickNoteSaveInFlightRef.current = false;
      }
    },
    [categorizeText, persistEntries]
  );

  /** Modal Done / empty-line commit: full transcript. */
  const finishBatchTranscript = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      resetAll();
      return;
    }
    setPhase("categorizing");
    setError(null);
    try {
      const entries = await categorizeText(text);
      await persistEntries(entries);
      resetAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("recording");
    }
  }, [transcript, categorizeText, persistEntries, resetAll]);

  /** Brain dump modal: flush voice sentences into local rows. */
  const handleTranscriptionToEntries = useCallback((text: string) => {
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

  /** Quick Note tab: voice only extends the draft (Enter saves). */
  const handleTranscriptionToDraft = useCallback((text: string) => {
    setCaptureDraft((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  return {
    phase,
    captureEntries,
    setCaptureEntries,
    captureDraft,
    setCaptureDraft,
    error,
    setError,
    transcript,
    resetAll,
    startRecording,
    saveSingleLine,
    finishBatchTranscript,
    handleTranscriptionToEntries,
    handleTranscriptionToDraft,
  };
}
