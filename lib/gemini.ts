import { GoogleGenerativeAI } from "@google/generative-ai";
import type { HabitBucket } from "@/lib/habit-buckets";
import { recordUsageEvent, computeGeminiCost } from "@/lib/usage";
import {
  EXTRACT_CONCEPTS_CHUNK_CHARS,
  EXTRACT_CONCEPTS_CHUNK_OVERLAP_CHARS,
  EXTRACT_CONCEPTS_MAX_TOTAL_CHARS,
} from "@/lib/extract-concepts-constants";

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env.local (get a key from https://aistudio.google.com/apikey)"
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

/** Chat-only: slightly higher temperature for more natural, varied empathetic phrasing (not used for extraction/summaries). */
export const CHAT_GENERATION_CONFIG = {
  temperature: 0.88,
  topP: 0.95,
} as const;

function formatDevLogBlock(title: string, content: string): string {
  const divider = "=".repeat(28);
  return `\n${divider} ${title} ${divider}\n${content}\n${"=".repeat(
    divider.length * 2 + title.length + 2
  )}`;
}

function prettyJsonIfPossible(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function recordGeminiUsageFromResult(
  result: { response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } },
  usageContext: { userId: string | null; eventType: string }
): void {
  const um = result.response.usageMetadata;
  if (!um || (um.promptTokenCount ?? 0) === 0) return;
  const inputTokens = um.promptTokenCount ?? 0;
  const outputTokens = um.candidatesTokenCount ?? 0;
  const costUsd = computeGeminiCost(inputTokens, outputTokens);
  recordUsageEvent({
    userId: usageContext.userId,
    service: "gemini",
    eventType: usageContext.eventType,
    costUsd,
    metadata: { inputTokens, outputTokens },
  }).catch((e) => console.error("Gemini usage recording failed:", e));
}

export function getModel(systemInstruction?: string) {
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
  });
}

export interface StreamGenerateContentOptions {
  onUsage?: (inputTokens: number, outputTokens: number) => void;
}

export async function* streamGenerateContent(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: StreamGenerateContentOptions
) {
  const model = getModel(systemPrompt);

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
    generationConfig: CHAT_GENERATION_CONFIG,
  });

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("Last message must be from user");
  }

  const result = await chat.sendMessageStream(lastMessage.content);
  const stream = result.stream;

  for await (const chunk of stream) {
    const text = chunk.text();
    if (text) yield text;
  }

  // Use aggregated response for usage - stream chunks may not include usageMetadata until the final chunk.
  // The response promise resolves with the full aggregated response including usageMetadata.
  const finalResponse = await result.response;
  const um = finalResponse.usageMetadata as
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        prompt_token_count?: number;
        candidates_token_count?: number;
      }
    | undefined;
  if (options?.onUsage && um) {
    const inputTokens = um.promptTokenCount ?? um.prompt_token_count ?? 0;
    const outputTokens = um.candidatesTokenCount ?? um.candidates_token_count ?? 0;
    if (inputTokens > 0) {
      options.onUsage(inputTokens, outputTokens);
    }
  }
}

/**
 * Non-streaming generate: returns full response text.
 * Used for multi-mentor mode where we need one complete response per figure.
 */
export async function generateContent(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: StreamGenerateContentOptions
): Promise<string> {
  const model = getModel(systemPrompt);

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
    generationConfig: CHAT_GENERATION_CONFIG,
  });

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("Last message must be from user");
  }

  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;
  const text = response.text?.() ?? "";

  const um = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; prompt_token_count?: number; candidates_token_count?: number } }).usageMetadata;
  if (options?.onUsage && um) {
    const inputTokens = um.promptTokenCount ?? um.prompt_token_count ?? 0;
    const outputTokens = um.candidatesTokenCount ?? um.candidates_token_count ?? 0;
    if (inputTokens > 0) {
      options.onUsage(inputTokens, outputTokens);
    }
  }

  return text;
}

export interface GeminiUsageContext {
  userId: string | null;
  eventType: string;
}

export async function generateSummaryAndEnrichment(
  messages: { role: string; content: string }[],
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ summary: string; enrichmentPrompt: string; chainOfThought: string[] }> {
  const conversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the summary, enrichmentPrompt, and chainOfThought in ${languageName}.`
      : "";

  const model = getModel();
  const result = await model.generateContent(
    `You are summarizing a conversation for long-term memory. Return a JSON object with exactly three keys:
- "chainOfThought": An array of 4-6 reasoning steps. Each step is MAX 3 WORDS. Use plain, everyday language—no jargon, no "query" or abstract terms. Each chip must be instantly understandable at a glance: the user sees it and immediately grasps the reasoning. Prefer concrete phrases: "Considering breakup" not "Break up query"; "Worried about future" not "Future path"; "Feels stuck" not "Stuck state". Capture the user's actual situation and emotions in simple words.
- "summary": A 2-4 paragraph narrative summary of the conversation. Capture key topics, decisions, and context.
- "enrichmentPrompt": An extremely compact, dense 1-sentence context (max 25 words). Capture only the most critical facts: key decisions, preferences, or user context. No filler. Example: "User weighing job change; values work-life balance; hesitant about relocation."
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

Conversation:
${conversation}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    summary?: string;
    enrichmentPrompt?: string;
    chainOfThought?: string[];
  };
  const chainOfThought = Array.isArray(parsed.chainOfThought)
    ? parsed.chainOfThought.filter((s): s is string => typeof s === "string")
    : [];
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    summary: parsed.summary ?? "",
    enrichmentPrompt: parsed.enrichmentPrompt ?? "",
    chainOfThought,
  };
}

/** Chain-of-thought chips for a framework (concept group) — same chip style as LTM summaries; no narrative summary. */
export async function generateFrameworkChainOfThought(
  frameworkTitle: string,
  concepts: { title: string; summary: string; enrichmentPrompt: string }[],
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ chainOfThought: string[] }> {
  if (concepts.length === 0) {
    return { chainOfThought: [] };
  }

  const conceptsBlock = concepts
    .map(
      (c, i) =>
        `### Concept ${i + 1}: ${c.title}\nSummary: ${c.summary}\nEnrichment: ${c.enrichmentPrompt}`
    )
    .join("\n\n");

  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the chainOfThought in ${languageName}.`
      : "";

  const model = getModel();
  const result = await model.generateContent(
    `You are synthesizing a user's framework: a named collection of related custom concepts (ideas, goals, or principles they defined). Return a JSON object with exactly one key:
- "chainOfThought": An array of 4-6 reasoning steps that show how these concepts connect and what unifies this framework. Each step is MAX 3 WORDS. Use plain, everyday language—no jargon, no abstract terms. Each chip must be instantly understandable at a glance. Prefer concrete phrases that capture themes across the concepts (e.g. "Work-life balance", "Career pivot").
Do not include a narrative summary or any other keys.
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

Framework title: ${frameworkTitle}

Concepts in this framework:
${conceptsBlock}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    chainOfThought?: string[];
  };
  const chainOfThought = Array.isArray(parsed.chainOfThought)
    ? parsed.chainOfThought.filter((s): s is string => typeof s === "string")
    : [];
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return { chainOfThought };
}

