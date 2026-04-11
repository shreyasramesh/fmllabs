"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon } from "@/components/SharedIcons";
import {
  flushSentencesFromTyping,
  looksLikeSleepSentence,
  parseSleepHoursFromLine,
  shouldRunQuickEstimate,
  shouldShowQuickNoteEstimateColumn,
  splitIntoSentences,
} from "@/components/landing/brain-dump/sentence-entries";
import { JOURNAL_CATEGORY_DOT_BASE, quickNoteIntentDotClass } from "@/components/landing/brain-dump/journal-category-tag-styles";
import {
  EntryEstimateDetailModal,
  type EntryEstimateModalMeta,
  type NutritionEstimateDetailItem,
} from "@/components/landing/brain-dump/EntryEstimateDetailModal";
import { ThinkingEstimateLabel } from "@/components/landing/brain-dump/EstimateThinkingLabel";
import type { QuickNoteHighlightSegment } from "@/lib/quick-note-highlights";
import { validateHighlightSegments } from "@/lib/quick-note-highlights";

type LineMeta = EntryEstimateModalMeta;

export type BrainDumpCaptureEntry = {
  id: string;
  text: string;
  frozenMeta: EntryEstimateModalMeta;
};

/** Entry text fills the row; estimate stays in a dedicated right column (no wrap under text). */
const AMY_ENTRY_ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-start text-left";

/** Persisted capture row: text, estimate, delete (no per-row border). Reused for saved “today” rows in Quick note. */
export const AMY_PERSISTED_ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] gap-x-2 gap-y-1 items-start text-left";

/** Recents / journal list: tight two-row layout (badge + metrics on row 1, title + time on row 2). */
export const AMY_JOURNAL_LIST_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-[auto_auto] gap-x-2 gap-y-0 items-start text-left";

/** iOS Notes–style caret + selection tint for draft fields. */
export const NOTES_LIKE_TEXTAREA =
  "caret-[#007aff] selection:bg-[rgba(0,122,255,0.28)] dark:caret-[#0a84ff] dark:selection:bg-[rgba(10,132,255,0.35)]";

function intentPillLabel(intent: string): string {
  if (intent === "exercise") return "Exercise";
  if (intent === "mixed") return "Mixed";
  if (intent === "sleep") return "Sleep";
  return "Nutrition";
}

