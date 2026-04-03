const RELEVANT_CONTEXT_MARKER = "---RELEVANT-CONTEXT---";
const RELEVANT_CONTEXT_END_MARKER = "---END-CONTEXT---";

/** Used by API to delimit the context block when sent at start of stream */
export function getRelevantContextBlockDelimiters() {
  return { start: RELEVANT_CONTEXT_MARKER, end: RELEVANT_CONTEXT_END_MARKER };
}

export interface RelevantContextItem {
  id: string;
  reason: string;
  title?: string;
  prompt?: string;
}

export interface RelevantContext {
  mentalModels: RelevantContextItem[];
  longTermMemories: RelevantContextItem[];
  customConcepts: RelevantContextItem[];
  conceptGroups: RelevantContextItem[];
  perspectiveCards?: RelevantContextItem[];
}

export interface RelevantContextEnvelope {
  predictedContext?: RelevantContext;
  citedContext?: RelevantContext;
  relevantContext?: RelevantContext;
}

function normalizeContextItems(raw: unknown): RelevantContextItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): RelevantContextItem[] => {
    if (typeof item === "string") return [{ id: item, reason: "" }];
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string") {
      const obj = item as Record<string, unknown>;
      return [{
        id: obj.id as string,
        reason: typeof obj.reason === "string" ? obj.reason : "",
        title: typeof obj.title === "string" ? obj.title : undefined,
        prompt: typeof obj.prompt === "string" ? obj.prompt : undefined,
      }];
    }
    return [];
  });
}

function tryParseRelevantContextJson(jsonStr: string): RelevantContext | null {
  const cleaned = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      mentalModels?: unknown;
      longTermMemories?: unknown;
      customConcepts?: unknown;
      conceptGroups?: unknown;
      perspectiveCards?: unknown;
    };
    return {
      mentalModels: normalizeContextItems(parsed.mentalModels),
      longTermMemories: normalizeContextItems(parsed.longTermMemories),
      customConcepts: normalizeContextItems(parsed.customConcepts ?? []),
      conceptGroups: normalizeContextItems(parsed.conceptGroups ?? []),
      perspectiveCards: normalizeContextItems(parsed.perspectiveCards ?? []),
    };
  } catch {
    return null;
  }
}

function normalizeRelevantContext(raw: unknown): RelevantContext {
  const obj =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  return {
    mentalModels: normalizeContextItems(obj.mentalModels),
    longTermMemories: normalizeContextItems(obj.longTermMemories),
    customConcepts: normalizeContextItems(obj.customConcepts ?? []),
    conceptGroups: normalizeContextItems(obj.conceptGroups ?? []),
    perspectiveCards: normalizeContextItems(obj.perspectiveCards ?? []),
  };
}

function isContextEnvelope(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return (
    "predictedContext" in obj ||
    "citedContext" in obj ||
    "relevantContext" in obj
  );
}

function isContextPresent(ctx: RelevantContext): boolean {
  return (
    ctx.mentalModels.length > 0 ||
    ctx.longTermMemories.length > 0 ||
    ctx.customConcepts.length > 0 ||
    ctx.conceptGroups.length > 0 ||
    (ctx.perspectiveCards?.length ?? 0) > 0
  );
}

function tryParseRelevantContextPayload(jsonStr: string): {
  relevantContext: RelevantContext | null;
  contextEnvelope: RelevantContextEnvelope | null;
} | null {
  const cleaned = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (isContextEnvelope(parsed)) {
      const envelopeObj = parsed as Record<string, unknown>;
      const predictedContext = "predictedContext" in envelopeObj
        ? normalizeRelevantContext(envelopeObj.predictedContext)
        : undefined;
      const citedContext = "citedContext" in envelopeObj
        ? normalizeRelevantContext(envelopeObj.citedContext)
        : undefined;
      const legacyRelevantContext = "relevantContext" in envelopeObj
        ? normalizeRelevantContext(envelopeObj.relevantContext)
        : undefined;
      const resolved =
        citedContext ??
        predictedContext ??
        legacyRelevantContext ??
        null;
      return {
        relevantContext: resolved,
        contextEnvelope: {
          predictedContext,
          citedContext,
          relevantContext: legacyRelevantContext,
        },
      };
    }
    const legacy = tryParseRelevantContextJson(cleaned);
    if (!legacy) return null;
    return { relevantContext: legacy, contextEnvelope: { relevantContext: legacy } };
  } catch {
    return null;
  }
}