export async function generateJournalCheckpointSuggestion(
  messages: { role: string; content: string }[],
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ prompt: string; options: string[] }> {
  const conversation = messages
    .slice(-16)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const languageInstruction =
    languageName && languageName !== "English"
      ? `Write prompt and options in ${languageName}.`
      : "";

  const model = getModel();
  const result = await model.generateContent(
    `You create a reflective journal checkpoint for a user conversation.

Return ONLY valid JSON with exactly:
- "prompt": 1-2 short first-person reflective sentence templates with one or more blanks written as _____. The prompt must be incomplete until blanks are filled.
- "options": 4-6 short phrase options for filling blanks. Keep them personal, emotionally aware, and grounded in what the user actually shared.

Rules:
- This is NOT a next-turn assistant reply.
- Do not reuse assistant action/options text.
- Infer what the user would genuinely want to remember from the conversation so far.
- Prefer phrase-like options (3-10 words), not full long sentences.
- Keep wording natural and concise.
- NEVER return a fully-complete statement as prompt; always include at least one blank.
- The user should clearly understand they are completing a journal sentence.
${languageInstruction}

Conversation:
${conversation}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { prompt?: string; options?: unknown };
  const options = Array.isArray(parsed.options)
    ? parsed.options
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter((opt) => opt.length > 0)
        .slice(0, 6)
    : [];
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    prompt: (parsed.prompt ?? "I want to remember _____").trim(),
    options,
  };
}

export type CalorieTrackingIntent = "nutrition" | "exercise" | "mixed";

export interface CalorieTrackingAnalyzeResult {
  intent: CalorieTrackingIntent;
  questions: string[];
}

export interface CalorieTrackingFinalizeResult {
  intent: CalorieTrackingIntent;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  nutrition?: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    notes: string;
  };
  exercise?: {
    caloriesBurned: number | null;
    carbsUsedGrams?: number | null;
    fatUsedGrams?: number | null;
    proteinDeltaGrams?: number | null;
    notes: string;
  };
}

export interface NutritionDailyReportInput {
  dayLabel: string;
  focusPrompt?: string;
  goals: {
    caloriesTarget: number;
    carbsTargetGrams: number;
    proteinTargetGrams: number;
    fatTargetGrams: number;
  };
  totals: {
    caloriesFood: number;
    caloriesExercise: number;
    caloriesRemaining: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
  };
}

export interface NutritionDailyReportResult {
  summary: string;
  goalStatus: string;
  highlights: string[];
  tomorrowTips: string[];
}

export interface NutritionGoalGuidanceInput {
  userGoalIntent: string;
  periodLabel: string;
  goals: {
    caloriesTargetPerDay: number;
    carbsTargetGrams: number;
    proteinTargetGrams: number;
    fatTargetGrams: number;
  };
  weeklyTotals: {
    caloriesFood: number;
    caloriesExercise: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
    trackedDays: number;
    foodEntries: number;
    exerciseEntries: number;
  };
  dailyRows: Array<{
    dayKey: string;
    caloriesFood: number;
    caloriesExercise: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
    foodEntries: number;
    exerciseEntries: number;
  }>;
}

export interface NutritionGoalGuidanceResult {
  summary: string;
  badPatterns: string[];
  keepInMind: string[];
  onTrackNuggets: string[];
}

export interface WeeklyJournalReflectionInput {
  weekLabel: string;
  journalEntries: Array<{ dayKey: string; text: string }>;
  emotionSignals: string[];
  behaviorSignals: string[];
  followedMentorReflections: Array<{ figureName: string; reflection: string; dayKey: string }>;
}

export interface WeeklyJournalReflectionResult {
  summary: string;
  emotionPatterns: string[];
  behaviorPatterns: string[];
  mentorInsights: string[];
  nextWeekActions: string[];
}

export interface CalorieTrackingEnrichedEntryResult {
  nutritionEntry?: string;
  exerciseEntry?: string;
}

export interface ReusableJournalTagItem {
  tag: string;
  displayName: string;
  aliases?: string[];
}

export interface NutritionImageTranscriptionResult {
  dishName: string;
  foodsDetected: string[];
  portionAssumptions: string[];
  nutritionLogDraft: string;
  confidence: "low" | "medium" | "high";
}

export interface NutritionGoalsProfileInput {
  age: number;
  gender: "male" | "female";
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  goal: "lose_weight" | "maintain_weight" | "gain_weight";
  pace: "extreme" | "moderate" | "mild";
}

export interface NutritionGoalsResult {
  caloriesTarget: number | null;
  carbsPercent: number | null;
  proteinPercent: number | null;
  fatPercent: number | null;
  carbsGrams: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  rationale?: string;
}

function toFiniteNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeTagToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+[{\]}\\|;:'",<>/?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function extractReusableJournalTags(
  kind: "nutrition" | "exercise",
  entryText: string,
  usageContext?: GeminiUsageContext
): Promise<ReusableJournalTagItem[]> {
  const text = entryText.trim().slice(0, 1200);
  if (!text) return [];
  const model = getModel();
  const result = await model.generateContent(
    `You normalize ${kind} logs into reusable canonical tags.

Task:
- Extract 1 to 4 reusable items from the text.
- Collapse wording variants into one canonical tag.

Rules:
- tag: snake_case, short, canonical, max 4 words.
- displayName: human-friendly short label.
- aliases: optional short variants users might type.
- Keep only concrete food/drink items or exercise activity items.
- Do NOT include portions, adjectives like "big", or time-of-day words in tag.
- Return only valid JSON.

Return exactly:
{
  "items": [
    { "tag": "string", "displayName": "string", "aliases": ["string"] }
  ]
}

Kind: ${kind}
Text:
${text}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      items?: Array<{ tag?: unknown; displayName?: unknown; aliases?: unknown }>;
    };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const normalizedItems: ReusableJournalTagItem[] = [];
    for (const item of items) {
      const tag = typeof item.tag === "string" ? normalizeTagToken(item.tag) : "";
      if (!tag) continue;
      const displayName =
        typeof item.displayName === "string" && item.displayName.trim()
          ? item.displayName.trim().slice(0, 80)
          : tag.replace(/_/g, " ");
      const aliases = Array.isArray(item.aliases)
        ? item.aliases
            .map((a) => (typeof a === "string" ? normalizeTagToken(a) : ""))
            .filter(Boolean)
            .slice(0, 6)
        : [];
      normalizedItems.push({ tag, displayName, aliases });
      if (normalizedItems.length >= 4) break;
    }
    return normalizedItems;
  } catch {
    const fallbackTag = normalizeTagToken(text.split(/[.,;:\n]/)[0] ?? "");
    if (!fallbackTag) return [];
    return [
      {
        tag: fallbackTag,
        displayName: fallbackTag.replace(/_/g, " ").slice(0, 80),
        aliases: [],
      },
    ];
  }
}

export async function enrichCalorieTrackingEntries(
  inputText: string,
  clarificationAnswers: string[],
  usageContext?: GeminiUsageContext
): Promise<CalorieTrackingEnrichedEntryResult> {
  const text = inputText.trim().slice(0, 8_000);
  const answers = clarificationAnswers
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!text) return {};
  const model = getModel();
  const result = await model.generateContent(
    `You rewrite calorie-tracker logs into focused, type-specific enriched entries.

Task:
- Produce a nutrition-only entry (food/drink details only).
- Produce an exercise-only entry (workout/activity details only).
- If one type is absent, return empty string for that type.

Rules:
- Do not mix nutrition details into exercise entry.
- Do not mix exercise details into nutrition entry.
- Keep each entry concise (1-3 sentences), factual, and plain language.
- Keep same language as user input.
- Do not include headings, markdown, bullets, or extra commentary.

Return ONLY valid JSON with exactly:
{
  "nutritionEntry": "string",
  "exerciseEntry": "string"
}

Original input:
${text}

Clarification answers:
${answers.length ? answers.map((a, i) => `${i + 1}. ${a}`).join("\n") : "(none)"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      nutritionEntry?: unknown;
      exerciseEntry?: unknown;
    };
    const nutritionEntry =
      typeof parsed.nutritionEntry === "string" ? parsed.nutritionEntry.trim().slice(0, 1200) : "";
    const exerciseEntry =
      typeof parsed.exerciseEntry === "string" ? parsed.exerciseEntry.trim().slice(0, 1200) : "";
    return {
      ...(nutritionEntry ? { nutritionEntry } : {}),
      ...(exerciseEntry ? { exerciseEntry } : {}),
    };
  } catch {
    return {};
  }
}

export async function transcribeNutritionImage(
  input: { imageBase64: string; mimeType: string; hintText?: string },
  usageContext?: GeminiUsageContext
): Promise<NutritionImageTranscriptionResult> {
  const cleanBase64 = input.imageBase64.trim();
  const hintText = (input.hintText ?? "").trim().slice(0, 600);
  const imageModel = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-image-preview",
  });
  const result = await imageModel.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are helping users log nutrition from food images.

Analyze the image and return ONLY valid JSON in this exact shape:
{
  "dishName": "short likely dish name",
  "foodsDetected": ["food item", "..."],
  "portionAssumptions": ["short assumption", "..."],
  "nutritionLogDraft": "1-3 sentence plain-text draft for a nutrition log, mentioning visible foods and likely portions",
  "confidence": "low" | "medium" | "high"
}

Rules:
- Be concrete and practical.
- If uncertain, say "likely" and include assumptions.
- Keep foodsDetected to max 8 items.
- Keep portionAssumptions to max 6 items.
- No markdown, no extra keys, no surrounding text.

Optional user hint:
${hintText || "(none)"}`,
          },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: cleanBase64,
            },
          },
        ],
      },
    ],
  });
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      dishName?: unknown;
      foodsDetected?: unknown;
      portionAssumptions?: unknown;
      nutritionLogDraft?: unknown;
      confidence?: unknown;
    };
    const foodsDetected = Array.isArray(parsed.foodsDetected)
      ? parsed.foodsDetected
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const portionAssumptions = Array.isArray(parsed.portionAssumptions)
      ? parsed.portionAssumptions
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const confidence: "low" | "medium" | "high" =
      parsed.confidence === "low" || parsed.confidence === "high" ? parsed.confidence : "medium";
    const dishName = typeof parsed.dishName === "string" ? parsed.dishName.trim().slice(0, 120) : "";
    const nutritionLogDraft =
      typeof parsed.nutritionLogDraft === "string" && parsed.nutritionLogDraft.trim()
        ? parsed.nutritionLogDraft.trim().slice(0, 1200)
        : [
            dishName ? `Likely dish: ${dishName}.` : "",
            foodsDetected.length > 0 ? `Visible foods: ${foodsDetected.join(", ")}.` : "",
            portionAssumptions.length > 0 ? `Assumptions: ${portionAssumptions.join("; ")}.` : "",
          ]
            .filter(Boolean)
            .join(" ");
    return {
      dishName,
      foodsDetected,
      portionAssumptions,
      nutritionLogDraft,
      confidence,
    };
  } catch {
    return {
      dishName: "",
      foodsDetected: [],
      portionAssumptions: [],
      nutritionLogDraft: "Could not confidently parse the image. Please describe what you ate in text.",
      confidence: "low",
    };
  }
}

