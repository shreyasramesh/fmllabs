"use client";

import { useState } from "react";

const MENTION_CHIP_CLASS =
  "inline-flex items-baseline py-px px-1.5 rounded-lg text-sm font-medium bg-foreground text-background border-[0.6px] border-background cursor-pointer hover:opacity-90 transition-opacity duration-150 active:scale-[0.98] align-baseline";
const ASSISTANT_MENTION_CHIP_CLASS =
  "inline-flex items-baseline py-px px-1.5 rounded-lg text-sm font-medium bg-background text-foreground border-[0.6px] border-foreground cursor-pointer hover:opacity-90 transition-opacity duration-150 active:scale-[0.98] align-baseline";
const INLINE_MARKDOWN_REGEX = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

type Segment =
  | { type: "text"; value: string }
  | { type: "mental_model"; id: string; name: string }
  | { type: "long_term_memory"; id: string; title: string }
  | { type: "custom_concept"; id: string; title: string }
  | { type: "concept_group"; id: string; title: string }
  | { type: "figure"; id: string; name: string };

/** New format: [[id]] / [[memory:id]] / [[concept:id]] / [[group:id]] / [[figure:id]] / [[Display Name]] */
const FIGURE_TOKEN_REGEX = /\[\[figure:([a-z0-9_]+)\]\]/g;
const MM_TOKEN_REGEX = /\[\[(?!memory:|concept:|group:|figure:)([a-z0-9_]+)\]\]/g;
const MM_NAME_TOKEN_REGEX = /\[\s*\[\s*([^\]]+?)\s*\]\s*\]/g; // [[Display Name]] - resolved via nameToId
const LTM_TOKEN_REGEX = /\[\[memory:([a-fA-F0-9]{24})\]\]/g;
const CC_TOKEN_REGEX = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_TOKEN_REGEX = /\[\[group:([a-fA-F0-9]{24})\]\]/g;
/** Legacy format: @mm:id / @ltm:id / @cc:id / @cd:id / @cg:id (for backward compatibility with stored messages) */
const LEGACY_MM_REGEX = /@mm:([a-z0-9_]+)/g;
const LEGACY_LTM_REGEX = /@ltm:([a-fA-F0-9]{24})/g;
const LEGACY_CC_REGEX = /@cc:([a-fA-F0-9]{24})/g;
const LEGACY_CD_REGEX = /@cd:([a-fA-F0-9]{24})/g;
const LEGACY_CG_REGEX = /@cg:([a-fA-F0-9]{24})/g;

