"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface MentalModelOption {
  id: string;
  name: string;
}

export interface LongTermMemoryOption {
  _id: string;
  title: string;
  enrichmentPrompt?: string;
}

export interface CustomConceptOption {
  _id: string;
  title: string;
  enrichmentPrompt?: string;
}

export interface ConceptGroupOption {
  _id: string;
  title: string;
}

type MentionOption =
  | { type: "mental_model"; id: string; name: string }
  | { type: "long_term_memory"; id: string; name: string }
  | { type: "custom_concept"; id: string; name: string }
  | { type: "concept_group"; id: string; name: string };

const MAX_RESULTS_PER_SECTION = 5;
const MAX_RESULTS_SHOW_ALL = 100;

const DEFAULT_MENTION_TRANSLATIONS = {
  mentalModels: "Mental Models",
  longTermMemory: "Memory",
  customConcepts: "Custom Concepts",
  myGroups: "My Frameworks",
  hint: "@c concepts · @m models · @d/@g frameworks · @l memories",
  noResults: "No results",
  mentalModelSuffix: "Mental Model",
  memorySuffix: "Memory",
  conceptSuffix: "Concept",
  groupSuffix: "Framework",
};

const CHIP_CLASS =
  "inline-flex items-baseline py-px px-1.5 rounded-lg text-sm font-medium bg-foreground text-background border border-background mx-0.5 align-baseline cursor-pointer";

/** Token format: [[id]] for mental models, [[memory:hexid]] for LTM, [[concept:hexid]] for custom concepts */
const MM_TOKEN_REGEX = /\[\[(?!memory:|concept:)([a-z0-9_]+)\]\]/g;
const LTM_TOKEN_REGEX = /\[\[memory:([a-fA-F0-9]{24})\]\]/g;
const CC_TOKEN_REGEX = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_TOKEN_REGEX = /\[\[group:([a-fA-F0-9]{24})\]\]/g;
/** Legacy format for backward compatibility (e.g. retry with old message) */
const LEGACY_MM_RENDER_REGEX = /@mm:([a-z0-9_]+)/g;
const LEGACY_LTM_RENDER_REGEX = /@ltm:([a-fA-F0-9]{24})/g;
const LEGACY_CC_RENDER_REGEX = /@cc:([a-fA-F0-9]{24})/g;
const LEGACY_CD_RENDER_REGEX = /@cd:([a-fA-F0-9]{24})/g;
const LEGACY_CG_RENDER_REGEX = /@cg:([a-fA-F0-9]{24})/g; /* backward compat */

type MentionMode = "mm" | "ltm" | "cc" | "cd" | "both";

function getMentionState(
  value: string,
  cursorPosition: number
): { query: string; startIndex: number; mode: MentionMode; filterQuery: string } | null {
  const textBeforeCursor = value.slice(0, cursorPosition);
  const lastAt = textBeforeCursor.lastIndexOf("@");
  if (lastAt === -1) return null;
  const afterAt = textBeforeCursor.slice(lastAt + 1);
  if (/[\s@]/.test(afterAt) || afterAt.includes("@")) return null;
  const query = afterAt.toLowerCase();

  if (query.startsWith("c")) {
    return {
      query,
      startIndex: lastAt,
      mode: "cc",
      filterQuery: query.slice(1).trim(),
    };
  }
  if (query.startsWith("m")) {
    return {
      query,
      startIndex: lastAt,
      mode: "mm",
      filterQuery: query.slice(1).trim(),
    };
  }
  if (query.startsWith("d")) {
    return {
      query,
      startIndex: lastAt,
      mode: "cd",
      filterQuery: query.slice(1).trim(),
    };
  }
  if (query.startsWith("g")) {
    return {
      query,
      startIndex: lastAt,
      mode: "cd",
      filterQuery: query.slice(1).trim(),
    };
  }
  if (query.startsWith("l")) {
    return {
      query,
      startIndex: lastAt,
      mode: "ltm",
      filterQuery: query.slice(1).trim(),
    };
  }
  return {
    query,
    startIndex: lastAt,
    mode: "both",
    filterQuery: query,
  };
}

function serializeContentEditable(container: HTMLElement): string {
  let result = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const mention = el.getAttribute("data-mention");
      if (mention) {
        result += mention;
        return;
      }
      const filterPrefix = el.getAttribute("data-mention-filter");
      if (filterPrefix) {
        result += filterPrefix + (el.textContent ?? "").replace(/\u200B/g, "");
        return;
      }
      if (el.tagName === "BR") return;
    }
    node.childNodes.forEach(walk);
  };
  container.childNodes.forEach(walk);
  return result;
}