export async function analyzeCalorieTrackingInput(
  inputText: string,
  usageContext?: GeminiUsageContext
): Promise<CalorieTrackingAnalyzeResult> {
  const text = inputText.trim().slice(0, 8_000);
  if (!text) {
    return { intent: "nutrition", questions: [] };
  }
  const model = getModel();
  const result = await model.generateContent(
    `You are helping with calorie tracking and nutrition/workout logging.

Classify the user's text into:
- "nutrition": food/drink intake only
- "exercise": workout/activity only
- "mixed": contains both food/drink and exercise

Then decide if clarification questions are needed before estimating calories/macros.
Rules:
- Ask at most 2 clarification questions total.
- Ask concise, specific questions only if needed for a better estimate.
- If enough detail is already present, return an empty questions array.

Return ONLY valid JSON with exactly:
{
  "intent": "nutrition" | "exercise" | "mixed",
  "questions": ["...", "..."] // 0 to 2 items
}

User input:
${text}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { intent?: string; questions?: unknown };
    const intent: CalorieTrackingIntent =
      parsed.intent === "exercise" || parsed.intent === "mixed" ? parsed.intent : "nutrition";
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q) => (typeof q === "string" ? q.trim() : ""))
          .filter((q) => q.length > 0)
          .slice(0, 2)
      : [];
    return { intent, questions };
  } catch {
    return { intent: "nutrition", questions: [] };
  }
}

export async function finalizeCalorieTrackingEstimate(
  inputText: string,
  clarificationAnswers: string[],
  usageContext?: GeminiUsageContext
): Promise<CalorieTrackingFinalizeResult> {
  const text = inputText.trim().slice(0, 8_000);
  const answers = clarificationAnswers
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 2);
  const model = getModel();
  const result = await model.generateContent(
    `You estimate nutrition and exercise calories from user logs.

Use the user's original text and any clarification answers to produce your best estimate.
Return ONLY valid JSON with exactly this shape:
{
  "intent": "nutrition" | "exercise" | "mixed",
  "confidence": "low" | "medium" | "high",
  "assumptions": ["short assumption", "..."],
  "nutrition": {
    "calories": number | null,
    "proteinGrams": number | null,
    "carbsGrams": number | null,
    "fatGrams": number | null,
    "notes": "short note"
  } | null,
  "exercise": {
    "caloriesBurned": number | null,
    "carbsUsedGrams": number | null,
    "fatUsedGrams": number | null,
    "proteinDeltaGrams": number | null,
    "notes": "short note"
  } | null
}

Rules:
- For nutrition-only, set exercise to null.
- For exercise-only, set nutrition to null.
- For mixed, provide both.
- Use null when unknown instead of inventing exact values.
- Keep assumptions concise and grounded.

Original input:
${text}

Clarification answers:
${answers.length ? answers.map((a, i) => `${i + 1}. ${a}`).join("\n") : "(none)"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      intent?: string;
      confidence?: string;
      assumptions?: unknown;
      nutrition?: {
        calories?: unknown;
        proteinGrams?: unknown;
        carbsGrams?: unknown;
        fatGrams?: unknown;
        notes?: unknown;
      } | null;
      exercise?: {
        caloriesBurned?: unknown;
        carbsUsedGrams?: unknown;
        fatUsedGrams?: unknown;
        proteinDeltaGrams?: unknown;
        notes?: unknown;
      } | null;
    };

    const intent: CalorieTrackingIntent =
      parsed.intent === "exercise" || parsed.intent === "mixed" ? parsed.intent : "nutrition";
    const confidence: "low" | "medium" | "high" =
      parsed.confidence === "low" || parsed.confidence === "high" ? parsed.confidence : "medium";
    const assumptions = Array.isArray(parsed.assumptions)
      ? parsed.assumptions
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const nutrition =
      parsed.nutrition && typeof parsed.nutrition === "object"
        ? {
            calories: toFiniteNumberOrNull(parsed.nutrition.calories),
            proteinGrams: toFiniteNumberOrNull(parsed.nutrition.proteinGrams),
            carbsGrams: toFiniteNumberOrNull(parsed.nutrition.carbsGrams),
            fatGrams: toFiniteNumberOrNull(parsed.nutrition.fatGrams),
            notes: typeof parsed.nutrition.notes === "string" ? parsed.nutrition.notes.trim() : "",
          }
        : undefined;

    const exercise =
      parsed.exercise && typeof parsed.exercise === "object"
        ? {
            caloriesBurned: toFiniteNumberOrNull(parsed.exercise.caloriesBurned),
            carbsUsedGrams: toFiniteNumberOrNull(parsed.exercise.carbsUsedGrams),
            fatUsedGrams: toFiniteNumberOrNull(parsed.exercise.fatUsedGrams),
            proteinDeltaGrams: toFiniteNumberOrNull(parsed.exercise.proteinDeltaGrams),
            notes: typeof parsed.exercise.notes === "string" ? parsed.exercise.notes.trim() : "",
          }
        : undefined;

    return {
      intent,
      confidence,
      assumptions,
      nutrition,
      exercise,
    };
  } catch {
    return {
      intent: "nutrition",
      confidence: "low",
      assumptions: [],
      nutrition: {
        calories: null,
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        notes: "",
      },
    };
  }
}

export async function generateNutritionDailyReport(
  input: NutritionDailyReportInput,
  usageContext?: GeminiUsageContext
): Promise<NutritionDailyReportResult> {
  const focusPrompt = (input.focusPrompt ?? "").trim().slice(0, 600);
  const model = getModel();
  const result = await model.generateContent(
    `You are a practical nutrition and exercise coach.

Given one day of tracked data and daily goals, return a short, simple report with helpful guidance for tomorrow.

Rules:
- Use plain language.
- Be supportive but honest.
- Do not provide medical diagnosis or medical claims.
- Keep it practical and specific.
- Mention both nutrition intake and exercise impact when relevant.
- Tips should be actionable tomorrow and realistic.

Return ONLY valid JSON with exactly this shape:
{
  "summary": "2-4 short sentences",
  "goalStatus": "1-2 concise sentences comparing today's totals to goals",
  "highlights": ["bullet point", "..."],
  "tomorrowTips": ["tip 1", "tip 2", "tip 3"]
}

Constraints:
- highlights: 2 to 4 items
- tomorrowTips: 3 to 5 items
- each tip should be 1 sentence

DAY CONTEXT:
- Day label: ${input.dayLabel}
- Focus request: ${focusPrompt || "(none)"}

GOALS:
- Calories target: ${input.goals.caloriesTarget} kcal
- Carbs target: ${input.goals.carbsTargetGrams} g
- Protein target: ${input.goals.proteinTargetGrams} g
- Fat target: ${input.goals.fatTargetGrams} g

TODAY TOTALS:
- Calories from food: ${input.totals.caloriesFood} kcal
- Calories burned from exercise: ${input.totals.caloriesExercise} kcal
- Calories remaining vs goal: ${input.totals.caloriesRemaining} kcal
- Carbs: ${input.totals.carbsGrams} g
- Protein: ${input.totals.proteinGrams} g
- Fat: ${input.totals.fatGrams} g`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      summary?: unknown;
      goalStatus?: unknown;
      highlights?: unknown;
      tomorrowTips?: unknown;
    };
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const tomorrowTips = Array.isArray(parsed.tomorrowTips)
      ? parsed.tomorrowTips
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "You logged your day, and this gives us a solid baseline for tomorrow.",
      goalStatus:
        typeof parsed.goalStatus === "string" && parsed.goalStatus.trim()
          ? parsed.goalStatus.trim()
          : "Your intake and exercise are now mapped against your goals.",
      highlights:
        highlights.length > 0
          ? highlights
          : [
              `Calories logged: ${input.totals.caloriesFood} kcal`,
              `Exercise burn logged: ${input.totals.caloriesExercise} kcal`,
            ],
      tomorrowTips:
        tomorrowTips.length > 0
          ? tomorrowTips
          : [
              "Plan your main meals early so your calorie target is easier to hit.",
              "Prioritize protein at each meal to support satiety and recovery.",
              "Add one short workout or walk to improve your calorie balance tomorrow.",
            ],
    };
  } catch {
    return {
      summary: "I analyzed your nutrition and exercise logs for the day.",
      goalStatus: "You can use this snapshot to make a clearer plan for tomorrow.",
      highlights: [
        `Calories logged: ${input.totals.caloriesFood} kcal`,
        `Exercise burn logged: ${input.totals.caloriesExercise} kcal`,
      ],
      tomorrowTips: [
        "Pre-plan meals and snacks so your calorie total is intentional.",
        "Target protein early in the day to stay on track with macros.",
        "Schedule a realistic workout block before your day gets busy.",
      ],
    };
  }
}