/**
 * Parses and strips the RELEVANT-CONTEXT block from assistant content.
 * Returns content without the block and the parsed relevant context, or null if not found/invalid.
 * Handles JSON on same line, next line, or inside markdown code fences.
 */
export function parseRelevantContextBlock(content: string): {
  contentWithoutBlock: string;
  relevantContext: RelevantContext | null;
  contextEnvelope?: RelevantContextEnvelope | null;
} {
  const idx = content.indexOf(RELEVANT_CONTEXT_MARKER);
  if (idx === -1) {
    return { contentWithoutBlock: content, relevantContext: null };
  }
  const afterMarker = content.slice(idx + RELEVANT_CONTEXT_MARKER.length).trim();
  const contentWithoutBlock = content.slice(0, idx).trimEnd();

  const candidates = [
    afterMarker,
    afterMarker.split("\n")[0]?.trim() ?? "",
    afterMarker.replace(/^```(?:json)?\s*/i, "").split("```")[0]?.trim() ?? "",
  ].filter((s) => s.length > 0);

  for (const candidate of candidates) {
    const result = tryParseRelevantContextPayload(candidate);
    if (result) {
      return {
        contentWithoutBlock,
        relevantContext: result.relevantContext,
        contextEnvelope: result.contextEnvelope,
      };
    }
  }
  return { contentWithoutBlock, relevantContext: null };
}

/**
 * When the stream sends RELEVANT-CONTEXT first (before LLM response), extract it.
 * Returns { contentWithoutBlock, relevantContext } - contentWithoutBlock is the rest (LLM response).
 */
export function parseRelevantContextFromStreamStart(content: string): {
  contentWithoutBlock: string;
  relevantContext: RelevantContext | null;
  contextEnvelope?: RelevantContextEnvelope | null;
} {
  const startIdx = content.indexOf(RELEVANT_CONTEXT_MARKER);
  if (startIdx !== 0) {
    return { contentWithoutBlock: content, relevantContext: null };
  }
  const afterStart = content.slice(RELEVANT_CONTEXT_MARKER.length).trimStart();
  const endIdx = afterStart.indexOf(RELEVANT_CONTEXT_END_MARKER);
  if (endIdx === -1) {
    return { contentWithoutBlock: content, relevantContext: null };
  }
  const jsonStr = afterStart.slice(0, endIdx).trim();
  const contentWithoutBlock = afterStart.slice(endIdx + RELEVANT_CONTEXT_END_MARKER.length).trimStart();
  const result = tryParseRelevantContextPayload(jsonStr);
  if (!result) {
    return { contentWithoutBlock, relevantContext: null };
  }
  // For stream-start overlay, prefer predicted context when present.
  const overlayContext =
    result.contextEnvelope?.predictedContext &&
    isContextPresent(result.contextEnvelope.predictedContext)
      ? result.contextEnvelope.predictedContext
      : result.relevantContext;
  return {
    contentWithoutBlock,
    relevantContext: overlayContext,
    contextEnvelope: result.contextEnvelope,
  };
}

const JOURNAL_CHECKPOINT_MARKER = "---JOURNAL-CHECKPOINT---";
const JOURNAL_CHECKPOINT_END_MARKER = "---END-JOURNAL-CHECKPOINT---";

interface JournalCheckpoint {
  prompt: string;
  options: string[];
}

function tryParseJournalCheckpointJson(jsonStr: string): JournalCheckpoint | null {
  const cleaned = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { prompt?: unknown; options?: unknown };
    const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
    const options = Array.isArray(parsed.options)
      ? parsed.options.filter((o): o is string => typeof o === "string").slice(0, 8)
      : [];
    if (!prompt) return null;
    return { prompt, options };
  } catch {
    return null;
  }
}

