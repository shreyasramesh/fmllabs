import { getModel } from "@/lib/gemini";
import {
  getSavedTranscript,
  updateJournalMentorReflections,
  getUserSettings,
  getCustomMentorsByIds,
  type JournalMentorReflectionItem,
} from "@/lib/db";
import {
  loadFamousFigures,
  type FamousFigure,
  type FamousFigureCategory,
} from "@/lib/famous-figures";
import { resolveMentorFigure } from "@/lib/resolve-mentor-figure";
import { computeGeminiCost, recordUsageEvent } from "@/lib/usage";

const JOURNAL_MAX_CHARS = 12_000;
const CANDIDATE_CAP = 200;
const DESCRIPTION_MAX = 300;
const JSON_GENERATION_CONFIG = {
  temperature: 0.35,
  maxOutputTokens: 8192,
} as const;

function recordUsage(
  result: {
    response: {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
  },
  userId: string,
  eventType: string
): void {
  const um = result.response.usageMetadata;
  if (!um || (um.promptTokenCount ?? 0) === 0) return;
  const inputTokens = um.promptTokenCount ?? 0;
  const outputTokens = um.candidatesTokenCount ?? 0;
  recordUsageEvent({
    userId,
    service: "gemini",
    eventType,
    costUsd: computeGeminiCost(inputTokens, outputTokens),
    metadata: { inputTokens, outputTokens },
  }).catch((e) => console.error("Gemini usage recording failed:", e));
}

function parseJsonObject(raw: string): unknown {
  const text = raw.trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

function truncateDescription(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= DESCRIPTION_MAX) return t;
  return t.slice(0, DESCRIPTION_MAX - 3).trimEnd() + "...";
}

function buildCategoriesBlock(categories: FamousFigureCategory[]): string {
  return categories.map((c) => `- id: "${c.id}" — ${c.name}`).join("\n");
}

async function routeToCategories(
  journalText: string,
  categories: FamousFigureCategory[],
  userId: string
): Promise<string[]> {
  const clipped = journalText.trim().slice(0, JOURNAL_MAX_CHARS);
  const validIds = new Set(categories.map((c) => c.id));
  const prompt = `You match a private journal entry to mentor figure categories. Each category groups historical or public figures who might offer a resonant perspective.

CATEGORIES (use only these exact "id" values in your answer):
${buildCategoriesBlock(categories)}

TASK:
Read the journal entry and choose **3 to 6** category ids that best fit the themes, struggles, or questions in the text. Prefer diversity when multiple categories apply.

Return ONLY valid JSON with this exact shape (no markdown):
{"categoryIds":["id1","id2",...],"rationale":"one short line for logging"}

Journal entry:
${clipped}`;

  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: JSON_GENERATION_CONFIG,
  });
  recordUsage(result, userId, "journal_mentor_reflections_routing");

  const text = result.response.text()?.trim() ?? "";
  let parsed: { categoryIds?: unknown };
  try {
    parsed = parseJsonObject(text) as { categoryIds?: unknown };
  } catch (e) {
    console.error("Journal mentor routing JSON parse failed:", e);
    return [];
  }

  const raw = Array.isArray(parsed.categoryIds)
    ? parsed.categoryIds.filter((id): id is string => typeof id === "string")
    : [];

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    const n = id.trim();
    if (validIds.has(n) && !seen.has(n)) {
      seen.add(n);
      picked.push(n);
    }
  }

  if (picked.length < 3) {
    for (const c of categories) {
      if (picked.length >= 3) break;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        picked.push(c.id);
      }
    }
  }

  return picked.slice(0, 6);
}

function unionFiguresByCategories(categoryIds: string[], figures: FamousFigure[]): FamousFigure[] {
  const set = new Set(categoryIds);
  return figures.filter((f) => set.has(f.category));
}

function capCandidates(
  figures: FamousFigure[],
  userId: string,
  transcriptId: string
): FamousFigure[] {
  if (figures.length <= CANDIDATE_CAP) return figures;
  const seed = hashStringToSeed(`${userId}:${transcriptId}:mentor_candidates`);
  return shuffleWithSeed(figures, seed).slice(0, CANDIDATE_CAP);
}

/** Deterministic 2–5 so count varies by entry; avoids the model defaulting to four every time. */
function targetMentorReflectionCount(
  userId: string,
  transcriptId: string,
  journalText: string
): number {
  const s = `${userId}:${transcriptId}:${journalText.trim().slice(0, 400)}`;
  return 2 + (hashStringToSeed(s) % 4);
}

const MENTOR_VOICE_RULES = `Voice rules (intellectual mentor, not a generic assistant):
- Write in **that figure's** voice: priorities, temper, and worldview—not neutral advice with a famous name.
- **2–4 sentences** per reflection. Concise; no bullet lists unless natural to the voice.
- **Language:** Match the **same language** as the journal entry.
- No meta-talk (no "as an AI", no mentioning models). Do not name other historical figures.
- No lecturing on the figure's biography; respond to the **user's** journal as this mentor would.`;