export async function generateNutritionGoalGuidance(
  input: NutritionGoalGuidanceInput,
  usageContext?: GeminiUsageContext
): Promise<NutritionGoalGuidanceResult> {
  const model = getModel();
  const rowsBlock = input.dailyRows
    .slice(0, 7)
    .map(
      (row) =>
        `${row.dayKey}: food ${row.caloriesFood} kcal, exercise burn ${row.caloriesExercise} kcal, carbs ${row.carbsGrams}g, protein ${row.proteinGrams}g, fat ${row.fatGrams}g, food entries ${row.foodEntries}, exercise entries ${row.exerciseEntries}`
    )
    .join("\n");

  const result = await model.generateContent(
    `You are a practical nutrition accountability coach.

Given a user's weekly nutrition/exercise data and their own goal statement, provide clear, supportive guidance.

Return ONLY valid JSON with exactly:
{
  "summary": "2-4 concise sentences",
  "badPatterns": ["pattern 1", "pattern 2", "..."],
  "keepInMind": ["thing to remember 1", "..."],
  "onTrackNuggets": ["small practical nugget 1", "..."]
}

Rules:
- Be specific to the supplied numbers and trend.
- Identify likely unhelpful patterns (macro imbalance, calorie inconsistency, missing protein distribution, under-logging, etc) without shaming.
- Keep advice behavior-focused and realistic.
- Do not provide medical diagnosis.
- badPatterns: 2-5 items
- keepInMind: 3-6 items
- onTrackNuggets: 3-6 items

USER GOAL (natural language):
${input.userGoalIntent || "(not provided)"}

PERIOD:
${input.periodLabel}

TARGETS (per day):
- Calories: ${input.goals.caloriesTargetPerDay} kcal
- Carbs: ${input.goals.carbsTargetGrams} g
- Protein: ${input.goals.proteinTargetGrams} g
- Fat: ${input.goals.fatTargetGrams} g

WEEKLY TOTALS:
- Calories from food: ${input.weeklyTotals.caloriesFood} kcal
- Calories burned from exercise: ${input.weeklyTotals.caloriesExercise} kcal
- Carbs: ${input.weeklyTotals.carbsGrams} g
- Protein: ${input.weeklyTotals.proteinGrams} g
- Fat: ${input.weeklyTotals.fatGrams} g
- Tracked days: ${input.weeklyTotals.trackedDays}
- Food entries: ${input.weeklyTotals.foodEntries}
- Exercise entries: ${input.weeklyTotals.exerciseEntries}

DAILY BREAKDOWN:
${rowsBlock || "(no daily rows)"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      summary?: unknown;
      badPatterns?: unknown;
      keepInMind?: unknown;
      onTrackNuggets?: unknown;
    };
    const toList = (value: unknown, max: number): string[] =>
      Array.isArray(value)
        ? value
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)
            .slice(0, max)
        : [];
    const badPatterns = toList(parsed.badPatterns, 5);
    const keepInMind = toList(parsed.keepInMind, 6);
    const onTrackNuggets = toList(parsed.onTrackNuggets, 6);
    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "Your weekly logs show useful patterns we can use to keep you closer to your goal.",
      badPatterns:
        badPatterns.length > 0
          ? badPatterns
          : ["Inconsistent day-to-day intake is making progress harder to measure."],
      keepInMind:
        keepInMind.length > 0
          ? keepInMind
          : [
              "Aim for consistency first, then precision.",
              "Spread protein across meals to improve satiety and recovery.",
              "Use planned snacks to reduce reactive eating.",
            ],
      onTrackNuggets:
        onTrackNuggets.length > 0
          ? onTrackNuggets
          : [
              "Pre-log your first meal each day.",
              "Set a protein floor for breakfast.",
              "Plan one fallback meal for busy days.",
            ],
    };
  } catch {
    return {
      summary: "Your weekly nutrition data gives a strong baseline for better consistency next week.",
      badPatterns: ["Energy and macro intake appear uneven across days."],
      keepInMind: [
        "Consistency beats perfection.",
        "Prioritize protein and total calories before fine-tuning.",
        "Keep logging even on imperfect days.",
      ],
      onTrackNuggets: [
        "Pre-plan one high-protein meal daily.",
        "Decide your snack limit before the day starts.",
        "Schedule workouts at a fixed time block.",
      ],
    };
  }
}

export async function generateWeeklyJournalReflection(
  input: WeeklyJournalReflectionInput,
  usageContext?: GeminiUsageContext
): Promise<WeeklyJournalReflectionResult> {
  const journals = input.journalEntries
    .slice(0, 24)
    .map((entry, idx) => `${idx + 1}. [${entry.dayKey}] ${entry.text.slice(0, 500)}`)
    .join("\n");
  const mentorLines = input.followedMentorReflections
    .slice(0, 24)
    .map((entry, idx) => `${idx + 1}. [${entry.dayKey}] ${entry.figureName}: ${entry.reflection.slice(0, 240)}`)
    .join("\n");
  const model = getModel();
  const result = await model.generateContent(
    `You are a compassionate weekly reflection coach.

You will summarize a user's weekly journal entries and provide practical reflection guidance.

Return ONLY valid JSON with exactly this shape:
{
  "summary": "2-4 short sentences",
  "emotionPatterns": ["pattern 1", "pattern 2", "..."],
  "behaviorPatterns": ["pattern 1", "pattern 2", "..."],
  "mentorInsights": ["insight 1", "..."],
  "nextWeekActions": ["action 1", "action 2", "action 3"]
}

Rules:
- Be specific to the provided entries.
- Do not provide medical diagnosis or treatment.
- Keep tone supportive and practical.
- emotionPatterns: 2-4 items.
- behaviorPatterns: 2-4 items.
- mentorInsights: 1-3 items (if no mentor content, return a neutral encouragement item).
- nextWeekActions: 3-5 concrete actions.

WEEK:
${input.weekLabel}

HEURISTIC SIGNALS:
- Emotions: ${input.emotionSignals.length ? input.emotionSignals.join(", ") : "none detected"}
- Behaviors: ${input.behaviorSignals.length ? input.behaviorSignals.join(", ") : "none detected"}

JOURNAL ENTRIES:
${journals || "(no entries this week)"}

FOLLOWED MENTOR REFLECTIONS:
${mentorLines || "(none available)"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const defaultResult: WeeklyJournalReflectionResult = {
    summary:
      input.journalEntries.length > 0
        ? "You showed up this week, and your entries reveal meaningful patterns you can build on."
        : "You had a lighter journaling week, which is okay. A brief weekly check-in can still keep you connected to your goals.",
    emotionPatterns:
      input.emotionSignals.length > 0
        ? input.emotionSignals.slice(0, 3)
        : ["Your emotional pattern is not clear from this week, which can happen with fewer entries."],
    behaviorPatterns:
      input.behaviorSignals.length > 0
        ? input.behaviorSignals.slice(0, 3)
        : ["Your behavior pattern appears mixed; a small consistent routine can help next week."],
    mentorInsights:
      input.followedMentorReflections.length > 0
        ? input.followedMentorReflections.slice(0, 2).map((item) => `${item.figureName}: ${item.reflection}`)
        : ["No followed mentor reflections were available this week, so focus on one small reflection habit."],
    nextWeekActions: [
      "Set aside 5 minutes on three days to journal one key emotion and one behavior.",
      "Pick one repeatable action you can do every morning or evening.",
      "Review your entries on Sunday and identify one thing to continue and one thing to change.",
    ],
  };
  try {
    const parsed = JSON.parse(cleaned) as {
      summary?: unknown;
      emotionPatterns?: unknown;
      behaviorPatterns?: unknown;
      mentorInsights?: unknown;
      nextWeekActions?: unknown;
    };
    const toStringArray = (value: unknown, max: number): string[] =>
      Array.isArray(value)
        ? value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, max)
        : [];
    const emotionPatterns = toStringArray(parsed.emotionPatterns, 4);
    const behaviorPatterns = toStringArray(parsed.behaviorPatterns, 4);
    const mentorInsights = toStringArray(parsed.mentorInsights, 3);
    const nextWeekActions = toStringArray(parsed.nextWeekActions, 5);
    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : defaultResult.summary,
      emotionPatterns: emotionPatterns.length > 0 ? emotionPatterns : defaultResult.emotionPatterns,
      behaviorPatterns: behaviorPatterns.length > 0 ? behaviorPatterns : defaultResult.behaviorPatterns,
      mentorInsights: mentorInsights.length > 0 ? mentorInsights : defaultResult.mentorInsights,
      nextWeekActions: nextWeekActions.length > 0 ? nextWeekActions : defaultResult.nextWeekActions,
    };
  } catch {
    return defaultResult;
  }
}

export async function completeExerciseFuelEstimate(
  inputText: string,
  clarificationAnswers: string[],
  currentExercise: {
    caloriesBurned: number | null;
    carbsUsedGrams?: number | null;
    fatUsedGrams?: number | null;
    proteinDeltaGrams?: number | null;
    notes?: string;
  },
  usageContext?: GeminiUsageContext
): Promise<{
  carbsUsedGrams: number | null;
  fatUsedGrams: number | null;
  proteinDeltaGrams: number | null;
}> {
  const text = inputText.trim().slice(0, 8_000);
  const answers = clarificationAnswers
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 2);
  const model = getModel();
  const result = await model.generateContent(
    `You estimate exercise fuel breakdown for a workout log.

Given the user context and an existing calories-burned estimate, return best-effort numeric estimates for:
- carbsUsedGrams
- fatUsedGrams
- proteinDeltaGrams (negative if net protein breakdown)

Rules:
- Return numbers (not strings) when possible.
- Keep values plausible for the activity intensity and duration.
- If truly not inferable, return null.
- Do not include markdown or extra text.

Return ONLY valid JSON:
{
  "carbsUsedGrams": number | null,
  "fatUsedGrams": number | null,
  "proteinDeltaGrams": number | null
}

Original input:
${text}

Clarification answers:
${answers.length ? answers.map((a, i) => `${i + 1}. ${a}`).join("\n") : "(none)"}

Existing exercise estimate:
- Calories burned: ${currentExercise.caloriesBurned ?? "unknown"} kcal
- Carbs used: ${currentExercise.carbsUsedGrams ?? "unknown"} g
- Fat used: ${currentExercise.fatUsedGrams ?? "unknown"} g
- Protein delta: ${currentExercise.proteinDeltaGrams ?? "unknown"} g
- Notes: ${(currentExercise.notes ?? "").trim() || "none"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      carbsUsedGrams?: unknown;
      fatUsedGrams?: unknown;
      proteinDeltaGrams?: unknown;
    };
    return {
      carbsUsedGrams: toFiniteNumberOrNull(parsed.carbsUsedGrams),
      fatUsedGrams: toFiniteNumberOrNull(parsed.fatUsedGrams),
      proteinDeltaGrams: toFiniteNumberOrNull(parsed.proteinDeltaGrams),
    };
  } catch {
    return { carbsUsedGrams: null, fatUsedGrams: null, proteinDeltaGrams: null };
  }
}

export async function calculateNutritionGoalsFromProfile(
  input: NutritionGoalsProfileInput,
  usageContext?: GeminiUsageContext
): Promise<NutritionGoalsResult> {
  const model = getModel();
  const result = await model.generateContent(
    `You are a practical nutrition goal planner.

Given a user profile and goal, calculate a realistic daily calorie target and macro split.

Return ONLY valid JSON with exactly this shape:
{
  "caloriesTarget": number,
  "carbsPercent": number,
  "proteinPercent": number,
  "fatPercent": number,
  "carbsGrams": number,
  "proteinGrams": number,
  "fatGrams": number,
  "rationale": "short explanation"
}

Rules:
- Percentages should sum close to 100.
- Grams must be coherent with calories and percentages.
- Use realistic values for the declared goal and pace.
- Keep rationale to 1-2 concise sentences.
- No markdown or extra text.

Profile:
- Age: ${Math.round(input.age)}
- Gender: ${input.gender}
- Height: ${input.heightCm} cm
- Current weight: ${input.currentWeightKg} kg
- Target weight: ${input.targetWeightKg} kg
- Goal: ${input.goal}
- Pace: ${input.pace}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      caloriesTarget?: unknown;
      carbsPercent?: unknown;
      proteinPercent?: unknown;
      fatPercent?: unknown;
      carbsGrams?: unknown;
      proteinGrams?: unknown;
      fatGrams?: unknown;
      rationale?: unknown;
    };
    return {
      caloriesTarget: toFiniteNumberOrNull(parsed.caloriesTarget),
      carbsPercent: toFiniteNumberOrNull(parsed.carbsPercent),
      proteinPercent: toFiniteNumberOrNull(parsed.proteinPercent),
      fatPercent: toFiniteNumberOrNull(parsed.fatPercent),
      carbsGrams: toFiniteNumberOrNull(parsed.carbsGrams),
      proteinGrams: toFiniteNumberOrNull(parsed.proteinGrams),
      fatGrams: toFiniteNumberOrNull(parsed.fatGrams),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 280) : "",
    };
  } catch {
    return {
      caloriesTarget: null,
      carbsPercent: null,
      proteinPercent: null,
      fatPercent: null,
      carbsGrams: null,
      proteinGrams: null,
      fatGrams: null,
      rationale: "",
    };
  }
}