/** First top-level `{ ... }` in s (balanced braces); for inline JSON after ---JOURNAL-CHECKPOINT--- */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parses and strips the JOURNAL-CHECKPOINT block from assistant content.
 * Returns content without the block and the parsed journal checkpoint, or null if not found/invalid.
 */
export function parseJournalCheckpointBlock(content: string): {
  contentWithoutBlock: string;
  journalCheckpoint: JournalCheckpoint | null;
} {
  const idx = content.indexOf(JOURNAL_CHECKPOINT_MARKER);
  if (idx === -1) {
    return { contentWithoutBlock: content, journalCheckpoint: null };
  }
  const afterMarker = content.slice(idx + JOURNAL_CHECKPOINT_MARKER.length).trimStart();
  const endIdx = afterMarker.indexOf(JOURNAL_CHECKPOINT_END_MARKER);

  let jsonStr: string;
  let contentAfterBlock: string;

  if (endIdx !== -1) {
    jsonStr = afterMarker.slice(0, endIdx).trim();
    contentAfterBlock = afterMarker
      .slice(endIdx + JOURNAL_CHECKPOINT_END_MARKER.length)
      .trimStart();
  } else {
    // Model often omits ---END-JOURNAL-CHECKPOINT---; extract inline JSON after marker
    const extracted = extractFirstJsonObject(afterMarker);
    if (!extracted) {
      return { contentWithoutBlock: content, journalCheckpoint: null };
    }
    jsonStr = extracted;
    const jsonStartInAfter = afterMarker.indexOf(extracted);
    const consumedEnd =
      jsonStartInAfter >= 0 ? jsonStartInAfter + extracted.length : extracted.length;
    contentAfterBlock = afterMarker.slice(consumedEnd).trimStart();
  }

  const contentWithoutBlock = (content.slice(0, idx).trimEnd() + "\n\n" + contentAfterBlock).trim();
  const journalCheckpoint = tryParseJournalCheckpointJson(jsonStr);
  return {
    contentWithoutBlock,
    journalCheckpoint,
  };
}

const QUESTIONS_MARKER = "---QUESTIONS---";
const QUESTIONS_END_MARKER = "---END-QUESTIONS---";

export interface QuestionsBlockItem {
  prompt: string;
  options: string[];
}