/** Find exact mental model name matches in text (case-insensitive) and convert to references. Names sorted by length (longest first) to avoid partial matches. */
function findExactNameMatches(
  text: string,
  nameToId: Map<string, string>
): { index: number; length: number; id: string; name: string }[] {
  const names = Array.from(nameToId.keys()).filter((n) => n.length > 0);
  if (names.length === 0) return [];
  const sortedNames = [...names].sort((a, b) => b.length - a.length);
  const matches: { index: number; length: number; id: string; name: string }[] = [];
  const usedRanges: [number, number][] = [];
  const textLower = text.toLowerCase();

  for (const name of sortedNames) {
    const nameLower = name.toLowerCase();
    let i = 0;
    while ((i = textLower.indexOf(nameLower, i)) !== -1) {
      const end = i + name.length;
      const overlaps = usedRanges.some(([s, e]) => end > s && i < e);
      if (!overlaps) {
        const id = nameToId.get(name)!;
        matches.push({ index: i, length: name.length, id, name });
        usedRanges.push([i, end]);
      }
      i += 1;
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

function parseUserMessageContent(
  content: string,
  idToName: Map<string, string>,
  ltmIdToTitle: Map<string, string>,
  ccIdToTitle: Map<string, string>,
  cgIdToTitle: Map<string, string>,
  figureIdToName: Map<string, string>
): Segment[] {
  const nameToId = new Map<string, string>();
  idToName.forEach((name, id) => nameToId.set(name, id));

  const segments: Segment[] = [];
  const matches: { index: number; type: "mm" | "ltm" | "cc" | "cd" | "figure"; id: string; token: string }[] = [
    ...[...content.matchAll(FIGURE_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "figure" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LTM_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "ltm" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LEGACY_LTM_REGEX)].map((m) => ({
      index: m.index!,
      type: "ltm" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(CC_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "cc" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LEGACY_CC_REGEX)].map((m) => ({
      index: m.index!,
      type: "cc" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(CG_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LEGACY_CD_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LEGACY_CG_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(MM_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "mm" as const,
      id: m[1],
      token: m[0],
    })),
    ...[...content.matchAll(LEGACY_MM_REGEX)].map((m) => ({
      index: m.index!,
      type: "mm" as const,
      id: m[1],
      token: m[0],
    })),
    // [[Display Name]] - match when content is a known name (not id format)
    ...[...content.matchAll(MM_NAME_TOKEN_REGEX)]
      .filter((m) => {
        const trimmed = m[1].trim();
        return !/^[a-z0-9_]+$/.test(trimmed) && nameToId.has(trimmed);
      })
      .map((m) => ({
        index: m.index!,
        type: "mm" as const,
        id: nameToId.get(m[1].trim())!,
        token: m[0],
      })),
  ];
  matches.sort((a, b) => a.index - b.index);

  // Deduplicate overlapping matches (e.g. [[id]] matched by both MM_TOKEN and MM_NAME)
  const seen = new Set<number>();
  const deduped = matches.filter((m) => {
    for (let i = m.index; i < m.index + m.token.length; i++) {
      if (seen.has(i)) return false;
    }
    for (let i = m.index; i < m.index + m.token.length; i++) {
      seen.add(i);
    }
    return true;
  });

  let lastIndex = 0;
  for (const match of deduped) {
    const token = match.token;
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }
    if (match.type === "mm") {
      segments.push({
        type: "mental_model",
        id: match.id,
        name: idToName.get(match.id) ?? match.id.replace(/_/g, " "),
      });
    } else if (match.type === "figure") {
      const fallbackName = match.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      segments.push({
        type: "figure",
        id: match.id,
        name: figureIdToName.get(match.id) ?? fallbackName,
      });
    } else if (match.type === "ltm") {
      segments.push({
        type: "long_term_memory",
        id: match.id,
        title: ltmIdToTitle.get(match.id) ?? "Memory",
      });
    } else if (match.type === "cd") {
      segments.push({
        type: "concept_group",
        id: match.id,
        title: cgIdToTitle.get(match.id) ?? "Group",
      });
    } else {
      segments.push({
        type: "custom_concept",
        id: match.id,
        title: ccIdToTitle.get(match.id) ?? "Concept",
      });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  // Second pass: convert exact mental model name matches in text segments to references
  const expandedSegments: Segment[] = [];
  for (const seg of segments) {
    if (seg.type !== "text") {
      expandedSegments.push(seg);
      continue;
    }
    const nameMatches = findExactNameMatches(seg.value, nameToId);
    if (nameMatches.length === 0) {
      expandedSegments.push(seg);
      continue;
    }
    let lastIdx = 0;
    for (const m of nameMatches) {
      if (m.index > lastIdx) {
        expandedSegments.push({
          type: "text",
          value: seg.value.slice(lastIdx, m.index),
        });
      }
      expandedSegments.push({
        type: "mental_model",
        id: m.id,
        name: m.name,
      });
      lastIdx = m.index + m.length;
    }
    if (lastIdx < seg.value.length) {
      expandedSegments.push({
        type: "text",
        value: seg.value.slice(lastIdx),
      });
    }
  }
  return expandedSegments;
}

function renderInlineMarkdownText(value: string, keyPrefix: string) {
  const parts = value.split(INLINE_MARKDOWN_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    }

    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

export function UserMessageContent({
  content,
  idToName,
  ltmIdToTitle,
  ccIdToTitle = new Map(),
  cgIdToTitle = new Map(),
  figureIdToName = new Map(),
  figureIdToDescription = new Map(),
  onMentalModelClick,
  onLtmClick,
  onCustomConceptClick,
  onConceptGroupClick,
  previewMap,
  chipStyle = "user",
}: {
  content: string;
  idToName: Map<string, string>;
  ltmIdToTitle: Map<string, string>;
  ccIdToTitle?: Map<string, string>;
  cgIdToTitle?: Map<string, string>;
  figureIdToName?: Map<string, string>;
  figureIdToDescription?: Map<string, string>;
  onMentalModelClick: (id: string) => void;
  onLtmClick: (id: string) => void;
  onCustomConceptClick?: (id: string) => void;
  onConceptGroupClick?: (id: string) => void;
  previewMap?: Map<string, { oneLiner?: string; quickIntro?: string }>;
  chipStyle?: "user" | "assistant";
}) {
  const segments = parseUserMessageContent(content, idToName, ltmIdToTitle, ccIdToTitle, cgIdToTitle, figureIdToName);

  if (segments.length === 0) {
    return <span className="whitespace-pre-wrap">{renderInlineMarkdownText(content, "plain")}</span>;
  }

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{renderInlineMarkdownText(seg.value, `text-${i}`)}</span>;
        }
        if (seg.type === "mental_model") {
          return (
            <MentionChip
              key={i}
              label={seg.name}
              tooltip={previewMap?.get(seg.id)?.oneLiner ?? previewMap?.get(seg.id)?.quickIntro ?? null}
              onClick={() => onMentalModelClick(seg.id)}
              chipStyle={chipStyle}
            />
          );
        }
        if (seg.type === "figure") {
          return (
            <MentionChip
              key={i}
              label={seg.name}
              tooltip={figureIdToDescription?.get(seg.id) ?? null}
              onClick={() => {}}
              toggleTooltipOnClick
              chipStyle={chipStyle}
            />
          );
        }
        if (seg.type === "long_term_memory") {
          return (
            <MentionChip
              key={i}
              label={seg.title}
              tooltip={null}
              onClick={() => onLtmClick(seg.id)}
              chipStyle={chipStyle}
            />
          );
        }
        if (seg.type === "concept_group") {
          return (
            <MentionChip
              key={i}
              label={seg.title}
              tooltip={null}
              onClick={() => onConceptGroupClick?.(seg.id)}
              chipStyle={chipStyle}
            />
          );
        }
        return (
          <MentionChip
            key={i}
            label={seg.title}
            tooltip={null}
            onClick={() => onCustomConceptClick?.(seg.id)}
            chipStyle={chipStyle}
          />
        );
      })}
    </span>
  );
}

function MentionChip({
  label,
  tooltip,
  onClick,
  toggleTooltipOnClick = false,
  chipStyle = "user",
}: {
  label: string;
  tooltip: string | null;
  onClick: () => void;
  toggleTooltipOnClick?: boolean;
  chipStyle?: "user" | "assistant";
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (toggleTooltipOnClick && tooltip) {
          setShowTooltip((v) => !v);
        } else {
          onClick();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      className={`relative ${chipStyle === "assistant" ? ASSISTANT_MENTION_CHIP_CLASS : MENTION_CHIP_CLASS}`}
    >
      {label}
      {tooltip && showTooltip && (
        <span
          className="absolute left-0 bottom-full mb-1 px-2 py-1.5 text-xs bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 rounded-lg shadow-lg max-w-[240px] z-50 pointer-events-none animate-fade-in-up"
          role="tooltip"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