export async function recalculateNutritionGoalsFromPercentages(
  input: {
    caloriesTarget: number;
    carbsPercent: number;
    proteinPercent: number;
    fatPercent: number;
  },
  usageContext?: GeminiUsageContext
): Promise<NutritionGoalsResult> {
  const model = getModel();
  const result = await model.generateContent(
    `You normalize macro percentages and compute macro grams for a fixed calorie target.

Return ONLY valid JSON with exactly this shape:
{
  "caloriesTarget": number,
  "carbsPercent": number,
  "proteinPercent": number,
  "fatPercent": number,
  "carbsGrams": number,
  "proteinGrams": number,
  "fatGrams": number,
  "rationale": "short explanation"
}

Rules:
- Keep caloriesTarget exactly the same as input.
- Normalize percentages so they sum to 100 if needed.
- Grams should match calories + percentages.
- No markdown or extra text.

Input:
- Calories target: ${input.caloriesTarget}
- Carbs: ${input.carbsPercent}%
- Protein: ${input.proteinPercent}%
- Fat: ${input.fatPercent}%`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      caloriesTarget?: unknown;
      carbsPercent?: unknown;
      proteinPercent?: unknown;
      fatPercent?: unknown;
      carbsGrams?: unknown;
      proteinGrams?: unknown;
      fatGrams?: unknown;
      rationale?: unknown;
    };
    return {
      caloriesTarget: toFiniteNumberOrNull(parsed.caloriesTarget),
      carbsPercent: toFiniteNumberOrNull(parsed.carbsPercent),
      proteinPercent: toFiniteNumberOrNull(parsed.proteinPercent),
      fatPercent: toFiniteNumberOrNull(parsed.fatPercent),
      carbsGrams: toFiniteNumberOrNull(parsed.carbsGrams),
      proteinGrams: toFiniteNumberOrNull(parsed.proteinGrams),
      fatGrams: toFiniteNumberOrNull(parsed.fatGrams),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 280) : "",
    };
  } catch {
    return {
      caloriesTarget: null,
      carbsPercent: null,
      proteinPercent: null,
      fatPercent: null,
      carbsGrams: null,
      proteinGrams: null,
      fatGrams: null,
      rationale: "",
    };
  }
}

export async function generateConceptFromUserInput(
  userInput: string,
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ title: string; summary: string; enrichmentPrompt: string }> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the title, summary, and enrichmentPrompt in ${languageName}.`
      : "";
  const model = getModel();
  const result = await model.generateContent(
    `You are creating a custom concept from what the user wants to remember. Return a JSON object with exactly three keys:
- "title": A short 3-6 word title for the concept.
- "summary": A 2-4 paragraph narrative that expands on the user's idea. Capture key aspects, context, and why it matters to them.
- "enrichmentPrompt": A 1-2 sentence summary for the AI coach to use as context. State the core idea clearly, then when it's relevant (e.g., "Relevant when user is overwhelmed, prioritizing, or optimizing."). 25-40 words. Written so the AI can quickly match this concept to user dilemmas. Example: "Prioritize the 20% of efforts that yield 80% of results. Relevant when user is overwhelmed, struggling with priorities, or optimizing for impact."
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

User wants to remember:
${userInput}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    title?: string;
    summary?: string;
    enrichmentPrompt?: string;
  };
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    title: parsed.title ?? "Custom concept",
    summary: parsed.summary ?? "",
    enrichmentPrompt: parsed.enrichmentPrompt ?? "",
  };
}

const HABIT_BUCKET_PROMPTS: Record<HabitBucket, string> = {
  creative:
    "Creative: expressive practices such as art, music, writing, or making. Frame the habit as something the user can do regularly to nurture creativity and expression.",
  intellectual:
    "Intellectual: learning, reading, curiosity, travel-as-growth, or structured inquiry. Frame the habit as feeding the mind and exploration.",
  wellbeing:
    "Well-being: physical and mental care—movement, rest, mindfulness, sports, energy, and sustainable routines. Frame the habit as supporting health and balance.",
  connection:
    "Connection: relationships, community, rituals with others, shared meals, clubs, or social presence. Frame the habit as strengthening bonds and belonging.",
};

export async function generateHabitFromConceptOrLtm(
  source: { type: "concept" | "ltm"; title: string; summary: string; enrichmentPrompt: string },
  languageName?: string,
  usageContext?: GeminiUsageContext,
  bucket?: HabitBucket
): Promise<{ name: string; description: string; howToFollowThrough: string; tips: string }> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all content in ${languageName}.`
      : "";
  const bucketBlock = bucket
    ? `

The user chose this life-area for the habit (stay aligned with it; examples are illustrative):
- ${HABIT_BUCKET_PROMPTS[bucket]}`
    : "";
  const model = getModel();
  const result = await model.generateContent(
    `You are converting a concept or memory into a daily habit the user can practice. Return a JSON object with exactly four keys:
- "name": A short 2-5 word name for the habit (e.g. "Morning reflection", "Pause before reacting").
- "description": A 2-4 sentence description of what this habit is and why it matters for daily life.
- "howToFollowThrough": Step-by-step instructions for how to practice this habit. Use newline-separated bullet points (one step per line).
- "tips": Practical tips for sticking with it, avoiding pitfalls, or integrating into daily routine. Use newline-separated bullet points (one tip per line).
${languageInstruction}${bucketBlock}

Return ONLY valid JSON, no markdown or extra text.

Source (concept or memory):
Title: ${source.title}
Summary: ${source.summary}
Enrichment: ${source.enrichmentPrompt}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    name?: string;
    description?: string;
    howToFollowThrough?: string;
    tips?: string;
  };
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    name: parsed.name ?? "Daily habit",
    description: parsed.description ?? "",
    howToFollowThrough: parsed.howToFollowThrough ?? "",
    tips: parsed.tips ?? "",
  };
}

/** Expand a short manual draft into a full habit; refines name/description and generates steps and tips. */
export async function generateHabitFromManualDraft(
  input: { bucket: HabitBucket; name: string; description: string },
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ name: string; description: string; howToFollowThrough: string; tips: string }> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all content in ${languageName}.`
      : "";
  const bucketBlock = `

Life area for this habit (stay aligned):
- ${HABIT_BUCKET_PROMPTS[input.bucket]}`;
  const model = getModel();
  const result = await model.generateContent(
    `The user wants to practice a daily habit. They provided a working title and description (the description may be rough or brief).

Your task — return a JSON object with exactly four keys:
- "name": A clear, concise habit name (2-5 words). Refine their title if needed for clarity; keep their intent.
- "description": A polished 2-4 sentence description of what this habit is and why it matters—clearer and more concrete than their draft, without changing their underlying intent.
- "howToFollowThrough": Step-by-step instructions for practicing the habit. Use newline-separated lines (one step per line), like bullet points without bullets.
- "tips": Practical tips for sticking with it, avoiding pitfalls, or fitting it into daily life. Newline-separated lines (one tip per line).

User's working title: ${input.name.trim()}
User's description:
${input.description.trim()}
${languageInstruction}${bucketBlock}