function getCaretOffset(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return 0;
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

/** Map caret position from old serialized string to new (e.g. when plain names become tokens). */
function mapCaretPosition(
  oldPos: number,
  oldStr: string,
  newStr: string
): number {
  if (oldStr === newStr) return oldPos;
  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < oldStr.length - prefixLen &&
    suffixLen < newStr.length - prefixLen &&
    oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const oldReplEnd = oldStr.length - suffixLen;
  const newReplEnd = newStr.length - suffixLen;
  if (oldPos <= prefixLen) return oldPos;
  if (oldPos >= oldReplEnd) return oldPos + (newStr.length - oldStr.length);
  return newReplEnd;
}

function findExactNameMatchesForRender(
  value: string,
  nameToId: Map<string, string>,
  excludeRanges: [number, number][]
): { index: number; length: number; id: string; name: string }[] {
  const names = Array.from(nameToId.keys()).filter((n) => n.length > 0);
  if (names.length === 0) return [];
  const sortedNames = [...names].sort((a, b) => b.length - a.length);
  const matches: { index: number; length: number; id: string; name: string }[] = [];
  const usedRanges: [number, number][] = [...excludeRanges];
  const valueLower = value.toLowerCase();

  const overlaps = (start: number, end: number) =>
    usedRanges.some(([s, e]) => end > s && start < e);

  for (const name of sortedNames) {
    const nameLower = name.toLowerCase();
    let i = 0;
    while ((i = valueLower.indexOf(nameLower, i)) !== -1) {
      const end = i + name.length;
      if (!overlaps(i, end)) {
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

function getMentionFilterPrefix(query: string): string {
  if (!query) return "@";
  return "@" + query[0];
}

function renderValueToHtml(
  value: string,
  mentalModels: MentalModelOption[],
  longTermMemories: LongTermMemoryOption[],
  customConcepts: CustomConceptOption[] = [],
  conceptGroups: ConceptGroupOption[] = [],
  mentionState?: { startIndex: number; query: string } | null
): string {
  const mmMap = new Map(mentalModels.map((m) => [m.id, m.name]));
  const ltmMap = new Map(longTermMemories.map((m) => [m._id, m.title]));
  const ccMap = new Map(customConcepts.map((m) => [m._id, m.title]));
  const cgMap = new Map(conceptGroups.map((m) => [m._id, m.title]));
  const nameToId = new Map(mentalModels.map((m) => [m.name, m.id]));

  const filterRange =
    mentionState && mentionState.query.length > 0
      ? {
          start: mentionState.startIndex,
          end: mentionState.startIndex + 1 + mentionState.query.length,
          prefix: getMentionFilterPrefix(mentionState.query),
          filterText: mentionState.query.slice(1),
        }
      : null;

  const parts: string[] = [];
  const tokenMatches: { index: number; type: "mm" | "ltm" | "cc" | "cd"; id: string; token: string; length: number }[] = [
    ...[...value.matchAll(LTM_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "ltm" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(LEGACY_LTM_RENDER_REGEX)].map((m) => ({
      index: m.index!,
      type: "ltm" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(CC_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "cc" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(LEGACY_CC_RENDER_REGEX)].map((m) => ({
      index: m.index!,
      type: "cc" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(CG_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(LEGACY_CD_RENDER_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(LEGACY_CG_RENDER_REGEX)].map((m) => ({
      index: m.index!,
      type: "cd" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(MM_TOKEN_REGEX)].map((m) => ({
      index: m.index!,
      type: "mm" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
    ...[...value.matchAll(LEGACY_MM_RENDER_REGEX)].map((m) => ({
      index: m.index!,
      type: "mm" as const,
      id: m[1],
      token: m[0],
      length: m[0].length,
    })),
  ];
  const tokenRanges = tokenMatches.map((m) => [m.index, m.index + m.length] as [number, number]);
  const nameMatches = findExactNameMatchesForRender(value, nameToId, tokenRanges);

  type Match = { index: number; length: number; type: "mm" | "ltm" | "cc" | "cd"; id: string; label: string; token: string };
  const getLabel = (m: (typeof tokenMatches)[0]) => {
    if (m.type === "mm") return mmMap.get(m.id) ?? m.id.replace(/_/g, " ");
    if (m.type === "ltm") return ltmMap.get(m.id) ?? "Memory";
    if (m.type === "cd") return cgMap.get(m.id) ?? "Group";
    return ccMap.get(m.id) ?? "Concept";
  };
  const allMatches: Match[] = [
    ...tokenMatches.map((m) => ({
      index: m.index,
      length: m.length,
      type: m.type,
      id: m.id,
      label: getLabel(m),
      token: m.token,
    })),
    ...nameMatches.map((m) => ({
      index: m.index,
      length: m.length,
      type: "mm" as const,
      id: m.id,
      label: m.name,
      token: `[[${m.id}]]`,
    })),
  ];
  if (filterRange) {
    allMatches.push({
      index: filterRange.start,
      length: filterRange.end - filterRange.start,
      type: "mm",
      id: "",
      label: filterRange.filterText,
      token: filterRange.prefix + filterRange.filterText,
    });
  }
  allMatches.sort((a, b) => a.index - b.index);

  const dedupedMatches: Match[] = [];
  for (const m of allMatches) {
    const overlaps = dedupedMatches.some(
      (d) => m.index < d.index + d.length && m.index + m.length > d.index
    );
    if (!overlaps) dedupedMatches.push(m);
  }

  let lastIndex = 0;
  for (const match of dedupedMatches) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(value.slice(lastIndex, match.index)));
    }
    if (filterRange && match.index === filterRange.start) {
      const filterContent = filterRange.filterText || "\u200B";
      parts.push(
        `<span contenteditable="true" data-mention-filter="${escapeHtml(filterRange.prefix)}" class="rounded px-0.5 bg-neutral-100 dark:bg-neutral-800 min-w-[1ch]">${escapeHtml(filterContent)}</span>`
      );
    } else {
      parts.push(
        `<span contenteditable="false" data-mention="${escapeHtml(match.token)}" data-mention-type="${match.type}" data-mention-id="${escapeHtml(match.id)}" class="${CHIP_CLASS}">${escapeHtml(match.label)}</span>`
      );
    }
    lastIndex = match.index + match.length;
  }
  if (lastIndex < value.length) {
    parts.push(escapeHtml(value.slice(lastIndex)));
  }
  return parts.join("") || "<br>";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  mentalModels,
  longTermMemories,
  customConcepts = [],
  conceptGroups = [],
  placeholder = "Type your message...",
  placeholderMobile,
  disabled = false,
  className = "",
  inputRef: externalRef,
  onMentalModelClick,
  onLtmClick,
  onCustomConceptClick,
  onConceptGroupClick,
  previewMap,
  placeholderTopAligned = false,
  mentionTranslations,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  mentalModels: MentalModelOption[];
  longTermMemories: LongTermMemoryOption[];
  customConcepts?: CustomConceptOption[];
  conceptGroups?: ConceptGroupOption[];
  placeholder?: string;
  /** Shorter placeholder for mobile to avoid wrapping */
  placeholderMobile?: string;
  disabled?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLDivElement | null>;
  onMentalModelClick?: (id: string) => void;
  onLtmClick?: (id: string) => void;
  onCustomConceptClick?: (id: string) => void;
  onConceptGroupClick?: (id: string) => void;
  /** Mental model id -> { oneLiner, quickIntro } for hover tooltips */
  previewMap?: Map<string, { oneLiner?: string; quickIntro?: string }>;
  /** Render placeholder at first text row instead of centered */
  placeholderTopAligned?: boolean;
  /** Translated labels for section headers, hint, etc. */
  mentionTranslations?: {
    mentalModels: string;
    longTermMemory: string;
    customConcepts: string;
    myGroups: string;
    hint: string;
    noResults: string;
    mentalModelSuffix: string;
    memorySuffix: string;
    conceptSuffix: string;
    groupSuffix: string;
  };
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [mentionState, setMentionState] = useState<{
    query: string;
    startIndex: number;
    mode: MentionMode;
    filterQuery: string;
  } | null>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ref = externalRef ?? internalRef;
  const t = mentionTranslations ?? DEFAULT_MENTION_TRANSLATIONS;
  const [isMobile, setIsMobile] = useState(false);
  const [chipTooltip, setChipTooltip] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const tooltipHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getChipTooltipText = useCallback(
    (type: string, id: string): string | null => {
      if (type === "mm") {
        const preview = previewMap?.get(id);
        return preview?.oneLiner ?? preview?.quickIntro ?? null;
      }
      if (type === "ltm") {
        const ltm = longTermMemories.find((l) => l._id === id);
        return (ltm?.enrichmentPrompt ?? ltm?.title) ?? null;
      }
      if (type === "cc") {
        const cc = customConcepts.find((c) => c._id === id);
        return (cc?.enrichmentPrompt ?? cc?.title) ?? null;
      }
      if (type === "cd") return null;
      return null;
    },
    [previewMap, longTermMemories, customConcepts]
  );

  const handleChipMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const chip = (e.target as HTMLElement).closest("[data-mention]") as HTMLElement | null;
      if (!chip || !ref.current?.contains(chip)) {
        if (tooltipHideRef.current) clearTimeout(tooltipHideRef.current);
        tooltipHideRef.current = setTimeout(() => setChipTooltip(null), 50);
        return;
      }
      if (tooltipHideRef.current) {
        clearTimeout(tooltipHideRef.current);
        tooltipHideRef.current = null;
      }
      const type = chip.getAttribute("data-mention-type");
      const id = chip.getAttribute("data-mention-id");
      if (!type || !id) return;
      const text = getChipTooltipText(type, id);
      if (text) setChipTooltip({ text, rect: chip.getBoundingClientRect() });
      else setChipTooltip(null);
    },
    [getChipTooltipText, ref]
  );

  const handleChipMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const chip = (e.target as HTMLElement).closest("[data-mention]");
      const related = (e.relatedTarget as HTMLElement)?.closest("[data-mention]");
      if (chip && !related) {
        tooltipHideRef.current = setTimeout(() => setChipTooltip(null), 100);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (tooltipHideRef.current) clearTimeout(tooltipHideRef.current);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const displayPlaceholder = isMobile && placeholderMobile ? placeholderMobile : placeholder;
  const isComposingRef = useRef(false);
  const lastCaretOnInputRef = useRef<{ offset: number; value: string } | null>(null);
  const prevValueRef = useRef<string>(value);
  const [isFocused, setIsFocused] = useState(false);
  const mentalModelsRef = useRef(mentalModels);
  const longTermMemoriesRef = useRef(longTermMemories);
  const customConceptsRef = useRef(customConcepts);
  const conceptGroupsRef = useRef(conceptGroups);
  mentalModelsRef.current = mentalModels;
  longTermMemoriesRef.current = longTermMemories;
  customConceptsRef.current = customConcepts;
  conceptGroupsRef.current = conceptGroups;

  const filterOptions = useCallback(() => {
    if (!mentionState) return { mentalModels: [], longTermMemories: [], customConcepts: [], conceptGroups: [] };
    const { mode, filterQuery: q } = mentionState;
    const limit =
      q === "" ? MAX_RESULTS_SHOW_ALL : MAX_RESULTS_PER_SECTION;

    const filteredMM =
      mode === "ltm" || mode === "cc" || mode === "cd"
        ? []
        : mentalModels.filter(
            (m) =>
              q === "" ||
              m.name.toLowerCase().includes(q) ||
              m.id.toLowerCase().includes(q.replace(/\s/g, "_"))
          );
    const filteredLTM =
      mode === "mm" || mode === "cc" || mode === "cd"
        ? []
        : longTermMemories.filter(
            (m) => q === "" || m.title.toLowerCase().includes(q)
          );
    const filteredCC =
      mode === "mm" || mode === "ltm" || mode === "cd"
        ? []
        : customConcepts.filter(
            (m) => q === "" || m.title.toLowerCase().includes(q)
          );
    const filteredCG =
      mode === "mm" || mode === "ltm" || mode === "cc"
        ? []
        : conceptGroups.filter(
            (m) => q === "" || m.title.toLowerCase().includes(q)
          );

    return {
      mentalModels: filteredMM.slice(0, limit),
      longTermMemories: filteredLTM.slice(0, limit),
      customConcepts: filteredCC.slice(0, limit),
      conceptGroups: filteredCG.slice(0, limit),
    };
  }, [mentionState, mentalModels, longTermMemories, customConcepts, conceptGroups]);

  const { mentalModels: filteredMM, longTermMemories: filteredLTM, customConcepts: filteredCC, conceptGroups: filteredCG } = filterOptions();
  const allOptions: MentionOption[] = [
    ...filteredMM.map((m) => ({
      type: "mental_model" as const,
      id: m.id,
      name: m.name,
    })),
    ...filteredLTM.map((m) => ({
      type: "long_term_memory" as const,
      id: m._id,
      name: m.title,
    })),
    ...filteredCC.map((m) => ({
      type: "custom_concept" as const,
      id: m._id,
      name: m.title,
    })),
    ...filteredCG.map((m) => ({
      type: "concept_group" as const,
      id: m._id,
      name: m.title,
    })),
  ];
  const hasResults = allOptions.length > 0;

  const insertMention = useCallback(
    (option: MentionOption) => {
      if (!mentionState || !ref.current) return;
      const token =
        option.type === "mental_model"
          ? `[[${option.id}]]`
          : option.type === "long_term_memory"
            ? `[[memory:${option.id}]]`
            : option.type === "concept_group"
              ? `[[group:${option.id}]]`
              : `[[concept:${option.id}]]`;
      const before = value.slice(0, mentionState.startIndex);
      const replaceEnd = mentionState.startIndex + 1 + mentionState.query.length;
      const after = value.slice(replaceEnd);
      const newValue = before + token + " " + after;
      onChange(newValue);
      setShowDropdown(false);
      setMentionState(null);
      setHighlightIndex(0);
      ref.current.focus();
      setTimeout(() => {
        if (!ref.current) return;
        const html = renderValueToHtml(
          newValue,
          mentalModels,
          longTermMemories,
          customConcepts,
          conceptGroups
        );
        ref.current.innerHTML = html || "";
        ref.current.setAttribute("data-value", newValue);
        const len = before.length + token.length + 1;
        setCaretToPosition(ref.current, len);
      }, 0);
    },
    [mentionState, value, onChange, ref, mentalModels, longTermMemories, customConcepts, conceptGroups]
  );

  function setCaretToPosition(container: HTMLElement, position: number) {
    const sel = window.getSelection();
    if (!sel) return;
    let offset = 0;
    const walk = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = (node.textContent ?? "").length;
        if (offset + len >= position) {
          const range = document.createRange();
          range.setStart(node, Math.min(position - offset, len));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return true;
        }
        offset += len;
        return false;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const mention = el.getAttribute("data-mention");
        if (mention) {
          const len = mention.length;
          if (offset >= position) {
            const range = document.createRange();
            range.setStartBefore(el);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
          }
          if (offset + len >= position) {
            const range = document.createRange();
            range.setStartAfter(el);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
          }
          offset += len;
          return false;
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
      return false;
    };
    walk(container);
  }

  const handleInput = useCallback(() => {
    if (!ref.current || isComposingRef.current) return;
    const newValue = serializeContentEditable(ref.current);
    if (newValue !== value) {
      lastCaretOnInputRef.current = {
        offset: getCaretOffset(ref.current),
        value: newValue,
      };
      onChange(newValue);
    }
    const pos = getCaretOffset(ref.current);
    const state = getMentionState(newValue, pos);
    if (state) {
      setMentionState(state);
      setShowDropdown(true);
      setHighlightIndex(0);
    } else {
      setShowDropdown(false);
      setMentionState(null);
    }
  }, [value, onChange, ref]);

  const syncFromValue = useCallback(() => {
    if (!ref.current) return;
    const hadFocus = document.activeElement === ref.current;
    const html = renderValueToHtml(
      value,
      mentalModelsRef.current,
      longTermMemoriesRef.current,
      customConceptsRef.current,
      conceptGroupsRef.current,
      mentionState
    );
    const tempDiv = Object.assign(document.createElement("div"), {
      innerHTML: html || "<br>",
    });
    const expectedSerialized = serializeContentEditable(tempDiv);
    const currentSerialized = serializeContentEditable(ref.current);
    if (currentSerialized !== expectedSerialized) {
      const prevValue = prevValueRef.current;
      prevValueRef.current = value;
      const stored = lastCaretOnInputRef.current?.value === value
        ? lastCaretOnInputRef.current.offset
        : null;
      const isAppend = prevValue !== undefined && value.length > prevValue.length && value.startsWith(prevValue);
      const caretOffset = stored ?? (isAppend ? expectedSerialized.length : getCaretOffset(ref.current));
      const shouldRestoreSelection = hadFocus || stored !== null;
      lastCaretOnInputRef.current = null;
      ref.current.innerHTML = html || "";
      ref.current.setAttribute("data-value", value);
      const newPosition = isAppend
        ? expectedSerialized.length
        : Math.min(
            mapCaretPosition(caretOffset, currentSerialized, expectedSerialized),
            expectedSerialized.length
          );
      if (shouldRestoreSelection) {
        requestAnimationFrame(() => {
          if (!ref.current) return;
          ref.current.focus();
          setCaretToPosition(ref.current, newPosition);
        });
      }
    }
  }, [value, ref, mentionState]);

  useEffect(() => {
    syncFromValue();
  }, [value, syncFromValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (showDropdown && mentionState) {
        if (e.key === "Backspace" && mentionState.query.length <= 1) {
          e.preventDefault();
          const before = value.slice(0, mentionState.startIndex);
          const after = value.slice(mentionState.startIndex + 1 + mentionState.query.length);
          onChange(before + after);
          setShowDropdown(false);
          setMentionState(null);
          setHighlightIndex(0);
          requestAnimationFrame(() => {
            ref.current?.focus();
            if (ref.current) setCaretToPosition(ref.current, before.length);
          });
          return;
        }
      }
      if (showDropdown && hasResults) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightIndex((i) => (i + 1) % allOptions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightIndex((i) =>
            i === 0 ? allOptions.length - 1 : i - 1
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(allOptions[highlightIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowDropdown(false);
          setMentionState(null);
          return;
        }
      }
      onKeyDown?.(e);
    },
    [
      showDropdown,
      hasResults,
      allOptions,
      highlightIndex,
      insertMention,
      onKeyDown,
      mentionState,
      value,
      onChange,
      ref,
    ]
  );

  useEffect(() => {
    if (!showDropdown) return;
    const el = dropdownRef.current;
    if (!el) return;
    const highlighted = el.querySelector(`[data-index="${highlightIndex}"]`);
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, showDropdown]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setShowDropdown(false);
        setMentionState(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isEmpty = !value || value.trim() === "";

  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const updateDropdownRect = useCallback(() => {
    if (!containerRef.current) return;
    setDropdownRect(containerRef.current.getBoundingClientRect());
  }, []);
  useLayoutEffect(() => {
    if (!showDropdown || !containerRef.current) {
      setDropdownRect(null);
      return;
    }
    updateDropdownRect();
    window.addEventListener("scroll", updateDropdownRect, true);
    window.addEventListener("resize", updateDropdownRect);
    return () => {
      window.removeEventListener("scroll", updateDropdownRect, true);
      window.removeEventListener("resize", updateDropdownRect);
    };
  }, [showDropdown, updateDropdownRect]);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const chip = target.closest("[data-mention]") as HTMLElement | null;
      if (!chip || !ref.current?.contains(chip)) return;
      const type = chip.getAttribute("data-mention-type");
      const id = chip.getAttribute("data-mention-id");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (type === "mm" && onMentalModelClick) onMentalModelClick(id);
      else if (type === "ltm" && onLtmClick) onLtmClick(id);
      else if (type === "cc" && onCustomConceptClick) onCustomConceptClick(id);
      else if (type === "cd" && onConceptGroupClick) onConceptGroupClick(id);
    },
    [onMentalModelClick, onLtmClick, onCustomConceptClick, onConceptGroupClick, ref]
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 flex min-h-0">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        contentEditable={!disabled}
        suppressContentEditableWarning
        dir="ltr"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={handleContainerClick}
        onMouseOver={handleChipMouseOver}
        onMouseOut={handleChipMouseOut}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          handleInput();
        }}
        data-placeholder={displayPlaceholder}
        className={`flex-1 min-h-0 overflow-y-auto outline-none focus:outline-none ${className} ${
          isEmpty ? "empty" : ""
        } text-left`}
        style={{
          ...(isEmpty && {
            // Placeholder styling - use ::before in CSS or data attr
          }),
        }}
      />
      {isEmpty && (
        <span
          dir="ltr"
          className={`pointer-events-none absolute left-0 right-4 text-neutral-500 dark:text-neutral-400 select-none whitespace-nowrap overflow-hidden text-ellipsis text-left ${
            placeholderTopAligned ? "top-4" : "top-0"
          }`}
          aria-hidden
        >
          {displayPlaceholder}
        </span>
      )}
      {chipTooltip && (
        <div
          className="fixed z-[100] px-2 py-1.5 text-xs bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 rounded-lg shadow-lg max-w-[240px] pointer-events-none animate-fade-in-up"
          role="tooltip"
          style={{
            left: chipTooltip.rect.left + chipTooltip.rect.width / 2,
            bottom: window.innerHeight - chipTooltip.rect.top + 4,
            transform: "translateX(-50%)",
          }}
        >
          {chipTooltip.text}
        </div>
      )}
      {showDropdown && dropdownRect && typeof document !== "undefined"
        ? createPortal(
            <div
            ref={dropdownRef}
            className="fixed z-[100] py-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg max-h-64 overflow-y-auto animate-fade-in-up"
            style={{
              left: dropdownRect.left,
              width: dropdownRect.width,
              bottom: window.innerHeight - dropdownRect.top + 4,
            }}
          >
          {mentionState?.mode === "both" && mentionState?.filterQuery === "" && (
            <p className="px-4 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 mb-1">
              {t.hint}
            </p>
          )}
          {hasResults ? (
            <>
              {filteredMM.length > 0 && (
                <div className="px-3 pb-1">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-medium px-2 py-1">
                    {t.mentalModels}
                  </p>
                  {filteredMM.map((m, i) => {
                    const opt: MentionOption = {
                      type: "mental_model",
                      id: m.id,
                      name: m.name,
                    };
                    const actualIdx = i;
                    const nameMatchesLtm = longTermMemories.some(
                      (ltm) => ltm.title.toLowerCase() === m.name.toLowerCase()
                    );
                    const nameMatchesCc = customConcepts.some(
                      (cc) => cc.title.toLowerCase() === m.name.toLowerCase()
                    );
                    const displayLabel = nameMatchesLtm || nameMatchesCc
                      ? `${m.name} (${t.mentalModelSuffix})`
                      : m.name;
                    return (
                      <button
                        key={`mm-${m.id}`}
                        type="button"
                        data-index={actualIdx}
                        onClick={() => insertMention(opt)}
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${
                          highlightIndex === actualIdx
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredLTM.length > 0 && (
                <div className="px-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-medium px-2 py-1">
                    {t.longTermMemory}
                  </p>
                  {filteredLTM.map((m, i) => {
                    const opt: MentionOption = {
                      type: "long_term_memory",
                      id: m._id,
                      name: m.title,
                    };
                    const actualIdx = filteredMM.length + i;
                    const nameMatchesMentalModel = mentalModels.some(
                      (mm) => mm.name.toLowerCase() === m.title.toLowerCase()
                    );
                    const nameMatchesCc = customConcepts.some(
                      (cc) => cc.title.toLowerCase() === m.title.toLowerCase()
                    );
                    const displayLabel = nameMatchesMentalModel || nameMatchesCc
                      ? `${m.title} (${t.memorySuffix})`
                      : m.title;
                    return (
                      <button
                        key={`ltm-${m._id}`}
                        type="button"
                        data-index={actualIdx}
                        onClick={() => insertMention(opt)}
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${
                          highlightIndex === actualIdx
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredCC.length > 0 && (
                <div className="px-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-medium px-2 py-1">
                    {t.customConcepts}
                  </p>
                  {filteredCC.map((m, i) => {
                    const opt: MentionOption = {
                      type: "custom_concept",
                      id: m._id,
                      name: m.title,
                    };
                    const actualIdx = filteredMM.length + filteredLTM.length + i;
                    const nameMatchesMentalModel = mentalModels.some(
                      (mm) => mm.name.toLowerCase() === m.title.toLowerCase()
                    );
                    const nameMatchesLtm = longTermMemories.some(
                      (ltm) => ltm.title.toLowerCase() === m.title.toLowerCase()
                    );
                    const displayLabel = nameMatchesMentalModel || nameMatchesLtm
                      ? `${m.title} (Concept)`
                      : m.title;
                    return (
                      <button
                        key={`cc-${m._id}`}
                        type="button"
                        data-index={actualIdx}
                        onClick={() => insertMention(opt)}
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${
                          highlightIndex === actualIdx
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredCG.length > 0 && (
                <div className="px-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-medium px-2 py-1">
                    {t.myGroups}
                  </p>
                  {filteredCG.map((m, i) => {
                    const opt: MentionOption = {
                      type: "concept_group",
                      id: m._id,
                      name: m.title,
                    };
                    const actualIdx = filteredMM.length + filteredLTM.length + filteredCC.length + i;
                    const nameMatchesMentalModel = mentalModels.some(
                      (mm) => mm.name.toLowerCase() === m.title.toLowerCase()
                    );
                    const nameMatchesLtm = longTermMemories.some(
                      (ltm) => ltm.title.toLowerCase() === m.title.toLowerCase()
                    );
                    const nameMatchesCc = customConcepts.some(
                      (cc) => cc.title.toLowerCase() === m.title.toLowerCase()
                    );
                    const displayLabel = nameMatchesMentalModel || nameMatchesLtm || nameMatchesCc
                      ? `${m.title} (Domain)`
                      : m.title;
                    return (
                      <button
                        key={`cg-${m._id}`}
                        type="button"
                        data-index={actualIdx}
                        onClick={() => insertMention(opt)}
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${
                          highlightIndex === actualIdx
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t.noResults}
            </p>
          )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Legacy format for backward compatibility with stored messages */
const LEGACY_MM_REGEX = /@mm:([a-z0-9_]+)/g;
const LEGACY_LTM_REGEX = /@ltm:([a-f0-9]{24})/g;
const LEGACY_CC_REGEX = /@cc:([a-f0-9]{24})/g;

function findMentalModelIdsFromExactNames(
  message: string,
  nameToId: Map<string, string>
): string[] {
  const names = Array.from(nameToId.keys()).filter((n) => n.length > 0);
  if (names.length === 0) return [];
  const sortedNames = [...names].sort((a, b) => b.length - a.length);
  const ids: string[] = [];
  const usedRanges: [number, number][] = [];
  const msgLower = message.toLowerCase();

  for (const name of sortedNames) {
    const nameLower = name.toLowerCase();
    let i = 0;
    while ((i = msgLower.indexOf(nameLower, i)) !== -1) {
      const end = i + name.length;
      const overlaps = usedRanges.some(([s, e]) => end > s && i < e);
      if (!overlaps) {
        const id = nameToId.get(name)!;
        ids.push(id);
        usedRanges.push([i, end]);
      }
      i += 1;
    }
  }
  return ids;
}

const CC_TOKEN_REGEX_PARSE = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_TOKEN_REGEX_PARSE = /\[\[group:([a-fA-F0-9]{24})\]\]/g;
const LEGACY_CD_REGEX_PARSE = /@cd:([a-fA-F0-9]{24})/g;
const LEGACY_CG_REGEX_PARSE = /@cg:([a-fA-F0-9]{24})/g; /* backward compat */

export function parseMentionsFromMessage(
  message: string,
  options?: {
    idToName?: Map<string, string>;
    ltmIdToTitle?: Map<string, string>;
    ccIdToTitle?: Map<string, string>;
    cgIdToTitle?: Map<string, string>;
  }
): {
  cleanedMessage: string;
  mentionedMentalModelIds: string[];
  mentionedLongTermMemoryIds: string[];
  mentionedCustomConceptIds: string[];
  mentionedConceptGroupIds: string[];
} {
  const tokenIds = [
    ...[...message.matchAll(MM_TOKEN_REGEX)].map((m) => m[1]),
    ...[...message.matchAll(LEGACY_MM_REGEX)].map((m) => m[1]),
  ];
  const nameMatchIds =
    options?.idToName && options.idToName.size > 0
      ? findMentalModelIdsFromExactNames(
          message,
          new Map([...options.idToName.entries()].map(([id, name]) => [name, id]))
        )
      : [];
  const mentionedMentalModelIds = [...new Set([...tokenIds, ...nameMatchIds])];
  const mentionedLongTermMemoryIds = [
    ...new Set([
      ...[...message.matchAll(LTM_TOKEN_REGEX)].map((m) => m[1]),
      ...[...message.matchAll(LEGACY_LTM_REGEX)].map((m) => m[1]),
    ]),
  ];
  const mentionedCustomConceptIds = [
    ...new Set([
      ...[...message.matchAll(CC_TOKEN_REGEX_PARSE)].map((m) => m[1]),
      ...[...message.matchAll(LEGACY_CC_REGEX)].map((m) => m[1]),
    ]),
  ];
  const mentionedConceptGroupIds = [
    ...new Set([
      ...[...message.matchAll(CG_TOKEN_REGEX_PARSE)].map((m) => m[1]),
      ...[...message.matchAll(LEGACY_CD_REGEX_PARSE)].map((m) => m[1]),
      ...[...message.matchAll(LEGACY_CG_REGEX_PARSE)].map((m) => m[1]),
    ]),
  ];

  const replaceMm = (id: string) =>
    options?.idToName?.get(id) ?? id.replace(/_/g, " ");
  const replaceLtm = (id: string) =>
    options?.ltmIdToTitle?.get(id) ?? "Memory";
  const ccMap = options?.ccIdToTitle ?? new Map<string, string>();
  const replaceCc = (id: string) => ccMap.get(id) ?? "Concept";
  const cgMap = options?.cgIdToTitle ?? new Map<string, string>();
  const replaceCg = (id: string) => cgMap.get(id) ?? "Group";

  let cleanedMessage: string;
  if (options?.idToName && options?.ltmIdToTitle) {
    cleanedMessage = message
      .replace(MM_TOKEN_REGEX, (_, id) => replaceMm(id))
      .replace(LEGACY_MM_REGEX, (_, id) => replaceMm(id))
      .replace(LTM_TOKEN_REGEX, (_, id) => replaceLtm(id))
      .replace(LEGACY_LTM_REGEX, (_, id) => replaceLtm(id))
      .replace(CC_TOKEN_REGEX_PARSE, (_, id) => replaceCc(id))
      .replace(LEGACY_CC_REGEX, (_, id) => replaceCc(id))
      .replace(CG_TOKEN_REGEX_PARSE, (_, id) => replaceCg(id))
      .replace(LEGACY_CD_REGEX_PARSE, (_, id) => replaceCg(id))
      .replace(LEGACY_CG_REGEX_PARSE, (_, id) => replaceCg(id))
      .replace(/\s+/g, " ")
      .trim();
  } else {
    cleanedMessage = message
      .replace(MM_TOKEN_REGEX, (_, id) => id.replace(/_/g, " "))
      .replace(LEGACY_MM_REGEX, (_, id) => id.replace(/_/g, " "))
      .replace(LTM_TOKEN_REGEX, "")
      .replace(LEGACY_LTM_REGEX, "")
      .replace(CC_TOKEN_REGEX_PARSE, "")
      .replace(LEGACY_CC_REGEX, "")
      .replace(CG_TOKEN_REGEX_PARSE, "")
      .replace(LEGACY_CD_REGEX_PARSE, "")
      .replace(LEGACY_CG_REGEX_PARSE, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    cleanedMessage,
    mentionedMentalModelIds: [...new Set(mentionedMentalModelIds)],
    mentionedLongTermMemoryIds: [...new Set(mentionedLongTermMemoryIds)],
    mentionedCustomConceptIds: [...new Set(mentionedCustomConceptIds)],
    mentionedConceptGroupIds: [...new Set(mentionedConceptGroupIds)],
  };
}