function SourcesGlyph({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-4 w-9 shrink-0 ${className ?? ""}`} aria-hidden>
      <span className="absolute left-0 top-0.5 h-3 w-3 rounded-full border border-white/60 bg-amber-400/95 shadow-sm dark:border-neutral-900/40" />
      <span className="absolute left-2 top-0 h-3 w-3 rounded-full border border-white/60 bg-amber-500/95 shadow-sm dark:border-neutral-900/40" />
      <span className="absolute left-[14px] top-0.5 h-3 w-3 rounded-full border border-white/60 bg-amber-300/95 shadow-sm dark:border-neutral-900/40" />
    </span>
  );
}

function LineRightMeta({ meta }: { meta: LineMeta }) {
  if (meta.status === "idle") return <span className="inline-block min-w-[4rem]" aria-hidden />;

  if (meta.status === "thinking") {
    return <ThinkingEstimateLabel />;
  }

  if (meta.status === "done" && meta.intent === "sleep") {
    const h = meta.sleepHours;
    if (h != null && h > 0) {
      const label = Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10);
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium tabular-nums text-indigo-600 dark:text-indigo-400">
          {label} h
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap text-[15px] font-medium text-indigo-600 dark:text-indigo-400">Sleep</span>
    );
  }

  const { calories, sourceCount, exerciseCaloriesBurned } = meta;
  const burn =
    exerciseCaloriesBurned != null && exerciseCaloriesBurned > 0 ? exerciseCaloriesBurned : null;

  if (burn != null && calories != null) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5 text-right">
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
          <SparklesIcon className="h-4 w-4 shrink-0" />
          −{Math.round(burn)} cal
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium tabular-nums text-blue-500 dark:text-blue-400">
          <SparklesIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          +{Math.round(calories)} cal
        </span>
      </span>
    );
  }

  if (burn != null) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
        <SparklesIcon className="h-4 w-4 shrink-0" />
        −{Math.round(burn)} cal
      </span>
    );
  }

  if (calories != null) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium tabular-nums text-blue-500 dark:text-blue-400">
        <SparklesIcon className="h-4 w-4 shrink-0" />
        {Math.round(calories)} cal
      </span>
    );
  }

  if (sourceCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] text-neutral-400 dark:text-neutral-500">
        <SourcesGlyph />
        {sourceCount} sources
      </span>
    );
  }

  return <span className="whitespace-nowrap text-[15px] text-neutral-400 dark:text-neutral-500">—</span>;
}

function useNutritionLineEstimate(line: string, runNutritionApi: boolean, runSleepLocal: boolean): LineMeta {
  const [meta, setMeta] = useState<LineMeta>({ status: "idle" });

  useEffect(() => {
    const trimmed = line.trim();
    if (!trimmed) {
      setMeta({ status: "idle" });
      return;
    }

    if (runSleepLocal) {
      const h = parseSleepHoursFromLine(trimmed);
      setMeta({
        status: "done",
        calories: null,
        exerciseCaloriesBurned: null,
        sourceCount: 0,
        confidence: h != null ? "high" : "medium",
        intent: "sleep",
        sleepHours: h,
        reasoning: "",
        assumptions: [],
        nutritionItems: [],
        nutritionNotes: "",
        exerciseNotes: "",
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        confidenceScore: h != null ? 90 : 70,
      });
      return;
    }

    if (!runNutritionApi) {
      setMeta({ status: "idle" });
      return;
    }

    const ac = new AbortController();
    setMeta({ status: "thinking" });
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/me/nutrition-quick-estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: line }),
            signal: ac.signal,
          });
          if (!res.ok) throw new Error("estimate failed");
          const data = (await res.json()) as {
            calories: number | null;
            exerciseCaloriesBurned?: number | null;
            sourceCount: number;
            confidence: string;
            intent?: string;
            reasoning?: string;
            assumptions?: unknown;
            nutritionItems?: unknown;
            nutritionNotes?: string;
            exerciseNotes?: string;
            proteinGrams?: number | null;
            carbsGrams?: number | null;
            fatGrams?: number | null;
            confidenceScore?: number;
            highlightSpans?: QuickNoteHighlightSegment[];
          };
          if (ac.signal.aborted) return;

          const assumptions = Array.isArray(data.assumptions)
            ? data.assumptions.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
            : [];

          const nutritionItems: NutritionEstimateDetailItem[] = Array.isArray(data.nutritionItems)
            ? data.nutritionItems
                .map((raw): NutritionEstimateDetailItem | null => {
                  if (!raw || typeof raw !== "object") return null;
                  const o = raw as Record<string, unknown>;
                  const name = typeof o.name === "string" ? o.name : "";
                  if (!name.trim()) return null;
                  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
                  return {
                    name: name.trim(),
                    calories: num(o.calories),
                    proteinGrams: num(o.proteinGrams),
                    carbsGrams: num(o.carbsGrams),
                    fatGrams: num(o.fatGrams),
                  };
                })
                .filter((x): x is NutritionEstimateDetailItem => x != null)
            : [];

          const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

          const exBurn = numOrNull(data.exerciseCaloriesBurned);

          const highlightSpans = validateHighlightSegments(
            line,
            Array.isArray(data.highlightSpans) ? data.highlightSpans : []
          );

          setMeta({
            status: "done",
            calories: data.calories,
            exerciseCaloriesBurned: exBurn,
            sourceCount: data.sourceCount ?? 0,
            confidence: data.confidence ?? "medium",
            intent: typeof data.intent === "string" ? data.intent : "nutrition",
            reasoning: typeof data.reasoning === "string" ? data.reasoning : "",
            assumptions,
            nutritionItems,
            nutritionNotes: typeof data.nutritionNotes === "string" ? data.nutritionNotes : "",
            exerciseNotes: typeof data.exerciseNotes === "string" ? data.exerciseNotes : "",
            proteinGrams: numOrNull(data.proteinGrams),
            carbsGrams: numOrNull(data.carbsGrams),
            fatGrams: numOrNull(data.fatGrams),
            confidenceScore:
              typeof data.confidenceScore === "number" && Number.isFinite(data.confidenceScore)
                ? Math.round(data.confidenceScore)
                : 0,
            highlightSpans,
          });
        } catch {
          if (!ac.signal.aborted) setMeta({ status: "idle" });
        }
      })();
    }, 700);

       return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [line, runNutritionApi, runSleepLocal]);

  return meta;
}

function entriesFromNutritionValue(value: string): string[] {
  if (!value) return [""];
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "" && i === lines.length - 1) {
      out.push("");
      continue;
    }
    const s = line.trim();
    if (!s) continue;
    const subs = splitIntoSentences(s);
    out.push(...(subs.length ? subs : [s]));
  }
  return out.length ? out : [""];
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

export function looksLikeFoodLogCapture(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;
  const lines = splitIntoSentences(raw);
  const parts = lines.length ? lines : [raw];
  if (parts.length === 0) return false;
  if (parts.some((l) => l.length > 220)) return false;
  if (parts.length > 14) return false;
  const foodish =
    /\b(ate|eating|eaten|breakfast|lunch|dinner|snack|drink|coffee|tea|protein|kcal|calories|cal\b|bowl|shake|eggs|chicken|salad|rice|oatmeal|smoothie|burger|fries|latte|ramen|soup|sandwich|toast|pizza|fruit|yogurt|bar\b|meal)\b/i;
  if (parts.some((l) => foodish.test(l))) return true;
  if (parts.length >= 2 && parts.every((l) => l.length < 120)) return true;
  return false;
}

/** Current line during capture: editable note text + estimate in the same row. */
export function CaptureDraftSentenceRow({
  draft,
  onDraftValue,
  onEnterCommit,
  onMetaChange,
  disabled,
  textAreaRef,
  variant = "compact",
  showEstimateDetailTap = false,
}: {
  draft: string;
  onDraftValue: (raw: string) => void;
  onEnterCommit: () => void;
  /** Latest estimate meta for this draft (parent snapshots on commit / flush so rows don’t re-fetch). */
  onMetaChange?: (meta: EntryEstimateModalMeta) => void;
  disabled?: boolean;
  textAreaRef?: React.Ref<HTMLTextAreaElement>;
  variant?: "compact" | "fullScreen";
  /** When true, tap the estimate column to open details while still typing (Quick Note tab). */
  showEstimateDetailTap?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const trimmedDraft = draft.trim();
  const estimateNutrition = shouldRunQuickEstimate(draft);
  const estimateSleep = looksLikeSleepSentence(draft);
  const showEstimateColumn = shouldShowQuickNoteEstimateColumn(draft);
  /** Keep showing calories while textarea is disabled (save in flight); do not reset estimate to idle. */
  const meta = useNutritionLineEstimate(draft, Boolean(trimmedDraft) && estimateNutrition, Boolean(trimmedDraft) && estimateSleep);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    onMetaChange?.(meta);
  }, [meta, onMetaChange]);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      taRef.current = el;
      if (typeof textAreaRef === "function") textAreaRef(el);
      else if (textAreaRef && "current" in textAreaRef) {
        (textAreaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    },
    [textAreaRef]
  );

  /** `height: 0` before measure breaks scrollHeight on some WebViews after programmatic value updates (e.g. photo transcribe). */
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const taMin =
    variant === "fullScreen"
      ? "min-h-[3.25rem]"
      : "min-h-[1.75rem]";
  const openDetailBtn =
    variant === "fullScreen"
      ? "appearance-none justify-self-end self-start whitespace-nowrap rounded-lg border-0 bg-transparent px-0.5 pt-0 text-right text-[13px] shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-neutral-800/50 dark:focus-visible:ring-blue-400/30"
      : "appearance-none justify-self-end self-start whitespace-nowrap rounded-lg border-0 bg-transparent px-1 pt-0.5 text-right shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-neutral-800/50 dark:focus-visible:ring-blue-400/30";

  const rightCol =
    showEstimateColumn || !draft.trim() ? (
      <LineRightMeta meta={meta} />
    ) : (
      <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>
    );

  return (
    <>
      <div
        className={`${AMY_ENTRY_ROW_GRID} min-h-0 flex-1 ${variant === "fullScreen" ? "items-start py-0.5" : "py-1.5"} ${
          disabled ? "pointer-events-none select-none opacity-[0.52] transition-opacity duration-200" : ""
        }`}
        aria-busy={disabled || undefined}
      >
        <textarea
          ref={setRefs}
          value={draft}
          onChange={(e) => onDraftValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnterCommit();
            }
          }}
          disabled={disabled}
          rows={variant === "fullScreen" ? 2 : 1}
          autoFocus
          placeholder={variant === "fullScreen" ? "Start typing…" : "Start typing or add photos below…"}
          className={`${taMin} min-w-0 w-full resize-none border-0 bg-transparent ${variant === "fullScreen" ? "text-[16px] leading-tight" : "text-[17px] leading-snug"} text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-100 ${NOTES_LIKE_TEXTAREA}`}
          aria-label="Note draft"
        />
        {showEstimateDetailTap ? (
          <button
            type="button"
            disabled={disabled || !draft.trim()}
            onClick={() => setDetailOpen(true)}
            className={openDetailBtn}
            aria-label={draft.trim() ? "View estimate details for this line" : "Estimate details"}
            aria-live="polite"
          >
            {rightCol}
          </button>
        ) : (
          <span
            className={`justify-self-end self-start whitespace-nowrap text-right ${variant === "fullScreen" ? "pt-0 text-[13px]" : "pt-0.5"}`}
            aria-live="polite"
          >
            {rightCol}
          </span>
        )}
      </div>
      {showEstimateDetailTap ? (
        <EntryEstimateDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          text={draft}
          attemptedEstimate={showEstimateColumn}
          meta={meta}
        />
      ) : null}
    </>
  );
}

export function DeleteEntryIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

/** Persisted capture line: frozen analysis when done (no second request); tap text or estimate to open detail modal. */
export function CapturePersistedEntryRow({ entry, onDelete }: { entry: BrainDumpCaptureEntry; onDelete: (id: string) => void }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const trimmed = entry.text.trim();
  const useLive =
    entry.frozenMeta.status !== "done" && shouldShowQuickNoteEstimateColumn(entry.text) && Boolean(trimmed);
  const liveMeta = useNutritionLineEstimate(
    entry.text,
    useLive && shouldRunQuickEstimate(entry.text),
    useLive && looksLikeSleepSentence(entry.text)
  );
  const meta = entry.frozenMeta.status === "done" ? entry.frozenMeta : liveMeta;

  const attemptedEstimate = shouldShowQuickNoteEstimateColumn(entry.text);
  const showEstimateColumn = attemptedEstimate || meta.status !== "idle";

  const openDetailBtn =
    "appearance-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:focus-visible:ring-blue-400/30";

  return (
    <>
      <div className={`${AMY_PERSISTED_ROW_GRID} py-1.5`}>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className={`min-w-0 text-left ${openDetailBtn}`}
          aria-label={`View estimate details: ${entry.text.slice(0, 48)}${entry.text.length > 48 ? "…" : ""}`}
        >
          <div className="flex min-w-0 items-start gap-2">
            {meta.status === "done" ? (
              <span
                className={`mt-[0.35rem] ${JOURNAL_CATEGORY_DOT_BASE} ${quickNoteIntentDotClass(meta.intent)}`}
                title={intentPillLabel(meta.intent)}
                aria-hidden
              />
            ) : null}
            <p className="min-w-0 flex-1 text-[17px] leading-tight text-foreground">{entry.text}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className={`justify-self-end self-start whitespace-nowrap text-right ${openDetailBtn}`}
          aria-live="polite"
          aria-label="View estimate details for this line"
        >
          {showEstimateColumn ? (
            <LineRightMeta meta={meta} />
          ) : (
            <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="appearance-none justify-self-end self-start rounded-lg border-0 bg-transparent p-1.5 text-neutral-400 shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus-visible:ring-blue-400/30"
          aria-label={`Remove entry: ${entry.text.slice(0, 40)}${entry.text.length > 40 ? "…" : ""}`}
        >
          <DeleteEntryIcon />
        </button>
      </div>
      <EntryEstimateDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        text={entry.text}
        attemptedEstimate={attemptedEstimate}
        meta={meta}
      />
    </>
  );
}

interface NutritionAmyNoteBodyProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Editable Amy-style nutrition note: one row per sentence, right column Thinking / sources / sparkle + cal.
 */
export function NutritionAmyNoteBody({ value, onChange, disabled, "aria-label": ariaLabel }: NutritionAmyNoteBodyProps) {
  const lines = useMemo(() => entriesFromNutritionValue(value), [value]);
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const setLine = useCallback(
    (index: number, lineText: string) => {
      const { commits, rest } = flushSentencesFromTyping(lineText);
      let next = [...lines];
      if (commits.length === 0) {
        next[index] = lineText;
        onChange(joinLines(next));
        return;
      }
      const pieces: string[] = [...commits];
      if (rest.trim()) pieces.push(rest);
      next.splice(index, 1, ...pieces);
      onChange(joinLines(next));
      const focusIdx = index + pieces.length - 1;
      window.requestAnimationFrame(() => {
        inputRefs.current[focusIdx]?.focus();
      });
    },
    [lines, onChange]
  );

  const insertLineAfter = useCallback(
    (index: number) => {
      const next = [...lines.slice(0, index + 1), "", ...lines.slice(index + 1)];
      onChange(next.join("\n"));
      window.requestAnimationFrame(() => {
        inputRefs.current[index + 1]?.focus();
      });
    },
    [lines, onChange]
  );

  const removeLineIfEmpty = useCallback(
    (index: number) => {
      if (lines.length <= 1) return;
      if (lines[index]?.trim() !== "") return;
      const next = lines.filter((_, i) => i !== index);
      onChange(next.length ? joinLines(next) : "");
    },
    [lines, onChange]
  );

  return (
    <div className="flex flex-col" role="group" aria-label={ariaLabel ?? "Nutrition entries"}>
      {lines.map((line, idx) => (
        <EditableAmyRow
          key={`row-${idx}`}
          line={line}
          disabled={disabled}
          onChange={(t) => setLine(idx, t)}
          onEnter={() => insertLineAfter(idx)}
          onBackspaceEmpty={() => removeLineIfEmpty(idx)}
          inputRef={(el) => {
            inputRefs.current[idx] = el;
          }}
        />
      ))}
    </div>
  );
}

function EditableAmyRow({
  line,
  disabled,
  onChange,
  onEnter,
  onBackspaceEmpty,
  inputRef,
}: {
  line: string;
  disabled?: boolean;
  onChange: (t: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const trimmed = line.trim();
  const showEstimateCol = shouldShowQuickNoteEstimateColumn(line);
  const meta = useNutritionLineEstimate(
    line,
    Boolean(trimmed) && shouldRunQuickEstimate(line),
    Boolean(trimmed) && looksLikeSleepSentence(line)
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      taRef.current = el;
      inputRef(el);
    },
    [inputRef]
  );

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [line]);

  return (
    <>
      <div className={`${AMY_ENTRY_ROW_GRID} border-b border-transparent py-1.5 last:border-b-0`}>
        <textarea
          ref={setRefs}
          value={line}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnter();
            }
            if (e.key === "Backspace" && line === "") {
              e.preventDefault();
              onBackspaceEmpty();
            }
          }}
          placeholder="Food or drink…"
          className="min-h-[1.75rem] min-w-0 resize-none border-0 bg-transparent text-[17px] leading-snug text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:placeholder:text-neutral-500"
          aria-label={line.trim() ? `Food line: ${line.slice(0, 40)}` : "New food line"}
        />
        <button
          type="button"
          disabled={disabled || !line.trim()}
          onClick={() => setDetailOpen(true)}
          className="appearance-none justify-self-end self-start rounded-lg border-0 bg-transparent px-1 pt-1 text-right shadow-none outline-none ring-0 transition-colors hover:bg-neutral-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#295a8a]/25 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-neutral-800/50 dark:disabled:hover:bg-transparent dark:focus-visible:ring-blue-400/30"
          aria-label={line.trim() ? "View estimate details for this line" : "Details for new line"}
        >
          {showEstimateCol || line.trim() === "" ? <LineRightMeta meta={meta} /> : <span className="text-[15px] text-neutral-400 dark:text-neutral-500">—</span>}
        </button>
      </div>
      <EntryEstimateDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        text={line}
        attemptedEstimate={showEstimateCol}
        meta={meta}
      />
    </>
  );
}