Return ONLY valid JSON, no markdown or extra text.`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    name?: string;
    description?: string;
    howToFollowThrough?: string;
    tips?: string;
  };
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    name: parsed.name?.trim() || input.name.trim() || "Daily habit",
    description: parsed.description?.trim() || input.description.trim(),
    howToFollowThrough: parsed.howToFollowThrough ?? "",
    tips: parsed.tips ?? "",
  };
}

/** Generated mental model (id will be assigned server-side as custom_<hex>). */
export interface GeneratedMentalModel {
  name: string;
  quick_introduction: string;
  in_more_detail: string;
  why_this_is_important: string;
  when_to_use: string[];
  how_can_you_spot_it: Record<string, string>;
  examples: Record<string, string>;
  real_world_implications: string | Record<string, string>;
  professional_application: Record<string, string>;
  how_can_this_be_misapplied: Record<string, string>;
  related_content: string[];
  one_liner?: string;
  try_this?: string[];
  ask_yourself?: string[];
}

export async function generateMentalModelFromUserInput(
  userInput: string,
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<GeneratedMentalModel> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all content in ${languageName}.`
      : "";
  const model = getModel();
  const result = await model.generateContent(
    `You are creating a mental model or cognitive bias from the user's description. Return a JSON object matching the mental model schema. Include "custom" in when_to_use so it appears in the Custom category. Use snake_case for object keys (e.g. how_can_you_spot_it, professional_application).

Required keys:
- name: Human-readable name
- quick_introduction: Brief intro (2-4 sentences)
- in_more_detail: Deeper explanation (2-3 paragraphs)
- why_this_is_important: Why it matters
- when_to_use: Array including "custom" plus relevant tags (e.g. ["custom", "decision-making", "risk_assessment"])
- how_can_you_spot_it: Object with 2-4 keys, each value a short paragraph
- examples: Object with 2-4 keys (e.g. investing, career), each value a short paragraph
- real_world_implications: String or object with subsections
- professional_application: Object with 2-3 keys, each value a short paragraph
- how_can_this_be_misapplied: Object with 2-3 keys, each value a short paragraph
- related_content: Array of related mental model ids (can be empty [])

Optional keys:
- one_liner: Memorable short phrase
- try_this: Array of 2-3 actionable prompts
- ask_yourself: Array of reflection questions
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

User description:
${userInput}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const ensureArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x ?? "")).filter(Boolean) : [];
  const ensureString = (v: unknown): string => (typeof v === "string" ? v : "") || "";
  const ensureRecord = (v: unknown): Record<string, string> => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, typeof val === "string" ? val : String(val ?? "")])
      );
    }
    return {};
  };
  const whenToUse = ensureArray(parsed.when_to_use);
  if (!whenToUse.includes("custom")) whenToUse.unshift("custom");
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return {
    name: ensureString(parsed.name) || "Custom mental model",
    quick_introduction: ensureString(parsed.quick_introduction),
    in_more_detail: ensureString(parsed.in_more_detail),
    why_this_is_important: ensureString(parsed.why_this_is_important),
    when_to_use: whenToUse,
    how_can_you_spot_it: ensureRecord(parsed.how_can_you_spot_it),
    examples: ensureRecord(parsed.examples),
    real_world_implications:
      typeof parsed.real_world_implications === "string"
        ? parsed.real_world_implications
        : ensureRecord(parsed.real_world_implications),
    professional_application: ensureRecord(parsed.professional_application),
    how_can_this_be_misapplied: ensureRecord(parsed.how_can_this_be_misapplied),
    related_content: ensureArray(parsed.related_content),
    one_liner: typeof parsed.one_liner === "string" ? parsed.one_liner : undefined,
    try_this: Array.isArray(parsed.try_this) ? parsed.try_this.map(String) : undefined,
    ask_yourself: Array.isArray(parsed.ask_yourself) ? parsed.ask_yourself.map(String) : undefined,
  };
}

/** Generated perspective card from a user topic. */
export interface GeneratedPerspectiveCard {
  name: string;
  prompt: string;
  follow_ups: string[];
}

export async function generatePerspectiveCardFromTopic(
  topic: string,
  languageName?: string
): Promise<GeneratedPerspectiveCard> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the name, prompt, and follow_ups in ${languageName}.`
      : "";
  const model = getModel();
  const result = await model.generateContent(
    `You are creating a perspective card—a lens designed to shift how someone looks at something. Perspective cards invite the user to see differently, ask unexpected questions, or notice what they might have missed. They are used in "Ways of Looking At" to spark reflective conversations.

Given the user's topic, create ONE perspective card that would help them explore it through a fresh lens. The card should invite curiosity and discovery, not lecture or summarize.

Return a JSON object with exactly three keys:
- "name": A short, evocative title (2-4 words). Examples: "Souvenir", "In black and white", "Give it a voice", "From the edges"
- "prompt": 2-4 sentences that invite the user to look at their topic through a specific lens. Use second person ("you"). Be concrete and actionable. The prompt should open up discovery, not close it down.
- "follow_ups": An array of 3-5 follow-up questions that deepen the exploration. Each should be a complete question. Examples: "What would you choose to carry over?", "What disappears when you remove color?", "Where does your eye go first?"
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

User's topic:
${topic}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { name?: string; prompt?: string; follow_ups?: string[] };
  const followUps = Array.isArray(parsed.follow_ups) ? parsed.follow_ups.filter((q): q is string => typeof q === "string") : [];
  return {
    name: typeof parsed.name === "string" ? parsed.name : "New lens",
    prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
    follow_ups: followUps.length > 0 ? followUps : ["What comes to mind?", "What would you notice?", "How does this shift your view?"],
  };
}

export async function generateDomainQuestions(
  domain: string,
  languageName?: string
): Promise<{ questions: string[]; suggestedAnswers: string[] }> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the questions and suggested answers in ${languageName}.`
      : "";
  const model = getModel();
  const result = await model.generateContent(
    `Given the domain or goal "${domain}", generate 3-5 questions to understand the user's specific goals, context, and priorities. For each question, also provide a plausible suggested answer that a typical user might give. The user can edit or remove these. These will be used to create tailored custom concepts.
${languageInstruction}

Return a JSON object with exactly two keys:
- "questions": An array of 3-5 question strings. Each question should be clear, specific, and relevant to the domain.
- "suggestedAnswers": An array of suggested answers (same length and order as questions). Each should be 1-2 sentences, plausible for a typical user in this domain.

Return ONLY valid JSON, no markdown or extra text.
Example: {"questions":["What is your primary goal?","What is your timeline?"],"suggestedAnswers":["Long-term growth over 10+ years","5-7 years"]}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { questions?: string[]; suggestedAnswers?: string[] };
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const suggestedAnswers = Array.isArray(parsed.suggestedAnswers) ? parsed.suggestedAnswers : [];
  return {
    questions,
    suggestedAnswers: questions.map((_, i) => suggestedAnswers[i] ?? ""),
  };
}

export type ConceptExtractionSource = "youtube_transcript" | "journal";

export type ChunkProgressInfo = { pass: number; total: number };

export type GenerateConceptsFromLongTextOptions = {
  source: ConceptExtractionSource;
  /** e.g. video title or journal entry title */
  displayTitle?: string;
  /** e.g. YouTube channel (ignored for journal) */
  displaySubtitle?: string;
  languageName?: string;
  extractPrompt?: string;
  usageContext?: GeminiUsageContext;
  /** Called before each Gemini pass when text is split into multiple chunks */
  onChunkProgress?: (info: ChunkProgressInfo) => void;
};

type ConceptGroupRow = {
  domain: string;
  concepts: { title: string; summary: string; enrichmentPrompt: string }[];
};

const CONCEPT_EXTRACTION_GENERATION_CONFIG = {
  maxOutputTokens: 16384,
  temperature: 0.35,
} as const;

/** Split long text into overlapping chunks for multiple extraction passes */
function chunkTextForExtraction(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const t = text;
  if (t.length <= chunkSize) return [t];
  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + chunkSize, t.length);
    out.push(t.slice(start, end));
    if (end >= t.length) break;
    start = Math.max(0, end - overlap);
  }
  return out;
}

function parseConceptGroupsResponse(rawResponse: string): ConceptGroupRow[] {
  const text = rawResponse.trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    groups?: { domain?: string; concepts?: { title?: string; summary?: string; enrichmentPrompt?: string }[] }[];
  };
  const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
  return rawGroups
    .filter((g) => g && (g.domain || (g.concepts && g.concepts.length > 0)))
    .map((g) => ({
      domain: (g.domain ?? "General").trim() || "General",
      concepts: (Array.isArray(g.concepts) ? g.concepts : [])
        .filter((c) => c && (c.title || c.summary || c.enrichmentPrompt))
        .map((c) => ({
          title: (c.title ?? "Concept").trim() || "Concept",
          summary: (c.summary ?? "").trim(),
          enrichmentPrompt: (c.enrichmentPrompt ?? "").trim(),
        }))
        .filter((c) => c.summary || c.enrichmentPrompt),
    }))
    .filter((g) => g.concepts.length > 0);
}

/** Merge chunk results: same domain (case-insensitive), dedupe concepts by title */
function mergeConceptGroupsFromChunks(chunks: ConceptGroupRow[][]): ConceptGroupRow[] {
  const flat = chunks.flat();
  const map = new Map<string, { domain: string; concepts: ConceptGroupRow["concepts"] }>();
  const domainKey = (d: string) =>
    d.trim().toLowerCase().replace(/\s+/g, " ") || "general";
  for (const g of flat) {
    const key = domainKey(g.domain || "General");
    const display = (g.domain || "General").trim() || "General";
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { domain: display, concepts: [...g.concepts] });
    } else {
      cur.concepts.push(...g.concepts);
    }
  }
  const out: ConceptGroupRow[] = [];
  for (const { domain, concepts } of map.values()) {
    const seenTitles = new Set<string>();
    const unique = concepts.filter((c) => {
      const k = c.title.trim().toLowerCase();
      if (!k || seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    });
    if (unique.length) out.push({ domain, concepts: unique });
  }
  return out;
}

function buildConceptExtractionPrompt(
  source: ConceptExtractionSource,
  bodyText: string,
  options: {
    displayTitle?: string;
    displaySubtitle?: string;
    partIndex: number;
    partCount: number;
    languageInstruction: string;
    userExtractionInstruction: string;
  }
): string {
  const {
    displayTitle,
    displaySubtitle,
    partIndex,
    partCount,
    languageInstruction,
    userExtractionInstruction,
  } = options;

  const multiPartNote =
    partCount > 1
      ? `\n\nIMPORTANT: The full ${source === "youtube_transcript" ? "transcript" : "text"} was split for processing. Below is ONLY part ${partIndex} of ${partCount}. Extract every substantive idea that appears in THIS segment only — do not invent content from other parts.`
      : "";

  const contextLines: string[] = [];
  if (source === "youtube_transcript") {
    if (displayTitle) contextLines.push(`Video title: ${displayTitle}`);
    if (displaySubtitle) contextLines.push(`Channel: ${displaySubtitle}`);
    contextLines.push("Transcript:", bodyText);
  } else {
    if (displayTitle) contextLines.push(`Journal entry title: ${displayTitle}`);
    contextLines.push("Journal text:", bodyText);
  }
  const context = contextLines.join("\n\n");

  const coverageInstruction =
    source === "youtube_transcript"
      ? `Extract every distinct, substantive concept from the ${partCount > 1 ? "transcript segment" : "transcript"}: frameworks, mental models, definitions, tactics, arguments, causes, warnings, stories-with-a-moral, and insights worth revisiting. There is NO maximum count — be exhaustive for this ${partCount > 1 ? "segment" : "video"}. Dense or long-form talks may yield many concepts. Skip only filler, greetings, and pure repetition.`
      : `Extract every distinct, substantive concept from the ${partCount > 1 ? "text segment" : "journal text"}: values, insights, patterns, commitments, and ideas worth revisiting. There is NO maximum count — be thorough. Paraphrase and generalize; do not copy long verbatim quotes. Respect privacy.`;

  const sourceIntro =
    source === "youtube_transcript"
      ? `You are extracting clear, reusable concepts from a YouTube video transcript. The user wants to save these as custom concepts for future AI conversations.

${context}
${multiPartNote}

${coverageInstruction}`
      : `You are extracting clear, reusable concepts from the user's personal journal or reflective writing. The user wants to save these as custom concepts (and group them into frameworks/domains) for future AI conversations.

${context}
${multiPartNote}

${coverageInstruction}`;

  return `${sourceIntro}
${languageInstruction}${userExtractionInstruction}

Auto-tag each concept into a domain/framework (e.g. "Psychology", "Productivity", "Finance", "Career", "Health", "Learning", "Relationships"). Use specific domains when they fit; split into multiple domains rather than overloading one bucket.

Return a JSON object with exactly one key:
- "groups": An array of objects, each with:
  - "domain": A short domain name (2-5 words). Group concepts by domain/framework.
  - "concepts": An array of objects, each with:
    - "title": Short 3-8 word title
    - "summary": 2-4 paragraph narrative
    - "enrichmentPrompt": 1-2 sentence summary for the AI coach. State the core idea, then when it's relevant (e.g. "Relevant when user is X, Y, or Z."). 25-40 words. Written so the AI can match this concept to user dilemmas.

If a concept doesn't fit a clear domain, use "General" or infer from context. Within this response, merge domains that are very similar (e.g. "Psychology" and "Behavioral Science" → "Psychology").

Return ONLY valid JSON, no markdown or extra text.
Example: {"groups":[{"domain":"Psychology","concepts":[{"title":"...","summary":"...","enrichmentPrompt":"..."}]}]}`;
}

async function generateConceptsOnePass(
  prompt: string,
  usageContext?: GeminiUsageContext
): Promise<ConceptGroupRow[]> {
  const result = await getModel().generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: CONCEPT_EXTRACTION_GENERATION_CONFIG,
  });
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text().trim();
  return parseConceptGroupsResponse(text);
}

/**
 * Extract domain-tagged custom concepts from long text (YouTube transcript or journal).
 * Long input is processed in overlapping chunks; results are merged and deduplicated.
 * Same JSON schema for both sources.
 */
export async function generateConceptsFromLongText(
  rawText: string,
  options: GenerateConceptsFromLongTextOptions
): Promise<{
  groups: { domain: string; concepts: { title: string; summary: string; enrichmentPrompt: string }[] }[];
}> {
  const {
    source,
    displayTitle,
    displaySubtitle,
    languageName,
    extractPrompt,
    usageContext,
    onChunkProgress,
  } = options;

  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all concept titles, summaries, enrichmentPrompts, and domain names in ${languageName}.`
      : "";
  const userExtractionInstruction =
    extractPrompt && extractPrompt.trim()
      ? `\n\nUser's extraction focus: ${extractPrompt.trim()}\nPrioritize concepts that align with this, but still extract other important ideas from the text.`
      : "";

  let text = rawText.trim();
  if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
    text = text.slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
  }

  const chunks = chunkTextForExtraction(
    text,
    EXTRACT_CONCEPTS_CHUNK_CHARS,
    EXTRACT_CONCEPTS_CHUNK_OVERLAP_CHARS
  );
  const partCount = chunks.length;

  const groupsPerChunk: ConceptGroupRow[][] = [];
  for (let i = 0; i < chunks.length; i++) {
    onChunkProgress?.({ pass: i + 1, total: partCount });
    const prompt = buildConceptExtractionPrompt(source, chunks[i]!, {
      displayTitle,
      displaySubtitle,
      partIndex: i + 1,
      partCount,
      languageInstruction,
      userExtractionInstruction,
    });
    const groups = await generateConceptsOnePass(prompt, usageContext);
    groupsPerChunk.push(groups);
  }

  const merged =
    partCount <= 1
      ? groupsPerChunk[0] ?? []
      : mergeConceptGroupsFromChunks(groupsPerChunk);

  return { groups: merged };
}

/** @deprecated Prefer generateConceptsFromLongText with source: "youtube_transcript" */
export async function generateConceptsFromTranscript(
  transcriptText: string,
  videoTitle?: string,
  channel?: string,
  languageName?: string,
  extractPrompt?: string,
  usageContext?: GeminiUsageContext,
  onChunkProgress?: (info: ChunkProgressInfo) => void
): Promise<{
  groups: { domain: string; concepts: { title: string; summary: string; enrichmentPrompt: string }[] }[];
}> {
  return generateConceptsFromLongText(transcriptText, {
    source: "youtube_transcript",
    displayTitle: videoTitle,
    displaySubtitle: channel,
    languageName,
    extractPrompt,
    usageContext,
    onChunkProgress,
  });
}

export async function generateConceptsFromDomainAndAnswers(
  domain: string,
  answers: { question: string; answer: string }[],
  languageName?: string
): Promise<{ concepts: { title: string; summary: string; enrichmentPrompt: string }[] }> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all concept titles, summaries, and enrichmentPrompts in ${languageName}.`
      : "";
  const model = getModel();
  const qaText = answers
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const result = await model.generateContent(
    `You are creating custom concepts for the domain "${domain}" based on the user's answers.
${languageInstruction}

User's answers:
${qaText}

Create 3-6 custom concepts that capture the user's goals, context, and priorities in this domain. Each concept should be a distinct, useful piece of context for future conversations.

Return a JSON object with exactly one key:
- "concepts": An array of objects, each with exactly three keys:
  - "title": A short 3-6 word title
  - "summary": A 2-4 paragraph narrative
  - "enrichmentPrompt": 1-2 sentence summary for the AI coach. State the core idea, then when it's relevant (e.g., "Relevant when user is X, Y, or Z."). 25-40 words. Written so the AI can match this concept to user dilemmas.

Return ONLY valid JSON, no markdown or extra text.
Example: {"concepts":[{"title":"...","summary":"...","enrichmentPrompt":"..."}]}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    concepts?: { title?: string; summary?: string; enrichmentPrompt?: string }[];
  };
  const concepts = Array.isArray(parsed.concepts)
    ? parsed.concepts
        .filter((c) => c && (c.title || c.summary || c.enrichmentPrompt))
        .map((c) => ({
          title: c.title ?? "Concept",
          summary: c.summary ?? "",
          enrichmentPrompt: c.enrichmentPrompt ?? "",
        }))
    : [];
  return { concepts };
}