function extractFirstJsonArray(s: string): string | null {
  const start = s.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseQuestionsJson(jsonStr: string): QuestionsBlockItem[] | null {
  const cleaned = jsonStr
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const items: QuestionsBlockItem[] = [];
    for (const raw of parsed.slice(0, 4)) {
      if (!raw || typeof raw !== "object") continue;
      const obj = raw as Record<string, unknown>;
      const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
      if (!prompt) continue;
      const options = Array.isArray(obj.options)
        ? obj.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 6)
        : [];
      if (options.length < 2) continue;
      items.push({ prompt, options });
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export function parseQuestionsBlock(content: string): {
  contentWithoutBlock: string;
  questions: QuestionsBlockItem[] | null;
} {
  const idx = content.indexOf(QUESTIONS_MARKER);
  if (idx === -1) {
    return { contentWithoutBlock: content, questions: null };
  }
  const afterMarker = content.slice(idx + QUESTIONS_MARKER.length).trimStart();
  const endIdx = afterMarker.indexOf(QUESTIONS_END_MARKER);

  let jsonStr: string;
  let contentAfterBlock: string;

  if (endIdx !== -1) {
    jsonStr = afterMarker.slice(0, endIdx).trim();
    contentAfterBlock = afterMarker
      .slice(endIdx + QUESTIONS_END_MARKER.length)
      .trimStart();
  } else {
    const extracted = extractFirstJsonArray(afterMarker);
    if (!extracted) {
      return { contentWithoutBlock: content, questions: null };
    }
    jsonStr = extracted;
    const jsonStartInAfter = afterMarker.indexOf(extracted);
    const consumedEnd =
      jsonStartInAfter >= 0 ? jsonStartInAfter + extracted.length : extracted.length;
    contentAfterBlock = afterMarker.slice(consumedEnd).trimStart();
  }

  let textBefore = content.slice(0, idx).trimEnd();
  if (contentAfterBlock) {
    textBefore = (textBefore + "\n\n" + contentAfterBlock).trim();
  }
  const optionsMatch = textBefore.match(OPTIONS_MARKER_REGEX);
  const contentWithoutBlock = optionsMatch && optionsMatch.index !== undefined
    ? textBefore.slice(0, optionsMatch.index).trimEnd()
    : textBefore;

  const questions = tryParseQuestionsJson(jsonStr);
  return { contentWithoutBlock, questions };
}

const OPTIONS_MARKER_REGEX = /-{2,3}\s*OPTIONS\s*-{2,3}/i;

/**
 * Some models emit [[model:snake_case_id]]; the app expects [[snake_case_id]].
 * Normalizes so chips and citation extraction match.
 */
export function normalizeMentalModelCitationMarkup(text: string): string {
  return text.replace(/\[\[model:([a-z0-9_]+)\]\]/gi, "[[$1]]");
}

/**
 * Parses an assistant message that may contain an OPTIONS block.
 * Format: main text, then "---OPTIONS---" (or "-- OPTIONS ---" etc.), then 4 options.
 * Options can be on separate lines or in one paragraph separated by ". ".
 */
export function parseAssistantMessage(content: string): {
  text: string;
  options: string[];
} {
  const match = content.match(OPTIONS_MARKER_REGEX);
  if (!match || match.index === undefined) {
    return { text: content.trim(), options: [] };
  }

  const idx = match.index;
  const markerLen = match[0].length;
  const text = content.slice(0, idx).trim();
  const optionsSection = content.slice(idx + markerLen).trim();

  function normalizeOption(line: string): string {
    const stripped = line
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();
    const bracketed = stripped.match(/^\[(.*)\]$/);
    return bracketed ? bracketed[1].trim() : stripped;
  }

  let options = optionsSection
    .split(/\r?\n/)
    .map(normalizeOption)
    .filter((line) => line.length > 0)
    .slice(0, 4);

  if (options.length < 4 && optionsSection.includes(". ")) {
    options = optionsSection
      .split(/\.\s+/)
      .map(normalizeOption)
      .filter((s) => s.length > 0)
      .slice(0, 4);
  }

  return { text, options };
}

/**
 * Extract the sentence or paragraph containing [[model_id]] for contextual relevance.
 * Strips the [[model_id]] markup and returns surrounding text.
 */
export function extractRelevanceContext(
  content: string,
  modelId: string
): string | null {
  const text = normalizeMentalModelCitationMarkup(content);
  if (!text?.includes(`[[${modelId}]]`)) return null;
  const escaped = modelId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `[^.!?]*\\[\\[${escaped}\\]\\][^.!?]*[.!?]`,
    "i"
  );
  const match = text.match(pattern);
  if (match) {
    return match[0]
      .replace(/\[\[[a-z0-9_]+\]\]/g, (m) =>
        m.slice(2, -2).replace(/_/g, " ")
      )
      .trim();
  }
  const paraMatch = text.match(
    new RegExp(`[^\\n]*\\[\\[${escaped}\\]\\][^\\n]*`, "i")
  );
  if (paraMatch) {
    return paraMatch[0]
      .replace(/\[\[[a-z0-9_]+\]\]/g, (m) =>
        m.slice(2, -2).replace(/_/g, " ")
      )
      .trim();
  }
  return null;
}

/** Extract unique mental model IDs from text ([[model_id]] or [[Display Name]] format). */
export function extractMentalModelIds(
  text: string,
  nameToId?: Map<string, string>
): string[] {
  const normalized = normalizeMentalModelCitationMarkup(text);
  const ids: string[] = [];
  // [[id]] format (lowercase, underscores)
  for (const m of normalized.matchAll(/\[\[([a-z0-9_]+)\]\]/g)) {
    ids.push(m[1]);
  }
  // [[Display Name]] format - resolve via nameToId when provided
  if (nameToId && nameToId.size > 0) {
    for (const m of normalized.matchAll(/\[\s*\[\s*([^\]]+?)\s*\]\s*\]/g)) {
      const trimmed = m[1].trim();
      if (!/^[a-z0-9_]+$/.test(trimmed)) {
        const id = nameToId.get(trimmed);
        if (id) ids.push(id);
      }
    }
  }
  return [...new Set(ids)];
}

