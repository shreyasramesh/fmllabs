"use client";

import React, { useMemo } from "react";
import type {
  QuickNoteHighlightKind,
  QuickNoteHighlightSegment,
} from "@/lib/quick-note-highlights";

export const HIGHLIGHT_KIND_DECORATION: Record<QuickNoteHighlightKind, string> = {
  temporal: "decoration-rose-400/90 decoration-2 underline underline-offset-[3px]",
  duration: "decoration-sky-500/90 decoration-2 underline underline-offset-[3px]",
  distance: "decoration-indigo-500/90 decoration-2 underline underline-offset-[3px]",
  nutrition: "decoration-amber-500/90 decoration-2 underline underline-offset-[3px]",
  weight: "decoration-violet-500/90 decoration-2 underline underline-offset-[3px]",
  sleep: "decoration-teal-500/90 decoration-2 underline underline-offset-[3px]",
  spend: "decoration-emerald-600/90 decoration-2 underline underline-offset-[3px]",
};

const HIGHLIGHT_KIND_TINT: Record<QuickNoteHighlightKind, string> = {
  temporal: "font-medium text-rose-600 dark:text-rose-300",
  duration: "font-medium text-sky-600 dark:text-sky-300",
  distance: "font-medium text-indigo-600 dark:text-indigo-300",
  nutrition: "font-medium text-amber-700 dark:text-amber-300",
  weight: "font-medium text-violet-700 dark:text-violet-300",
  sleep: "font-medium text-teal-700 dark:text-teal-300",
  spend: "font-medium text-emerald-700 dark:text-emerald-300",
};

function fallbackHighlightReason(kind: QuickNoteHighlightKind): string {
  switch (kind) {
    case "temporal":
      return "Time-related detail highlighted by Gemini.";
    case "duration":
      return "Duration highlighted by Gemini.";
    case "distance":
      return "Distance highlighted by Gemini.";
    case "nutrition":
      return "Food, drink, calories, or nutrition detail highlighted by Gemini.";
    case "weight":
      return "Weight detail highlighted by Gemini.";
    case "sleep":
      return "Sleep detail highlighted by Gemini.";
    case "spend":
      return "Money or purchase detail highlighted by Gemini.";
  }
}

function segmentsToNodes(
  text: string,
  segments: QuickNoteHighlightSegment[],
  onHighlightPress?: (segment: QuickNoteHighlightSegment) => void,
  variant: "underline" | "tint" = "underline"
): React.ReactNode[] {
  if (!segments.length) return [text];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let hi = 0;
  for (const s of sorted) {
    if (s.start > cursor) {
      nodes.push(text.slice(cursor, s.start));
    }
    if (s.end > s.start) {
      const cls =
        variant === "tint"
          ? HIGHLIGHT_KIND_TINT[s.kind] ?? HIGHLIGHT_KIND_TINT.temporal
          : HIGHLIGHT_KIND_DECORATION[s.kind] ?? HIGHLIGHT_KIND_DECORATION.temporal;
      const reason = s.reason ?? fallbackHighlightReason(s.kind);
      const displaySegment = reason === s.reason ? s : { ...s, reason };
      nodes.push(
        <span
          key={`h-${hi++}-${s.start}-${s.kind}`}
          className={`${cls} ${onHighlightPress ? "cursor-help" : ""}`}
          title={reason}
          onClick={onHighlightPress ? () => onHighlightPress(displaySegment) : undefined}
        >
          {text.slice(s.start, s.end)}
        </span>
      );
    }
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

export function HighlightedQuickNoteText({
  text,
  segments,
  className,
  as: Tag = "span",
  onHighlightPress,
  variant = "underline",
}: {
  text: string;
  segments: QuickNoteHighlightSegment[];
  className?: string;
  as?: "span" | "p";
  onHighlightPress?: (segment: QuickNoteHighlightSegment) => void;
  variant?: "underline" | "tint";
}) {
  const nodes = useMemo(
    () => segmentsToNodes(text, segments, onHighlightPress, variant),
    [text, segments, onHighlightPress, variant]
  );
  return <Tag className={className}>{nodes}</Tag>;
}