export interface SuggestGroupsResult {
  suggestedGroupIds: string[];
  suggestedNewGroupNames: string[];
}

/**
 * Suggest existing groups and new group names for a custom concept based on its content.
 */
export async function suggestGroupsForConcept(
  concept: { title: string; summary: string; enrichmentPrompt: string },
  existingGroups: { id: string; title: string }[]
): Promise<SuggestGroupsResult> {
  const model = getModel();
  const groupsText = existingGroups.length
    ? existingGroups.map((g) => `- id:${g.id} | title:"${g.title}"`).join("\n")
    : "(none)";

  const result = await model.generateContent(
    `You are suggesting concept groups for a custom concept. Based on the concept's content, suggest:
1. Which EXISTING groups (from the list below) this concept belongs to. Return their exact IDs.
2. Which NEW group names would fit this concept (2-4 word domain names, e.g. "Psychology", "Career Growth"). Suggest 0-4 new names.

CONCEPT:
Title: ${concept.title}
Summary: ${concept.summary}
Enrichment: ${concept.enrichmentPrompt}

EXISTING GROUPS:
${groupsText}

Return ONLY valid JSON, no markdown or extra text:
{"suggestedGroupIds":["id1","id2"],"suggestedNewGroupNames":["New Group Name 1","New Group Name 2"]}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      suggestedGroupIds?: string[];
      suggestedNewGroupNames?: string[];
    };
    const suggestedGroupIds = Array.isArray(parsed.suggestedGroupIds)
      ? parsed.suggestedGroupIds.filter((id): id is string => typeof id === "string")
      : [];
    const suggestedNewGroupNames = Array.isArray(parsed.suggestedNewGroupNames)
      ? parsed.suggestedNewGroupNames.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      : [];
    return { suggestedGroupIds, suggestedNewGroupNames };
  } catch {
    return { suggestedGroupIds: [], suggestedNewGroupNames: [] };
  }
}

/** Batch-translate titles for display (e.g. LTM, custom concepts, concept groups). Returns id -> translated title. */
export async function translateTitlesBatch(
  items: { id: string; title: string }[],
  targetLanguageName: string
): Promise<Record<string, string>> {
  if (items.length === 0) return {};
  const model = getModel();
  const list = items.map((i) => `${i.id}|${i.title}`).join("\n");
  const result = await model.generateContent(
    `Translate these titles into ${targetLanguageName}. Each line is "id|title". Return a JSON object mapping each id to its translated title. Preserve meaning; keep titles concise. Return ONLY valid JSON, no markdown.

Input:
${list}

Example output: {"id1":"Translated Title 1","id2":"Translated Title 2"}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const { id, title } of items) {
    out[id] = (parsed[id] ?? title).trim() || title;
  }
  return out;
}

