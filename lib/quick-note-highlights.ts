/**
 * Rule-based highlight segments for Quick Note (WhatsApp-style entity underlines).
 * Merges regex matches + optional nutrition item names; overlaps resolved by length then start.
 */

export type QuickNoteHighlightKind =
  | "temporal"
  | "duration"
  | "distance"
  | "nutrition"
  | "weight"
  | "sleep"
  | "spend";

export interface QuickNoteHighlightSegment {
  start: number;
  end: number;
  kind: QuickNoteHighlightKind;
}

export interface QuickNoteHighlightHints {
  /** Nutrition / exercise item names from Gemini estimate (longest-first matching). */
  nutritionItemNames?: string[];
}

const REGEX_RULES: Array<{ kind: QuickNoteHighlightKind; re: RegExp }> = [
  // Money (before generic numbers)
  {
    kind: "spend",
    re: /\$[\d,]+(?:\.\d{1,2})?|\€[\d,]+(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP)\b/gi,
  },
  // Time ranges like5-7pm, 5 – 7 PM
  {
    kind: "temporal",
    re: /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi,
  },
  // Clock times 7:51 AM, 17:30
  {
    kind: "temporal",
    re: /\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?\b|\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi,
  },
  // Calories / energy
  {
    kind: "nutrition",
    re: /\b\d+(?:\.\d+)?\s*(?:kcal|kilocalories)\b|\b\d+\s*calories?\b|\b\d+\s*cal\b/gi,
  },
  // Distance
  {
    kind: "distance",
    re: /\b\d+(?:\.\d+)?\s*(?:mi|mile|miles|km|kms|kilometers?|kilometres?|5k|10k)\b/gi,
  },
  // Weight
  {
    kind: "weight",
    re: /\b\d+(?:\.\d+)?\s*(?:kg|kgs|lb|lbs|pounds?)\b/gi,
  },
  // Sleep-flavored duration
  {
    kind: "sleep",
    re: /\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?)\s*(?:of\s+)?sleep\b|\bslept\s+(?:for\s+)?\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?)?\b/gi,
  },
  // Durations (hours, minutes) — after sleep-specific to avoid double match where possible
  {
    kind: "duration",
    re: /\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours)\b|\b\d+(?:\.\d+)?\s*(?:m|min|mins|minute|minutes)\b|\b\d+\s*(?:sec|secs|second|seconds)\b/gi,
  },
  // Relative / vague time words
  {
    kind: "temporal",
    re: /\b(?:later|tonight|tomorrow|yesterday|today|noon|midnight|morning|afternoon|evening|weekday|weekdays|weekend|weekends)\b/gi,
  },
];

