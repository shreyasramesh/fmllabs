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

function segmentsToNodes(text: string, segments: QuickNoteHighlightSegment[]): React.ReactNode[] {
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
        HIGHLIGHT_KIND_DECORATION[s.kind] ?? HIGHLIGHT_KIND_DECORATION.temporal;
      nodes.push(
        <span key={`h-${hi++}-${s.start}-${s.kind}`} className={cls}>
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
}: {
  text: string;
  segments: QuickNoteHighlightSegment[];
  className?: string;
  as?: "span" | "p";
}) {
  const nodes = useMemo(() => segmentsToNodes(text, segments), [text, segments]);
  return <Tag className={className}>{nodes}</Tag>;
}