export async function translateConcept(
  concept: { title: string; summary: string; enrichmentPrompt: string },
  targetLanguageName: string
): Promise<{ title: string; summary: string; enrichmentPrompt: string }> {
  const model = getModel();
  const result = await model.generateContent(
    `Translate this custom concept into ${targetLanguageName}. Preserve the structure and meaning. Return ONLY valid JSON with exactly three keys:
- "title": Translated title (short, 3-6 words)
- "summary": Translated summary (2-4 paragraphs)
- "enrichmentPrompt": Translated enrichment prompt (1-2 sentences)

Original:
Title: ${concept.title}
Summary: ${concept.summary}
Enrichment: ${concept.enrichmentPrompt}

Return ONLY valid JSON, no markdown or extra text.`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { title?: string; summary?: string; enrichmentPrompt?: string };
  return {
    title: parsed.title ?? concept.title,
    summary: parsed.summary ?? concept.summary,
    enrichmentPrompt: parsed.enrichmentPrompt ?? concept.enrichmentPrompt,
  };
}

import type { RelevantContextItem, RelevantContext } from "@/lib/chat-utils";

export type RelevantContextResult = RelevantContext;

/**
 * Predict which mental models, LTMs, custom concepts, and concept groups will be relevant
 * for responding to the user's message. Called BEFORE the main LLM response to:
 * 1) Enrich the prompt with only relevant context
 * 2) Show the user what context is being used (Gemini-style thinking overlay)
 */
export async function predictRelevantContext(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  mentalModels: { id: string; name: string; oneLiner: string }[],
  longTermMemories: { id: string; enrichmentPrompt: string; title?: string }[],
  customConcepts: { id: string; enrichmentPrompt: string; title?: string }[] = [],
  conceptGroups: { id: string; title: string; enrichmentPrompts: string[] }[] = [],
  usageContext?: GeminiUsageContext
): Promise<RelevantContextResult> {
  const historyText = conversationHistory
    .slice(-6)
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n\n");
  const modelsText = mentalModels
    .map((m) => `- id:${m.id} | name:"${m.name}" — ${m.oneLiner}`)
    .join("\n");
  const safeTitle = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);
  const ltmText = longTermMemories
    .map((l) => `- id:${l.id} | title:"${safeTitle(l.title ?? l.enrichmentPrompt)}" — ${l.enrichmentPrompt}`)
    .join("\n");
  const ccText = customConcepts
    .map((c) => `- id:${c.id} | title:"${safeTitle(c.title ?? c.enrichmentPrompt)}" — ${c.enrichmentPrompt}`)
    .join("\n");
  const cgText = conceptGroups
    .map((g) => `- id:${g.id} | title:"${g.title}" — ${g.enrichmentPrompts.join(" | ")}`)
    .join("\n");

  const nameToModelId = new Map(mentalModels.map((m) => [m.name.toLowerCase().trim(), m.id]));
  const titleToLtmId = new Map(longTermMemories.map((l) => [safeTitle(l.title ?? l.enrichmentPrompt), l.id]));
  const titleToCcId = new Map(customConcepts.map((c) => [safeTitle(c.title ?? c.enrichmentPrompt), c.id]));
  const titleToCgId = new Map(conceptGroups.map((g) => [g.title, g.id]));

  const prompt = `You are an AI context-selection engine for a decision-making coach. Your task is to predict which mental models, long-term memories, custom concepts, and concept groups will be MOST relevant to the user's current message based on the conversation history.

RULES:
1. Be highly selective. Prefer 0-3 items per category. Only include items that genuinely improve the coach's response. A concept group is relevant if its underlying concepts would help.
2. Provide a short "reason" (under 8 words) explaining why the item was selected.
3. CRITICAL: DO NOT RETURN IDs. You must return the exact string found inside the quotation marks for the "name" (for mental models) or "title" (for memories/concepts/groups).

CONVERSATION HISTORY:
${historyText || "(none)"}

USER'S CURRENT MESSAGE:
${userMessage}

AVAILABLE MENTAL MODELS (Format: id:X | name:"Y"):
${modelsText || "(none)"}

AVAILABLE LONG-TERM MEMORIES (Format: id:X | title:"Y"):
${ltmText || "(none)"}

AVAILABLE CUSTOM CONCEPTS (Format: id:X | title:"Y"):
${ccText || "(none)"}

AVAILABLE CONCEPT GROUPS (Format: id:X | title:"Y"):
${cgText || "(none)"}

Return ONLY valid JSON. Do not include markdown formatting blocks (\`\`\`json) or any extra text. Strictly adhere to this schema:
{"mentalModels":[{"name":"Exact Name Here","reason":"short explanation phrase"}],"longTermMemories":[{"title":"Exact Title Here","reason":"short explanation phrase"}],"customConcepts":[{"title":"Exact Title Here","reason":"short explanation phrase"}],"conceptGroups":[{"title":"Exact Title Here","reason":"short explanation phrase"}]}`;

  if (process.env.NODE_ENV === "development") {
    console.debug(formatDevLogBlock("[RelevantContext] LLM REQUEST", prompt));
  }

  const model = getModel();
  const result = await model.generateContent(prompt);
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text().trim();

  if (process.env.NODE_ENV === "development") {
    console.debug(
      formatDevLogBlock(
        "[RelevantContext] LLM RESPONSE",
        prettyJsonIfPossible(text.trim())
      )
    );
  }

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const normalizeId = (s: string) => s.replace(/^\[|\]$/g, "").trim();

  const resolveModelId = (m: { id?: string; name?: string }): string | null => {
    if (typeof m.id === "string") return normalizeId(m.id) || null;
    if (typeof m.name === "string") return nameToModelId.get(m.name.toLowerCase().trim()) ?? null;
    return null;
  };
  const resolveByTitle = (title: string, map: Map<string, string>): string | null => {
    const t = safeTitle(title);
    const exact = map.get(t) ?? map.get(title.trim());
    if (exact) return exact;
    for (const [key, id] of map) {
      if (key.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(key.toLowerCase())) return id;
    }
    return null;
  };
  const resolveLtmId = (m: { id?: string; title?: string }): string | null => {
    if (typeof m.id === "string") return normalizeId(m.id) || null;
    if (typeof m.title === "string") return resolveByTitle(m.title, titleToLtmId);
    return null;
  };
  const resolveCcId = (m: { id?: string; title?: string }): string | null => {
    if (typeof m.id === "string") return normalizeId(m.id) || null;
    if (typeof m.title === "string") return resolveByTitle(m.title, titleToCcId);
    return null;
  };
  const resolveCgId = (m: { id?: string; title?: string }): string | null => {
    if (typeof m.id === "string") return normalizeId(m.id) || null;
    if (typeof m.title === "string") return titleToCgId.get(m.title.trim()) ?? resolveByTitle(m.title, titleToCgId);
    return null;
  };

  try {
    const parsed = JSON.parse(cleaned) as {
      mentalModels?: { id?: string; name?: string; reason?: string }[];
      longTermMemories?: { id?: string; title?: string; reason?: string }[];
      customConcepts?: { id?: string; title?: string; reason?: string }[];
      conceptGroups?: { id?: string; title?: string; reason?: string }[];
    };
    return {
      mentalModels: (parsed.mentalModels ?? [])
        .map((m) => ({ id: resolveModelId(m), reason: m.reason ?? "" }))
        .filter((m): m is { id: string; reason: string } => m.id != null),
      longTermMemories: (parsed.longTermMemories ?? [])
        .map((m) => ({ id: resolveLtmId(m), reason: m.reason ?? "" }))
        .filter((m): m is { id: string; reason: string } => m.id != null),
      customConcepts: (parsed.customConcepts ?? [])
        .map((m) => ({ id: resolveCcId(m), reason: m.reason ?? "" }))
        .filter((m): m is { id: string; reason: string } => m.id != null),
      conceptGroups: (parsed.conceptGroups ?? [])
        .map((m) => ({ id: resolveCgId(m), reason: m.reason ?? "" }))
        .filter((m): m is { id: string; reason: string } => m.id != null),
    };
  } catch {
    return { mentalModels: [], longTermMemories: [], customConcepts: [], conceptGroups: [] };
  }
}

/**
 * Separate LLM call to identify which mental models, LTMs, and custom concepts were relevant
 * to a given assistant response, with a short reason for each.
 */
export async function getRelevantContext(
  assistantResponse: string,
  mentalModels: { id: string; name: string; oneLiner: string }[],
  longTermMemories: { id: string; enrichmentPrompt: string }[],
  customConcepts: { id: string; enrichmentPrompt: string }[] = [],
  conceptGroups: { id: string; title: string; enrichmentPrompts: string[] }[] = []
): Promise<RelevantContextResult> {
  const modelsText = mentalModels
    .map((m) => `- ${m.id}: ${m.name} — ${m.oneLiner}`)
    .join("\n");
  const ltmText = longTermMemories
    .map((l) => `- [${l.id}]: ${l.enrichmentPrompt}`)
    .join("\n");
  const ccText = customConcepts
    .map((c) => `- [${c.id}]: ${c.enrichmentPrompt}`)
    .join("\n");
  const cgText = conceptGroups
    .map((g) => `- [${g.id}] ${g.title}: ${g.enrichmentPrompts.join(" | ")}`)
    .join("\n");

  const prompt = `You are analyzing a coaching response to identify which mental models, long-term memories, custom concepts, and concept groups (domains) were relevant to or used in the response.

ASSISTANT RESPONSE:
${assistantResponse}

AVAILABLE MENTAL MODELS:
${modelsText || "(none)"}

AVAILABLE LONG-TERM MEMORIES:
${ltmText || "(none)"}

AVAILABLE CUSTOM CONCEPTS:
${ccText || "(none)"}

AVAILABLE CONCEPT GROUPS (domains with multiple concepts):
${cgText || "(none)"}

Return a JSON object identifying which items were actually used, referenced, or most relevant to the response. Include only items that genuinely informed the response. For each, add a short reason phrase (under 8 words) explaining why it was relevant. A concept group is relevant if any of its concepts were used.

Return ONLY valid JSON, no markdown, no extra text:
{"mentalModels":[{"id":"model_id","reason":"short phrase"}],"longTermMemories":[{"id":"ltm_id","reason":"short phrase"}],"customConcepts":[{"id":"cc_id","reason":"short phrase"}],"conceptGroups":[{"id":"cg_id","reason":"short phrase"}]}`;

  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      mentalModels?: { id?: string; reason?: string }[];
      longTermMemories?: { id?: string; reason?: string }[];
      customConcepts?: { id?: string; reason?: string }[];
      conceptGroups?: { id?: string; reason?: string }[];
    };
    return {
      mentalModels: (parsed.mentalModels ?? [])
        .filter((m) => typeof m.id === "string")
        .map((m) => ({ id: m.id!, reason: m.reason ?? "" })),
      longTermMemories: (parsed.longTermMemories ?? [])
        .filter((m) => typeof m.id === "string")
        .map((m) => ({ id: m.id!, reason: m.reason ?? "" })),
      customConcepts: (parsed.customConcepts ?? [])
        .filter((m) => typeof m.id === "string")
        .map((m) => ({ id: m.id!, reason: m.reason ?? "" })),
      conceptGroups: (parsed.conceptGroups ?? [])
        .filter((m) => typeof m.id === "string")
        .map((m) => ({ id: m.id!, reason: m.reason ?? "" })),
    };
  } catch {
    return { mentalModels: [], longTermMemories: [], customConcepts: [], conceptGroups: [] };
  }
}

export async function generateTitle(
  messages: { role: string; content: string }[],
  usageContext?: GeminiUsageContext
): Promise<string> {
  const summary = messages
    .slice(0, 6)
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");
  const model = getModel();
  const result = await model.generateContent(
    `Based on this conversation, generate a short 3-6 word title. Return ONLY the title, no quotes or punctuation.\n\nConversation:\n${summary}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text();
  return text.trim().slice(0, 60) || "Conversation";
}