function collectRegexSegments(text: string): QuickNoteHighlightSegment[] {
  const out: QuickNoteHighlightSegment[] = [];
  for (const { kind, re } of REGEX_RULES) {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const slice = m[0];
      if (!slice.length) {
        if (r.lastIndex === m.index) r.lastIndex++;
        continue;
      }
      out.push({ start: m.index, end: m.index + slice.length, kind });
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectNutritionNameSegments(
  text: string,
  names: string[] | undefined
): QuickNoteHighlightSegment[] {
  if (!names?.length) return [];
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  const out: QuickNoteHighlightSegment[] = [];
  const lower = text.toLowerCase();
  for (const name of uniq) {
    const n = name.trim();
    if (n.length < 2) continue;
    const nl = n.toLowerCase();
    let pos = 0;
    while (pos < lower.length) {
      const idx = lower.indexOf(nl, pos);
      if (idx === -1) break;
      // Word-ish boundary: avoid matching inside larger tokens
      const before = idx > 0 ? text[idx - 1] : " ";
      const after = idx + n.length < text.length ? text[idx + n.length] : " ";
      const boundaryOk = !/\w/.test(before) && !/\w/.test(after);
      if (boundaryOk) {
        out.push({ start: idx, end: idx + n.length, kind: "nutrition" });
      }
      pos = idx + 1;
    }
  }
  return out;
}

/** Prefer longer spans, then earlier start; drop any that overlap a kept span. */
export function mergeNonOverlappingHighlightSegments(
  segments: QuickNoteHighlightSegment[]
): QuickNoteHighlightSegment[] {
  const sorted = [...segments].sort((a, b) => {
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (lb !== la) return lb - la;
    return a.start - b.start;
  });
  const out: QuickNoteHighlightSegment[] = [];
  for (const s of sorted) {
    if (out.some((o) => !(s.end <= o.start || s.start >= o.end))) continue;
    out.push(s);
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * Regex spans take precedence over API/Gemini spans where they overlap (Phase C merge).
 */
export function mergeRegexPreferredOverApi(
  regexSegments: QuickNoteHighlightSegment[],
  apiSegments: QuickNoteHighlightSegment[]
): QuickNoteHighlightSegment[] {
  const reg = mergeNonOverlappingHighlightSegments(regexSegments);
  const apiFiltered = apiSegments.filter(
    (a) => !reg.some((r) => !(a.end <= r.start || a.start >= r.end))
  );
  return mergeNonOverlappingHighlightSegments([...reg, ...apiFiltered]);
}

export const QUICK_NOTE_HIGHLIGHT_KINDS = new Set<string>([
  "temporal",
  "duration",
  "distance",
  "nutrition",
  "weight",
  "sleep",
  "spend",
]);

export function normalizeApiHighlightSpans(
  text: string,
  raw: unknown
): QuickNoteHighlightSegment[] {
  if (!Array.isArray(raw)) return [];
  const n = text.length;
  const out: QuickNoteHighlightSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const start = typeof o.start === "number" && Number.isFinite(o.start) ? Math.floor(o.start) : -1;
    const end = typeof o.end === "number" && Number.isFinite(o.end) ? Math.floor(o.end) : -1;
    const kindRaw = typeof o.kind === "string" ? o.kind : "";
    if (start < 0 || end <= start || end > n || !QUICK_NOTE_HIGHLIGHT_KINDS.has(kindRaw)) continue;
    const slice = text.slice(start, end);
    if (!slice.trim()) continue;
    out.push({ start, end, kind: kindRaw as QuickNoteHighlightKind });
  }
  return mergeNonOverlappingHighlightSegments(out);
}

export function buildQuickNoteHighlightSegments(
  text: string,
  hints?: QuickNoteHighlightHints
): QuickNoteHighlightSegment[] {
  const t = text ?? "";
  if (!t) return [];
  const fromRegex = collectRegexSegments(t);
  const fromNames = collectNutritionNameSegments(t, hints?.nutritionItemNames);
  return mergeNonOverlappingHighlightSegments([...fromRegex, ...fromNames]);
}

/** Gemini/API spans merged with regex + item names; regex wins on overlaps. */
export function combineQuickNoteHighlights(
  text: string,
  hints: QuickNoteHighlightHints | undefined,
  apiRaw: unknown
): QuickNoteHighlightSegment[] {
  const base = buildQuickNoteHighlightSegments(text, hints);
  const api = normalizeApiHighlightSpans(text, apiRaw);
  return mergeRegexPreferredOverApi(base, api);
}

/** Client-side validation for merged spans returned from the API. */
export function validateHighlightSegments(
  text: string,
  segments: QuickNoteHighlightSegment[] | undefined | null
): QuickNoteHighlightSegment[] {
  if (!segments?.length) return [];
  const n = text.length;
  const filtered = segments.filter(
    (s) =>
      typeof s.start === "number" &&
      typeof s.end === "number" &&
      s.start >= 0 &&
      s.end <= n &&
      s.end > s.start &&
      QUICK_NOTE_HIGHLIGHT_KINDS.has(s.kind) &&
      text.slice(s.start, s.end).trim().length > 0
  );
  return mergeNonOverlappingHighlightSegments(filtered);
}