/** Extract unique mental model IDs from all assistant messages. */
export function extractMentalModelIdsFromMessages(
  messages: { role: string; content: string }[]
): string[] {
  const ids = messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => extractMentalModelIds(m.content));
  return [...new Set(ids)];
}

const MENTOR_RESPONSES_MARKER = "---MENTOR-RESPONSES---";
const MENTOR_RESPONSES_END_MARKER = "---END-MENTOR-RESPONSES---";

export interface MentorResponse {
  figureId: string;
  figureName: string;
  content: string;
}

/**
 * Parses the MENTOR-RESPONSES block from assistant content.
 * Returns { contentWithoutBlock, mentorResponses }.
 */
export function parseMentorResponsesBlock(content: string): {
  contentWithoutBlock: string;
  mentorResponses: MentorResponse[] | null;
} {
  const idx = content.indexOf(MENTOR_RESPONSES_MARKER);
  if (idx === -1) {
    return { contentWithoutBlock: content, mentorResponses: null };
  }
  const afterMarker = content.slice(idx + MENTOR_RESPONSES_MARKER.length).trimStart();
  const endIdx = afterMarker.indexOf(MENTOR_RESPONSES_END_MARKER);
  if (endIdx === -1) {
    return { contentWithoutBlock: content, mentorResponses: null };
  }
  const jsonStr = afterMarker.slice(0, endIdx).trim();
  const contentBeforeBlock = content.slice(0, idx).trimEnd();
  const contentAfterBlock = afterMarker.slice(endIdx + MENTOR_RESPONSES_END_MARKER.length).trimStart();
  const contentWithoutBlock = [contentBeforeBlock, contentAfterBlock].filter(Boolean).join("\n\n");

  try {
    const parsed = JSON.parse(jsonStr) as { responses?: unknown };
    if (!Array.isArray(parsed.responses)) return { contentWithoutBlock, mentorResponses: null };
    const mentorResponses = parsed.responses
      .filter(
        (r): r is MentorResponse =>
          r &&
          typeof r === "object" &&
          typeof (r as MentorResponse).figureId === "string" &&
          typeof (r as MentorResponse).figureName === "string" &&
          typeof (r as MentorResponse).content === "string"
      )
      .map((r) => ({
        figureId: r.figureId,
        figureName: r.figureName,
        content: r.content,
      }));
    return { contentWithoutBlock, mentorResponses: mentorResponses.length > 0 ? mentorResponses : null };
  } catch {
    return { contentWithoutBlock, mentorResponses: null };
  }
}

/**
 * Builds the MENTOR-RESPONSES block for storage.
 */
export function buildMentorResponsesBlock(responses: MentorResponse[]): string {
  const json = JSON.stringify({ responses });
  return `${MENTOR_RESPONSES_MARKER}\n${json}\n${MENTOR_RESPONSES_END_MARKER}`;
}