async function selectReflections(
  journalText: string,
  candidates: FamousFigure[],
  userId: string,
  targetCount: number
): Promise<{ figureId: string; reflection: string }[]> {
  const clipped = journalText.trim().slice(0, JOURNAL_MAX_CHARS);
  const n = Math.min(5, Math.max(2, targetCount));
  const candidateJson = candidates.map((f) =>
    JSON.stringify({
      figureId: f.id,
      name: f.name,
      description: truncateDescription(f.description),
    })
  );

  const prompt = `You choose mentors and write short reflective passages for someone who wrote a private journal entry.

${MENTOR_VOICE_RULES}

CANDIDATE FIGURES (you MUST choose figureId values only from this list):
[
${candidateJson.join(",\n")}
]

TASK:
1. Pick **exactly ${n}** distinct figures from the list whose lens genuinely fits the journal (not more, not fewer). Do not default to four—this entry’s required count is **${n}**.
2. For each, write a "reflection" field: a short passage **in that figure's voice** speaking to what the journal raises.

Return ONLY valid JSON (no markdown) with exactly this shape:
{"reflections":[{"figureId":"...","reflection":"..."},...]}

The "reflections" array length must be **exactly ${n}**. Every figureId must appear exactly once and must be copied exactly from the candidate list.

Journal entry:
${clipped}`;

  const model = getModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: JSON_GENERATION_CONFIG,
  });
  recordUsage(result, userId, "journal_mentor_reflections_write");

  const text = result.response.text()?.trim() ?? "";
  let parsed: { reflections?: unknown };
  try {
    parsed = parseJsonObject(text) as { reflections?: unknown };
  } catch (e) {
    console.error("Journal mentor reflections JSON parse failed:", e);
    return [];
  }

  const arr = Array.isArray(parsed.reflections) ? parsed.reflections : [];
  const candidateIds = new Set(candidates.map((c) => c.id));
  const out: { figureId: string; reflection: string }[] = [];
  const used = new Set<string>();

  for (const row of arr) {
    if (out.length >= n) break;
    if (!row || typeof row !== "object") continue;
    const fid = (row as { figureId?: string }).figureId;
    const ref = (row as { reflection?: string }).reflection;
    if (typeof fid !== "string" || typeof ref !== "string") continue;
    const id = fid.trim();
    if (!candidateIds.has(id) || used.has(id)) continue;
    const reflection = ref.trim();
    if (!reflection) continue;
    used.add(id);
    out.push({ figureId: id, reflection });
  }

  return out;
}

async function toPersistedItems(
  rows: { figureId: string; reflection: string }[],
  userId: string
): Promise<JournalMentorReflectionItem[]> {
  const items: JournalMentorReflectionItem[] = [];
  for (const row of rows) {
    const fig = await resolveMentorFigure(userId, row.figureId);
    if (!fig) continue;
    items.push({
      figureId: row.figureId,
      figureName: fig.name,
      reflection: row.reflection,
    });
  }
  return items;
}

/**
 * Loads the journal transcript, runs the two-phase Gemini pipeline, and persists reflections or failed status.
 */
export async function runJournalMentorReflections(transcriptId: string, userId: string): Promise<void> {
  const transcript = await getSavedTranscript(transcriptId, userId);
  if (!transcript || transcript.sourceType !== "journal") {
    return;
  }

  const journalText = transcript.transcriptText?.trim() ?? "";
  if (!journalText) {
    await updateJournalMentorReflections(transcriptId, userId, { status: "failed" });
    return;
  }

  try {
    const { categories, figures } = loadFamousFigures();
    if (categories.length === 0 || figures.length === 0) {
      await updateJournalMentorReflections(transcriptId, userId, { status: "failed" });
      return;
    }

    const categoryIds = await routeToCategories(journalText, categories, userId);
    let pool = unionFiguresByCategories(categoryIds, figures);
    if (pool.length === 0) {
      pool = [...figures];
    }
    const settings = await getUserSettings(userId);
    const customFollowed = (settings?.followedFigureIds ?? []).filter((id) => id.startsWith("cm_"));
    if (customFollowed.length > 0) {
      const customRows = await getCustomMentorsByIds(userId, customFollowed);
      const poolIds = new Set(pool.map((f) => f.id));
      for (const c of customRows) {
        if (poolIds.has(c.id)) continue;
        poolIds.add(c.id);
        pool.push({
          id: c.id,
          name: c.name,
          description: c.description,
          category: c.category,
        });
      }
    }
    const candidates = capCandidates(pool, userId, transcriptId);
    if (candidates.length < 2) {
      await updateJournalMentorReflections(transcriptId, userId, { status: "failed" });
      return;
    }

    const targetCount = targetMentorReflectionCount(userId, transcriptId, journalText);
    const rawRows = await selectReflections(journalText, candidates, userId, targetCount);
    let persisted = await toPersistedItems(rawRows, userId);

    if (persisted.length > targetCount) {
      persisted = persisted.slice(0, targetCount);
    }

    if (persisted.length < 2 || persisted.length > 5) {
      await updateJournalMentorReflections(transcriptId, userId, { status: "failed" });
      return;
    }

    const ok = await updateJournalMentorReflections(transcriptId, userId, {
      status: "ready",
      reflections: persisted,
    });
    if (!ok) {
      console.error("updateJournalMentorReflections ready failed for", transcriptId);
    }
  } catch (err) {
    console.error("runJournalMentorReflections error:", err);
    await updateJournalMentorReflections(transcriptId, userId, { status: "failed" });
  }
}
