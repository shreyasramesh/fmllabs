import { GoogleGenerativeAI } from "@google/generative-ai";
import type { HabitBucket } from "@/lib/habit-buckets";
import { recordUsageEvent, computeGeminiCost } from "@/lib/usage";
import {
  EXTRACT_CONCEPTS_CHUNK_CHARS,
  EXTRACT_CONCEPTS_CHUNK_OVERLAP_CHARS,
  EXTRACT_CONCEPTS_MAX_TOTAL_CHARS,
} from "@/lib/extract-concepts-constants";
import {
  normalizeApiHighlightSpans,
  type QuickNoteHighlightSegment,
} from "@/lib/quick-note-highlights";

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
  maxOutputTokens?: number;
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
    generationConfig:
      typeof options?.maxOutputTokens === "number"
        ? { ...CHAT_GENERATION_CONFIG, maxOutputTokens: options.maxOutputTokens }
        : CHAT_GENERATION_CONFIG,
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
    generationConfig:
      typeof options?.maxOutputTokens === "number"
        ? { ...CHAT_GENERATION_CONFIG, maxOutputTokens: options.maxOutputTokens }
        : CHAT_GENERATION_CONFIG,
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

export type JournalPersonaLens = "critical" | "contrarian" | "systems_thinker" | "stoic";

export async function refineJournalEntryWithPersona(
  entryText: string,
  entryType: "gratitude" | "reflection",
  persona: JournalPersonaLens,
  usageContext?: GeminiUsageContext
): Promise<string> {
  const normalizedText = entryText.trim();
  const model = getModel();
  const personaInstruction: Record<JournalPersonaLens, string> = {
    critical:
      "Critical: tighten vague claims, ask what evidence supports each claim, and surface blind spots while staying constructive.",
    contrarian:
      "The Contrarian: challenge defaults and assumptions, suggest alternative interpretations, and avoid performative certainty.",
    systems_thinker:
      "The Systems Thinker: connect immediate events to patterns, feedback loops, triggers, and second-order effects.",
    stoic:
      "The Stoic: focus on what is within control, identify what must be accepted, and steer toward calm practical action.",
  };
  const entryTypeLabel = entryType === "gratitude" ? "gratitude journal" : "reflection journal";
  const result = await model.generateContent(
    `You are refining a user's ${entryTypeLabel} draft while preserving their voice.

Persona lens:
${personaInstruction[persona]}

Rules:
- Keep this in first-person, natural tone, and emotionally honest.
- Preserve concrete details from the original draft.
- Improve clarity and depth, but do not add fabricated facts.
- Keep it concise: 3-7 sentences.
- Return ONLY the rewritten entry text. No title, bullets, or commentary.

User draft:
${normalizedText}`
  );
  const text = result.response.text().trim();
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return text || normalizedText;
}

export type ChatInputLens =
  | "contrarian"
  | "systems_thinker"
  | "stoic"
  | "casual_friend"
  | "playful_coach";

export async function refineChatMessageWithLens(
  messageText: string,
  lens: ChatInputLens,
  usageContext?: GeminiUsageContext
): Promise<string> {
  const normalizedText = messageText.trim();
  const model = getModel();
  const lensInstruction: Record<ChatInputLens, string> = {
    contrarian:
      "The Contrarian: respectfully challenge assumptions, add one alternative interpretation, and reduce overconfidence.",
    systems_thinker:
      "The Systems Thinker: map dependencies, constraints, feedback loops, and likely second-order effects in plain language.",
    stoic:
      "The Stoic: separate what is in control vs outside control, reframe calmly, and orient toward practical action.",
    casual_friend:
      "Casual Friend: keep it warm, conversational, and relatable, as if speaking to a trusted friend.",
    playful_coach:
      "Playful Coach: keep it light and energizing, with encouraging tone and playful phrasing without being childish.",
  };
  const result = await model.generateContent(
    `You are rewriting a user's next chat message through a selected lens while preserving intent.

Lens:
${lensInstruction[lens]}

Rules:
- Keep first-person voice and original intent.
- Do not add fabricated facts.
- Keep it concise: 1-4 sentences.
- Preserve emotionally important details.
- Return ONLY the rewritten message text. No bullets, no title, no commentary.

User message draft:
${normalizedText}`
  );
  const text = result.response.text().trim();
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return text || normalizedText;
}

export type CalorieTrackingIntent = "nutrition" | "exercise" | "mixed";

export interface CalorieTrackingAnalyzeResult {
  intent: CalorieTrackingIntent;
  questions: string[];
}

export interface CalorieTrackingNutritionFacts {
  totalCarbohydratesGrams: number | null;
  dietaryFiberGrams: number | null;
  sugarGrams: number | null;
  addedSugarsGrams: number | null;
  sugarAlcoholsGrams: number | null;
  netCarbsGrams: number | null;
  saturatedFatGrams: number | null;
  transFatGrams: number | null;
  polyunsaturatedFatGrams: number | null;
  monounsaturatedFatGrams: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  potassiumMg: number | null;
  vitaminAIu: number | null;
  vitaminCMg: number | null;
  vitaminDMcg: number | null;
  caffeineMg: number | null;
}

export interface NutritionFactsFromMacrosInput {
  entryText: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface CalorieTrackingNutritionItem {
  name: string;
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
}

export interface CalorieTrackingExerciseItem {
  name: string;
  caloriesBurned: number | null;
  durationMinutes: number | null;
}

export interface DietaryFlag {
  tag: string;
  label: string;
  severity: "info" | "warning" | "concern";
  tip: string;
}

export interface CalorieTrackingFinalizeResult {
  intent: CalorieTrackingIntent;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  assumptions: string[];
  reasoning: string;
  nutritionItems: CalorieTrackingNutritionItem[];
  exerciseItems: CalorieTrackingExerciseItem[];
  /** Merged regex + item names + model spans (regex wins on overlap). */
  highlightSpans: QuickNoteHighlightSegment[];
  dietaryFlags: DietaryFlag[];
  nutrition?: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    facts?: CalorieTrackingNutritionFacts;
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

export async function estimateNutritionFactsFromMacros(
  input: NutritionFactsFromMacrosInput,
  usageContext?: GeminiUsageContext
): Promise<CalorieTrackingNutritionFacts> {
  const model = getModel();
  const result = await model.generateContent(
    `You estimate detailed nutrition facts from meal descriptions and known macro totals.

Return ONLY valid JSON with exactly this shape:
{
  "totalCarbohydratesGrams": number | null,
  "dietaryFiberGrams": number | null,
  "sugarGrams": number | null,
  "addedSugarsGrams": number | null,
  "sugarAlcoholsGrams": number | null,
  "netCarbsGrams": number | null,
  "saturatedFatGrams": number | null,
  "transFatGrams": number | null,
  "polyunsaturatedFatGrams": number | null,
  "monounsaturatedFatGrams": number | null,
  "cholesterolMg": number | null,
  "sodiumMg": number | null,
  "calciumMg": number | null,
  "ironMg": number | null,
  "potassiumMg": number | null,
  "vitaminAIu": number | null,
  "vitaminCMg": number | null,
  "vitaminDMcg": number | null,
  "caffeineMg": number | null
}

Rules:
- Respect these known totals closely: calories=${input.calories}, protein=${input.proteinGrams}g, carbs=${input.carbsGrams}g, fat=${input.fatGrams}g.
- Keep sub-components realistic and internally consistent (e.g. fiber <= total carbs, net carbs ~= total carbs - fiber - sugar alcohols when applicable).
- Use null only when a value is genuinely unknowable from context.

Entry context:
${input.entryText.trim().slice(0, 4000)}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const fallback: CalorieTrackingNutritionFacts = {
    totalCarbohydratesGrams: null,
    dietaryFiberGrams: null,
    sugarGrams: null,
    addedSugarsGrams: null,
    sugarAlcoholsGrams: null,
    netCarbsGrams: null,
    saturatedFatGrams: null,
    transFatGrams: null,
    polyunsaturatedFatGrams: null,
    monounsaturatedFatGrams: null,
    cholesterolMg: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    potassiumMg: null,
    vitaminAIu: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    caffeineMg: null,
  };
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      totalCarbohydratesGrams: toFiniteNumberOrNull(parsed.totalCarbohydratesGrams),
      dietaryFiberGrams: toFiniteNumberOrNull(parsed.dietaryFiberGrams),
      sugarGrams: toFiniteNumberOrNull(parsed.sugarGrams),
      addedSugarsGrams: toFiniteNumberOrNull(parsed.addedSugarsGrams),
      sugarAlcoholsGrams: toFiniteNumberOrNull(parsed.sugarAlcoholsGrams),
      netCarbsGrams: toFiniteNumberOrNull(parsed.netCarbsGrams),
      saturatedFatGrams: toFiniteNumberOrNull(parsed.saturatedFatGrams),
      transFatGrams: toFiniteNumberOrNull(parsed.transFatGrams),
      polyunsaturatedFatGrams: toFiniteNumberOrNull(parsed.polyunsaturatedFatGrams),
      monounsaturatedFatGrams: toFiniteNumberOrNull(parsed.monounsaturatedFatGrams),
      cholesterolMg: toFiniteNumberOrNull(parsed.cholesterolMg),
      sodiumMg: toFiniteNumberOrNull(parsed.sodiumMg),
      calciumMg: toFiniteNumberOrNull(parsed.calciumMg),
      ironMg: toFiniteNumberOrNull(parsed.ironMg),
      potassiumMg: toFiniteNumberOrNull(parsed.potassiumMg),
      vitaminAIu: toFiniteNumberOrNull(parsed.vitaminAIu),
      vitaminCMg: toFiniteNumberOrNull(parsed.vitaminCMg),
      vitaminDMcg: toFiniteNumberOrNull(parsed.vitaminDMcg),
      caffeineMg: toFiniteNumberOrNull(parsed.caffeineMg),
    };
  } catch {
    return fallback;
  }
}

export interface DailyLifeReportInput {
  dayLabel: string;
  mentorStyle?: {
    figureId: string;
    figureName: string;
    figureDescription?: string;
  } | null;
  snapshot: {
    conversationsCount: number;
    conversationMessagesCount: number;
    memoriesTouchedCount: number;
    focusSessionsCount: number;
    focusMinutes: number;
    nutritionEntriesCount: number;
    exerciseEntriesCount: number;
    journalEntriesCount: number;
    caloriesFood: number;
    caloriesExercise: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
  };
  excerpts: {
    journal: string[];
    memories: string[];
    conversations: string[];
    focusTags: string[];
  };
}

export interface DailyLifeReportResult {
  coachIntro: string;
  summary: string;
  wins: string[];
  momentumSignals: string[];
  tomorrowGamePlan: string[];
  sectionCards: Array<{
    key: "conversations" | "memories" | "focus" | "nutrition_exercise" | "journaling";
    title: string;
    body: string;
    accent: "violet" | "teal" | "emerald" | "amber" | "rose" | "sky";
  }>;
  closingNote: string;
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

export interface MentorRecommendationCandidate {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface MentorRecommendationItem {
  id: string;
  reason: string;
}

/** Primary scene type when `transcribeNutritionImage` runs in `auto` mode. */
export type NutritionImageAutoKind =
  | "nutrition"
  | "exercise"
  | "generic_text"
  | "weight_scale"
  | "sleep_tracker";

export interface NutritionImageTranscriptionResult {
  dishName: string;
  foodsDetected: string[];
  portionAssumptions: string[];
  nutritionLogDraft: string;
  confidence: "low" | "medium" | "high";
  /** Present when `mode === "auto"`. */
  imageKind?: NutritionImageAutoKind;
  /** Model guess in kg (auto mode, weight_scale or visible scale). */
  weightKgGuess?: number | null;
  sleepHoursGuess?: number | null;
  hrvMsGuess?: number | null;
  nutritionIntelligence?: {
    probableMealType?: string;
    proteinSources?: string[];
    carbSources?: string[];
    fatSources?: string[];
    fiberSources?: string[];
    sugarSources?: string[];
    cookingMethods?: string[];
    saucesAndDressings?: string[];
    portionConfidenceNotes?: string[];
    missingDetailsToConfirm?: string[];
  };
}

export interface NutritionGoalsProfileInput {
  age: number;
  gender: "male" | "female";
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  goal: "lose_weight" | "maintain_weight" | "gain_weight";
  pace: "extreme" | "moderate" | "mild";
  activityLevel?: string;
  dailySteps?: string;
  exerciseFrequency?: string;
  sleepQuality?: string;
  stressLevel?: string;
  mealsPerDay?: string;
  snackingFrequency?: string;
  waterIntake?: string;
  nutritionChallenges?: string[];
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

/**
 * Parses a calorie-tracking finalize JSON object (from Gemini or bundled brain-dump categorize).
 * Returns null if the payload is not a usable estimate object.
 */
export function tryParseCalorieTrackingFinalizePayload(
  parsed: unknown,
  highlightSourceText: string
): CalorieTrackingFinalizeResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  try {
    const intent: CalorieTrackingIntent =
      p.intent === "exercise" || p.intent === "mixed" ? p.intent : "nutrition";
    const confidence: "low" | "medium" | "high" =
      p.confidence === "low" || p.confidence === "high" ? p.confidence : "medium";
    const confidenceScore =
      typeof p.confidenceScore === "number" && Number.isFinite(p.confidenceScore)
        ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
        : confidence === "high"
          ? 80
          : confidence === "medium"
            ? 55
            : 25;
    const assumptions = Array.isArray(p.assumptions)
      ? p.assumptions
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const reasoning = typeof p.reasoning === "string" ? p.reasoning.trim().slice(0, 1000) : "";

    const nutritionItems: CalorieTrackingNutritionItem[] = Array.isArray(p.nutritionItems)
      ? (p.nutritionItems as Record<string, unknown>[])
          .filter((item) => item && typeof item === "object" && typeof item.name === "string")
          .map((item) => ({
            name: (item.name as string).trim().slice(0, 200),
            calories: toFiniteNumberOrNull(item.calories),
            proteinGrams: toFiniteNumberOrNull(item.proteinGrams),
            carbsGrams: toFiniteNumberOrNull(item.carbsGrams),
            fatGrams: toFiniteNumberOrNull(item.fatGrams),
          }))
          .slice(0, 20)
      : [];

    const exerciseItems: CalorieTrackingExerciseItem[] = Array.isArray(p.exerciseItems)
      ? (p.exerciseItems as Record<string, unknown>[])
          .filter((item) => item && typeof item === "object" && typeof item.name === "string")
          .map((item) => ({
            name: (item.name as string).trim().slice(0, 200),
            caloriesBurned: toFiniteNumberOrNull(item.caloriesBurned),
            durationMinutes: toFiniteNumberOrNull(item.durationMinutes),
          }))
          .slice(0, 20)
      : [];

    const nut = p.nutrition;
    const nutrition =
      nut && typeof nut === "object"
        ? {
            calories: toFiniteNumberOrNull((nut as Record<string, unknown>).calories),
            proteinGrams: toFiniteNumberOrNull((nut as Record<string, unknown>).proteinGrams),
            carbsGrams: toFiniteNumberOrNull((nut as Record<string, unknown>).carbsGrams),
            fatGrams: toFiniteNumberOrNull((nut as Record<string, unknown>).fatGrams),
            facts: {
              totalCarbohydratesGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.totalCarbohydratesGrams
              ),
              dietaryFiberGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.dietaryFiberGrams
              ),
              sugarGrams: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.sugarGrams),
              addedSugarsGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.addedSugarsGrams
              ),
              sugarAlcoholsGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.sugarAlcoholsGrams
              ),
              netCarbsGrams: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.netCarbsGrams),
              saturatedFatGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.saturatedFatGrams
              ),
              transFatGrams: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.transFatGrams),
              polyunsaturatedFatGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.polyunsaturatedFatGrams
              ),
              monounsaturatedFatGrams: toFiniteNumberOrNull(
                (nut as { facts?: Record<string, unknown> }).facts?.monounsaturatedFatGrams
              ),
              cholesterolMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.cholesterolMg),
              sodiumMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.sodiumMg),
              calciumMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.calciumMg),
              ironMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.ironMg),
              potassiumMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.potassiumMg),
              vitaminAIu: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.vitaminAIu),
              vitaminCMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.vitaminCMg),
              vitaminDMcg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.vitaminDMcg),
              caffeineMg: toFiniteNumberOrNull((nut as { facts?: Record<string, unknown> }).facts?.caffeineMg),
            },
            notes:
              typeof (nut as Record<string, unknown>).notes === "string"
                ? ((nut as Record<string, unknown>).notes as string).trim()
                : "",
          }
        : undefined;

    const ex = p.exercise;
    const exercise =
      ex && typeof ex === "object"
        ? {
            caloriesBurned: toFiniteNumberOrNull((ex as Record<string, unknown>).caloriesBurned),
            carbsUsedGrams: toFiniteNumberOrNull((ex as Record<string, unknown>).carbsUsedGrams),
            fatUsedGrams: toFiniteNumberOrNull((ex as Record<string, unknown>).fatUsedGrams),
            proteinDeltaGrams: toFiniteNumberOrNull((ex as Record<string, unknown>).proteinDeltaGrams),
            notes:
              typeof (ex as Record<string, unknown>).notes === "string"
                ? ((ex as Record<string, unknown>).notes as string).trim()
                : "",
          }
        : undefined;

    const highlightSpans = normalizeApiHighlightSpans(highlightSourceText, p.highlightSpans);

    const validSeverities = new Set(["info", "warning", "concern"]);
    const dietaryFlags: DietaryFlag[] = Array.isArray(p.dietaryFlags)
      ? (p.dietaryFlags as Record<string, unknown>[])
          .filter(
            (f) =>
              f &&
              typeof f === "object" &&
              typeof f.tag === "string" &&
              typeof f.label === "string" &&
              typeof f.severity === "string" &&
              validSeverities.has(f.severity) &&
              typeof f.tip === "string",
          )
          .map((f) => ({
            tag: (f.tag as string).slice(0, 40),
            label: (f.label as string).slice(0, 60),
            severity: f.severity as DietaryFlag["severity"],
            tip: (f.tip as string).slice(0, 200),
          }))
          .slice(0, 5)
      : [];

    return {
      intent,
      confidence,
      confidenceScore,
      assumptions,
      reasoning,
      nutritionItems,
      exerciseItems,
      highlightSpans,
      dietaryFlags,
      nutrition,
      exercise,
    };
  } catch {
    return null;
  }
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

export async function recommendMentorsForQuery(
  userQuery: string,
  candidates: MentorRecommendationCandidate[],
  desiredCount = 3,
  usageContext?: GeminiUsageContext
): Promise<MentorRecommendationItem[]> {
  const query = userQuery.trim().slice(0, 400);
  if (!query || candidates.length === 0) return [];
  const targetCount = Math.max(1, Math.min(5, Math.floor(desiredCount)));
  const shortlist = candidates.slice(0, 120);
  const listBlock = shortlist
    .map((c) => `- ${c.id} | ${c.name} | ${c.category} | ${c.description}`)
    .join("\n");

  const model = getModel();
  const result = await model.generateContent(
    `You are selecting mentors for a 1:1 guidance chat.

User request:
${query}

Candidate mentors (id | name | category | description):
${listBlock}

Pick exactly ${targetCount} mentors that best match the request.
Favor practical relevance and diversity of perspective.

Return ONLY valid JSON:
{
  "suggestions": [
    { "id": "mentor_id", "reason": "short reason, max 16 words" },
    { "id": "mentor_id", "reason": "short reason, max 16 words" },
    { "id": "mentor_id", "reason": "short reason, max 16 words" }
  ]
}

Rules:
- suggestion ids must come from the candidate list.
- Do not repeat ids.
- Keep reasons concrete and simple.
- No markdown, no extra keys, no extra text.`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      suggestions?: Array<{ id?: unknown; reason?: unknown }>;
    };
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const allowed = new Set(shortlist.map((c) => c.id));
    const dedupe = new Set<string>();
    const normalized: MentorRecommendationItem[] = [];
    for (const row of suggestions) {
      const id = typeof row.id === "string" ? row.id.trim() : "";
      if (!id || !allowed.has(id) || dedupe.has(id)) continue;
      dedupe.add(id);
      const reason =
        typeof row.reason === "string" && row.reason.trim()
          ? row.reason.trim().slice(0, 160)
          : "Strong match for your request.";
      normalized.push({ id, reason });
      if (normalized.length >= targetCount) break;
    }
    return normalized;
  } catch {
    return [];
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

const NUTRITION_IMAGE_AUTO_KINDS: readonly NutritionImageAutoKind[] = [
  "nutrition",
  "exercise",
  "generic_text",
  "weight_scale",
  "sleep_tracker",
] as const;

function parseNutritionImageAutoKind(v: unknown): NutritionImageAutoKind | undefined {
  return typeof v === "string" && (NUTRITION_IMAGE_AUTO_KINDS as readonly string[]).includes(v)
    ? (v as NutritionImageAutoKind)
    : undefined;
}

function parseWeightKgGuess(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim());
  if (!Number.isFinite(n) || n < 20 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

function parseSleepHoursGuess(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim());
  if (!Number.isFinite(n) || n < 0.5 || n > 24) return null;
  return Math.round(n * 100) / 100;
}

function parseHrvMsGuess(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim());
  if (!Number.isFinite(n) || n < 1 || n > 300) return null;
  return Math.round(n);
}

export async function transcribeNutritionImage(
  input: {
    imageBase64: string;
    mimeType: string;
    hintText?: string;
    mode?: "nutrition" | "exercise" | "auto";
  },
  usageContext?: GeminiUsageContext
): Promise<NutritionImageTranscriptionResult> {
  const cleanBase64 = input.imageBase64.trim();
  const hintText = (input.hintText ?? "").trim().slice(0, 600);
  const mode =
    input.mode === "exercise" || input.mode === "auto"
      ? input.mode
      : "nutrition";
  const imageModel = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-image-preview",
  });
  const result = await imageModel.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              mode === "exercise"
                ? `You are helping users log exercise/workout details from screenshots (for example Fitbit workout summaries).

Analyze the image and return ONLY valid JSON in this exact shape:
{
  "dishName": "short workout/activity label",
  "foodsDetected": ["key activity metric", "..."],
  "portionAssumptions": ["short assumption", "..."],
  "nutritionLogDraft": "1-3 sentence plain-text draft for an exercise log, including activity type, duration, intensity, distance/pace/heart rate/calories when visible",
  "confidence": "low" | "medium" | "high"
}

Rules:
- Focus only on exercise/workout information visible in the screenshot.
- Do NOT mention nutrition guidance or say this is a nutrition box.
- Be concrete and practical.
- If uncertain, say "likely" and include assumptions.
- Keep foodsDetected to max 8 items.
- Keep portionAssumptions to max 6 items.
- No markdown, no extra keys, no surrounding text.

Optional user hint:
${hintText || "(none)"}`
                : mode === "auto"
                  ? `You help users capture content from photos for a personal logging app (Quick Note, commonplace book, weight, sleep, etc.).

Classify the image into exactly ONE primary type:
- "nutrition" — food, drinks, meals, grocery items, nutrition labels for eating
- "exercise" — workouts, activity rings, gym logs, running/cycling summaries
- "generic_text" — book page, article, handwritten note, document, or screenshot where the main value is text to save (not mainly food/workout/scale/sleep UI)
- "weight_scale" — bathroom scale, weight readout, or photo centered on a body-weight number
- "sleep_tracker" — sleep app or wearable screenshot (e.g. Fitbit, Apple Health) showing time asleep, sleep stages, or sleep score

Return ONLY valid JSON in this exact shape:
{
  "imageKind": "nutrition" | "exercise" | "generic_text" | "weight_scale" | "sleep_tracker",
  "dishName": "short label for the scene (meal name, workout name, book title snippet, etc.)",
  "foodsDetected": ["key visible item or metric", "..."],
  "portionAssumptions": ["short assumption", "..."],
  "nutritionLogDraft": "Plain text for the user: transcribe important visible text and/or 1-5 sentences describing what to log. For generic_text, prefer accurate transcription of the passage. For sleep_tracker/weight_scale, include readable numbers from the image.",
  "confidence": "low" | "medium" | "high",
  "weightKgGuess": <number or null> — body weight in kg ONLY if clearly visible or imageKind is weight_scale (convert lb to kg: divide by 2.205),
  "sleepHoursGuess": <number or null> — hours of sleep if visible and imageKind is sleep_tracker (or clearly a sleep duration),
  "hrvMsGuess": <number or null> — heart rate variability in ms if visible (typical 20-200), else null
}

Rules:
- Choose the single best imageKind. If the image is mostly text from a book or note, use generic_text even if someone could eat food off a table in the corner.
- Keep foodsDetected max 8, portionAssumptions max 6.
- No markdown, no extra keys, no surrounding text.

Optional user hint:
${hintText || "(none)"}`
                : `You are helping users log nutrition from food images.

Analyze the image and return ONLY valid JSON in this exact shape:
{
  "dishName": "short likely dish name",
  "foodsDetected": ["food item", "..."],
  "portionAssumptions": ["short assumption", "..."],
  "nutritionLogDraft": "2-5 sentence plain-text draft for a nutrition log with foods, likely portions, prep method, and key uncertainty notes",
  "confidence": "low" | "medium" | "high",
  "nutritionIntelligence": {
    "probableMealType": "breakfast|lunch|dinner|snack or short phrase",
    "proteinSources": ["item", "..."],
    "carbSources": ["item", "..."],
    "fatSources": ["item", "..."],
    "fiberSources": ["item", "..."],
    "sugarSources": ["item", "..."],
    "cookingMethods": ["grilled|fried|baked|raw|steamed|...", "..."],
    "saucesAndDressings": ["item", "..."],
    "portionConfidenceNotes": ["how certain/uncertain and why", "..."],
    "missingDetailsToConfirm": ["question to ask user that would improve macro estimate", "..."]
  }
}

Rules:
- Be concrete and practical.
- If uncertain, say "likely" and include assumptions.
- Keep foodsDetected to max 8 items.
- Keep portionAssumptions to max 6 items.
- For nutritionIntelligence arrays, keep each array to max 5 items.
- Prioritize extraction details that materially affect calories/macros:
  portion sizes, oils/butter, sauces/dressings, breading/batter, cooking method, sweeteners, and beverages.
- Add "missingDetailsToConfirm" only for high-impact unknowns (e.g., portion size, sauce amount, oil usage).
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
      nutritionIntelligence?: unknown;
      imageKind?: unknown;
      weightKgGuess?: unknown;
      sleepHoursGuess?: unknown;
      hrvMsGuess?: unknown;
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
    const asStringList = (value: unknown, max: number): string[] =>
      Array.isArray(value)
        ? value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, max)
        : [];
    const intelligenceObj =
      parsed.nutritionIntelligence && typeof parsed.nutritionIntelligence === "object"
        ? (parsed.nutritionIntelligence as Record<string, unknown>)
        : null;
    const nutritionIntelligence = intelligenceObj
      ? {
          probableMealType:
            typeof intelligenceObj.probableMealType === "string"
              ? intelligenceObj.probableMealType.trim().slice(0, 80)
              : undefined,
          proteinSources: asStringList(intelligenceObj.proteinSources, 5),
          carbSources: asStringList(intelligenceObj.carbSources, 5),
          fatSources: asStringList(intelligenceObj.fatSources, 5),
          fiberSources: asStringList(intelligenceObj.fiberSources, 5),
          sugarSources: asStringList(intelligenceObj.sugarSources, 5),
          cookingMethods: asStringList(intelligenceObj.cookingMethods, 5),
          saucesAndDressings: asStringList(intelligenceObj.saucesAndDressings, 5),
          portionConfidenceNotes: asStringList(intelligenceObj.portionConfidenceNotes, 5),
          missingDetailsToConfirm: asStringList(intelligenceObj.missingDetailsToConfirm, 5),
        }
      : undefined;
    const nutritionLogDraft =
      typeof parsed.nutritionLogDraft === "string" && parsed.nutritionLogDraft.trim()
        ? parsed.nutritionLogDraft.trim().slice(0, 1200)
        : [
            dishName ? `Likely dish: ${dishName}.` : "",
            foodsDetected.length > 0 ? `Visible foods: ${foodsDetected.join(", ")}.` : "",
            portionAssumptions.length > 0 ? `Assumptions: ${portionAssumptions.join("; ")}.` : "",
            nutritionIntelligence?.cookingMethods?.length
              ? `Likely prep: ${nutritionIntelligence.cookingMethods.join(", ")}.`
              : "",
            nutritionIntelligence?.saucesAndDressings?.length
              ? `Possible sauces/dressings: ${nutritionIntelligence.saucesAndDressings.join(", ")}.`
              : "",
            nutritionIntelligence?.missingDetailsToConfirm?.length
              ? `Need to confirm: ${nutritionIntelligence.missingDetailsToConfirm.join("; ")}.`
              : "",
          ]
            .filter(Boolean)
            .join(" ");
    const base: NutritionImageTranscriptionResult = {
      dishName,
      foodsDetected,
      portionAssumptions,
      nutritionLogDraft,
      confidence,
      ...(nutritionIntelligence ? { nutritionIntelligence } : {}),
    };
    if (mode === "auto") {
      const imageKind = parseNutritionImageAutoKind(parsed.imageKind) ?? "generic_text";
      const weightKgGuess = parseWeightKgGuess(parsed.weightKgGuess);
      const sleepHoursGuess = parseSleepHoursGuess(parsed.sleepHoursGuess);
      const hrvMsGuess = parseHrvMsGuess(parsed.hrvMsGuess);
    return {
        ...base,
        imageKind,
        weightKgGuess,
        sleepHoursGuess,
        hrvMsGuess,
      };
    }
    return base;
  } catch {
    const fallbackDraft =
      mode === "exercise"
        ? "Could not confidently parse the workout screenshot. Please describe your activity details in text."
        : mode === "auto"
          ? "Could not confidently parse the image. Please describe what you see (food, workout, text, scale, or sleep app) in text."
          : "Could not confidently parse the image. Please describe what you ate in text.";
    const fallback: NutritionImageTranscriptionResult = {
      dishName: "",
      foodsDetected: [],
      portionAssumptions: [],
      nutritionLogDraft: fallbackDraft,
      confidence: "low",
    };
    if (mode === "auto") {
      return { ...fallback, imageKind: "generic_text" };
    }
    return fallback;
  }
}

function isGenericClarifyingQuestion(question: string): boolean {
  const q = question.toLowerCase().trim();
  return (
    q.length < 10 ||
    /^(anything else|any other details|can you share more details|more details|what else)\??$/.test(q) ||
    q.includes("share more context") ||
    q.includes("additional information")
  );
}

function maybeQuestion(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 180);
  if (!trimmed) return "";
  return /[?]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

function inputHasNutritionQuantitySignals(text: string): boolean {
  return /\b\d+(\.\d+)?\s?(g|gram|grams|oz|ounce|ounces|ml|cup|cups|tbsp|tsp|serving|servings|slice|slices|piece|pieces)\b/i.test(
    text
  );
}

function inputHasExerciseIntensitySignals(text: string): boolean {
  return /\b(\d+(\.\d+)?\s?(min|mins|minute|minutes|hour|hours|km|mile|miles|mph|kph)|pace|hr zone|heart rate|incline|resistance|sets|reps)\b/i.test(
    text
  );
}

function fallbackClarifyingQuestions(intent: CalorieTrackingIntent, inputText: string): string[] {
  const text = inputText.toLowerCase();
  if (intent === "nutrition") {
    const questions: string[] = [];
    if (!inputHasNutritionQuantitySignals(text)) {
      questions.push("What portions did you have for each item (for example cups, grams, or number of servings)?");
    }
    if (!/\b(oil|butter|sauce|dressing|fried|baked|grilled|brand|protein shake|milk)\b/i.test(text)) {
      questions.push("How was it prepared, and were oils, sauces, dressings, or branded products involved?");
    }
    return questions.slice(0, 2);
  }
  if (intent === "exercise") {
    const questions: string[] = [];
    if (!inputHasExerciseIntensitySignals(text)) {
      questions.push("How long was the workout, and what intensity or pace did you maintain?");
    }
    if (!/\b(weight|kg|lb|incline|resistance|sets|reps)\b/i.test(text)) {
      questions.push("Any key details like body weight, incline/resistance, or sets and reps?");
    }
    return questions.slice(0, 2);
  }
  return [
    "For the nutrition part, what portions did you have for each food or drink item?",
    "For the exercise part, how long and how intense was the activity?",
  ];
}

function sanitizeClarifyingQuestions(
  rawQuestions: unknown,
  intent: CalorieTrackingIntent,
  inputText: string
): string[] {
  if (!Array.isArray(rawQuestions)) {
    return fallbackClarifyingQuestions(intent, inputText).slice(0, 2);
  }
  const base = rawQuestions
    ? rawQuestions
        .map((q) => (typeof q === "string" ? maybeQuestion(q) : ""))
        .filter(Boolean)
    : [];
  if (base.length === 0) return [];
  const dedupe = new Set<string>();
  const cleaned = base
    .filter((q) => !isGenericClarifyingQuestion(q))
    .filter((q) => {
      const key = q.toLowerCase();
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    })
    .slice(0, 2);
  if (cleaned.length > 0) return cleaned;
  return fallbackClarifyingQuestions(intent, inputText).slice(0, 2);
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
- Questions must be directly tied to missing information in THIS specific user input.
- Prioritize the highest-impact missing fields for calorie and macro accuracy:
  - Nutrition: portion size/amount, preparation method, sauces/oils, key ingredients, brand when relevant.
  - Exercise: duration, intensity/pace, resistance/incline/sets-reps, body-weight context when relevant.
- Never ask broad/generic questions like "anything else?".
- If enough detail is already present, return an empty questions array.
- Keep each question short, concrete, and answerable in one line.

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
    const questions = sanitizeClarifyingQuestions(parsed.questions, intent, text);
    return { intent, questions };
  } catch {
    return { intent: "nutrition", questions: fallbackClarifyingQuestions("nutrition", text) };
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
  "confidenceScore": number (0-100),
  "assumptions": ["short assumption", "..."],
  "reasoning": "2-4 sentence explanation of how you derived the estimate, what sources or knowledge you referenced, and why you assigned this confidence level.",
  "nutritionItems": [
    { "name": "item name", "calories": number|null, "proteinGrams": number|null, "carbsGrams": number|null, "fatGrams": number|null }
  ],
  "exerciseItems": [
    { "name": "activity name", "caloriesBurned": number|null, "durationMinutes": number|null }
  ],
  "nutrition": {
    "calories": number | null,
    "proteinGrams": number | null,
    "carbsGrams": number | null,
    "fatGrams": number | null,
    "facts": {
      "totalCarbohydratesGrams": number | null,
      "dietaryFiberGrams": number | null,
      "sugarGrams": number | null,
      "addedSugarsGrams": number | null,
      "sugarAlcoholsGrams": number | null,
      "netCarbsGrams": number | null,
      "saturatedFatGrams": number | null,
      "transFatGrams": number | null,
      "polyunsaturatedFatGrams": number | null,
      "monounsaturatedFatGrams": number | null,
      "cholesterolMg": number | null,
      "sodiumMg": number | null,
      "calciumMg": number | null,
      "ironMg": number | null,
      "potassiumMg": number | null,
      "vitaminAIu": number | null,
      "vitaminCMg": number | null,
      "vitaminDMcg": number | null,
      "caffeineMg": number | null
    },
    "notes": "short note"
  } | null,
  "exercise": {
    "caloriesBurned": number | null,
    "carbsUsedGrams": number | null,
    "fatUsedGrams": number | null,
    "proteinDeltaGrams": number | null,
    "notes": "short note"
  } | null,
  "highlightSpans": [
    {
      "start": number,
      "end": number,
      "kind": "temporal" | "duration" | "distance" | "nutrition" | "weight" | "sleep" | "spend",
      "reason": "very short explanation of why this phrase matters"
    }
  ],
  "dietaryFlags": [
    {
      "tag": "high-sugar" | "low-protein" | "high-sodium" | "late-night" | "large-portion" | "no-vegetables" | "sugary-drink" | "processed-food" | "unbalanced-macros" | "skipping-fiber" | "high-calorie",
      "label": "Short human-readable label (3-5 words)",
      "severity": "info" | "warning" | "concern",
      "tip": "One actionable sentence of advice"
    }
  ]
}

Rules:
- For nutrition-only, set exercise to null and exerciseItems to [].
- For exercise-only, set nutrition to null and nutritionItems to [].
- For mixed, provide both.
- nutritionItems should break down each distinct food/drink item with its own macros. The sum of items should approximately equal the nutrition totals.
- exerciseItems should break down each distinct activity.
- confidenceScore: 75-100 for high confidence, 40-74 for medium, 0-39 for low.
- reasoning: explain what knowledge/sources you used, why this confidence level, and any key assumptions.
- Use null when unknown instead of inventing exact values.
- For nutrition facts, provide your best realistic estimate per field when nutrition exists.
- Keep assumptions concise and grounded.
- highlightSpans: Identify salient fragments in the Original input only. Use 0-based start and end (end exclusive), JavaScript string indices (UTF-16 code units). Each kind must be one of: temporal, duration, distance, nutrition, weight, sleep, spend. Do not overlap spans. Prefer short meaningful phrases (times, durations, distances, food/drink mentions, activities, sleep, money). Each span must include a concise plain-English "reason" suitable for a hover tooltip or mobile tap explanation. Omit if nothing clear.
- dietaryFlags: Flag anything nutritionally concerning about this entry. Only flag items that are genuinely noteworthy — do NOT flag perfectly normal meals. severity: "concern" for clearly unhealthy, "warning" for worth watching, "info" for neutral tips. Each tip must be one short actionable sentence. Return [] if nothing concerning.

Original input:
${text}

Clarification answers:
${answers.length ? answers.map((a, i) => `${i + 1}. ${a}`).join("\n") : "(none)"}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    const est = tryParseCalorieTrackingFinalizePayload(parsed, text);
    if (est) return est;
  } catch {
    /* fall through to fallback */
  }
    return {
      intent: "nutrition",
      confidence: "low",
      confidenceScore: 25,
      assumptions: [],
      reasoning: "",
      nutritionItems: [],
      exerciseItems: [],
    highlightSpans: [],
    dietaryFlags: [],
      nutrition: {
        calories: null,
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        facts: {
          totalCarbohydratesGrams: null,
          dietaryFiberGrams: null,
          sugarGrams: null,
          addedSugarsGrams: null,
          sugarAlcoholsGrams: null,
          netCarbsGrams: null,
          saturatedFatGrams: null,
          transFatGrams: null,
          polyunsaturatedFatGrams: null,
          monounsaturatedFatGrams: null,
          cholesterolMg: null,
          sodiumMg: null,
          calciumMg: null,
          ironMg: null,
          potassiumMg: null,
          vitaminAIu: null,
          vitaminCMg: null,
          vitaminDMcg: null,
          caffeineMg: null,
        },
        notes: "",
      },
    };
}

export async function generateDailyLifeReport(
  input: DailyLifeReportInput,
  usageContext?: GeminiUsageContext
): Promise<DailyLifeReportResult> {
  const model = getModel();
  const mentorStyleBlock = input.mentorStyle
    ? `Mentor style for today:
- Figure: ${input.mentorStyle.figureName} (${input.mentorStyle.figureId})
- Voice cues: ${input.mentorStyle.figureDescription?.trim() || "Use an encouraging, thoughtful coach tone inspired by this figure."}`
    : `Mentor style for today:
- Figure: default coach
- Voice cues: encouraging, motivational, grounded, practical, warm`;
  const result = await model.generateContent(
    `You are a motivational daily coach writing a beautiful end-of-day report.

Core behavior:
- Be supportive, optimistic, and practical.
- Sound like a caring coach, never critical or shaming.
- Celebrate progress, even when the day was imperfect.
- Build excitement for tomorrow with clear next actions.
- Do not provide medical diagnosis or medical claims.

${mentorStyleBlock}

Return ONLY valid JSON with exactly this shape:
{
  "coachIntro": "1-2 short motivational sentences",
  "summary": "2-4 short sentences covering the day holistically",
  "wins": ["win 1", "win 2", "..."],
  "momentumSignals": ["signal 1", "signal 2", "..."],
  "tomorrowGamePlan": ["action 1", "action 2", "action 3"],
  "sectionCards": [
    { "key": "conversations", "title": "...", "body": "...", "accent": "violet" },
    { "key": "memories", "title": "...", "body": "...", "accent": "teal" },
    { "key": "focus", "title": "...", "body": "...", "accent": "emerald" },
    { "key": "nutrition_exercise", "title": "...", "body": "...", "accent": "amber" },
    { "key": "journaling", "title": "...", "body": "...", "accent": "rose" }
  ],
  "closingNote": "1 short encouraging sentence for tomorrow"
}

Constraints:
- wins: 2 to 5 items
- momentumSignals: 2 to 5 items
- tomorrowGamePlan: exactly 3 to 5 items
- sectionCards: exactly 5 items with the listed keys
- body fields: 1-3 concise sentences
- Allowed accent values only: violet, teal, emerald, amber, rose, sky

DAY:
- Label: ${input.dayLabel}

AGGREGATED SNAPSHOT:
- Conversations: ${input.snapshot.conversationsCount}
- Conversation messages: ${input.snapshot.conversationMessagesCount}
- Memories touched: ${input.snapshot.memoriesTouchedCount}
- Focus sessions: ${input.snapshot.focusSessionsCount}
- Focus minutes: ${input.snapshot.focusMinutes}
- Nutrition entries: ${input.snapshot.nutritionEntriesCount}
- Exercise entries: ${input.snapshot.exerciseEntriesCount}
- Journal entries: ${input.snapshot.journalEntriesCount}
- Calories food: ${input.snapshot.caloriesFood} kcal
- Calories exercise: ${input.snapshot.caloriesExercise} kcal
- Carbs: ${input.snapshot.carbsGrams} g
- Protein: ${input.snapshot.proteinGrams} g
- Fat: ${input.snapshot.fatGrams} g

EXCERPTS:
- Journal notes:
${(input.excerpts.journal.length > 0 ? input.excerpts.journal : ["(none)"]).map((v) => `  - ${v}`).join("\n")}
- Memory notes:
${(input.excerpts.memories.length > 0 ? input.excerpts.memories : ["(none)"]).map((v) => `  - ${v}`).join("\n")}
- Conversation snippets:
${(input.excerpts.conversations.length > 0 ? input.excerpts.conversations : ["(none)"]).map((v) => `  - ${v}`).join("\n")}
- Focus tags:
${(input.excerpts.focusTags.length > 0 ? input.excerpts.focusTags : ["(none)"]).map((v) => `  - ${v}`).join("\n")}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const raw = result.response.text().trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      coachIntro?: unknown;
      summary?: unknown;
      wins?: unknown;
      momentumSignals?: unknown;
      tomorrowGamePlan?: unknown;
      sectionCards?: unknown;
      closingNote?: unknown;
    };
    const toList = (value: unknown, max: number) =>
      Array.isArray(value)
        ? value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .slice(0, max)
        : [];
    const allowedAccents = new Set(["violet", "teal", "emerald", "amber", "rose", "sky"]);
    const cardMap = new Map<string, { title: string; body: string; accent: "violet" | "teal" | "emerald" | "amber" | "rose" | "sky" }>();
    if (Array.isArray(parsed.sectionCards)) {
      for (const card of parsed.sectionCards) {
        if (!card || typeof card !== "object") continue;
        const c = card as Record<string, unknown>;
        const key = typeof c.key === "string" ? c.key : "";
        const title = typeof c.title === "string" ? c.title.trim() : "";
        const body = typeof c.body === "string" ? c.body.trim() : "";
        const accentRaw = typeof c.accent === "string" ? c.accent : "";
        if (!key || !title || !body || !allowedAccents.has(accentRaw)) continue;
        if (key === "conversations" || key === "memories" || key === "focus" || key === "nutrition_exercise" || key === "journaling") {
          cardMap.set(key, {
            title,
            body,
            accent: accentRaw as "violet" | "teal" | "emerald" | "amber" | "rose" | "sky",
          });
        }
      }
    }
    const fallbackCards: DailyLifeReportResult["sectionCards"] = [
      {
        key: "conversations",
        title: "Conversations",
        body: `You had ${input.snapshot.conversationsCount} conversation touches today. Keep that reflective momentum going.`,
        accent: "violet",
      },
      {
        key: "memories",
        title: "Memory",
        body: `${input.snapshot.memoriesTouchedCount} memory signals were active today. You are turning experiences into reusable clarity.`,
        accent: "teal",
      },
      {
        key: "focus",
        title: "Focus",
        body: `${input.snapshot.focusSessionsCount} focus sessions totaling ${input.snapshot.focusMinutes} minutes. Consistency beats intensity.`,
        accent: "emerald",
      },
      {
        key: "nutrition_exercise",
        title: "Nutrition + Exercise",
        body: `Food ${input.snapshot.caloriesFood} kcal and exercise burn ${input.snapshot.caloriesExercise} kcal were logged. Keep showing up for your body.`,
        accent: "amber",
      },
      {
        key: "journaling",
        title: "Journaling",
        body: `${input.snapshot.journalEntriesCount} journal entries were captured. Reflection is compounding.`,
        accent: "rose",
      },
    ];
    const sectionCards = fallbackCards.map((fallback) => {
      const parsedCard = cardMap.get(fallback.key);
      return parsedCard ? { ...fallback, ...parsedCard } : fallback;
    });
    const wins = toList(parsed.wins, 5);
    const momentumSignals = toList(parsed.momentumSignals, 5);
    const tomorrowGamePlan = toList(parsed.tomorrowGamePlan, 5);
    return {
      coachIntro:
        typeof parsed.coachIntro === "string" && parsed.coachIntro.trim()
          ? parsed.coachIntro.trim()
          : "Your day has real momentum in it. Let's carry that energy into tomorrow.",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "You captured meaningful signals across your day. This report turns those signals into a practical next step.",
      wins:
        wins.length > 0
          ? wins
          : [
              `You logged ${input.snapshot.journalEntriesCount} journal entries.`,
              `You completed ${input.snapshot.focusSessionsCount} focus sessions.`,
            ],
      momentumSignals:
        momentumSignals.length > 0
          ? momentumSignals
          : [
              "Consistency is visible in your tracking behavior.",
              "Your reflection and action loops are getting tighter.",
            ],
      tomorrowGamePlan:
        tomorrowGamePlan.length > 0
          ? tomorrowGamePlan
          : [
              "Choose your top 1 priority before the day starts.",
              "Protect one focused work block on your calendar.",
              "Close the day with one short reflection entry.",
            ],
      sectionCards,
      closingNote:
        typeof parsed.closingNote === "string" && parsed.closingNote.trim()
          ? parsed.closingNote.trim()
          : "Tomorrow is already set up for a strong start. Keep moving one deliberate step at a time.",
    };
  } catch {
    return {
      coachIntro: "Your day has real momentum in it. Let's carry that energy into tomorrow.",
      summary: "You captured meaningful signals across your day. This report turns those signals into practical next steps.",
      wins: [
        `You logged ${input.snapshot.journalEntriesCount} journal entries.`,
        `You completed ${input.snapshot.focusSessionsCount} focus sessions.`,
      ],
      momentumSignals: [
        "Consistency is visible in your tracking behavior.",
        "Your reflection and action loops are getting tighter.",
      ],
      tomorrowGamePlan: [
        "Choose your top 1 priority before the day starts.",
        "Protect one focused work block on your calendar.",
        "Close the day with one short reflection entry.",
      ],
      sectionCards: [
        {
          key: "conversations",
          title: "Conversations",
          body: `You had ${input.snapshot.conversationsCount} conversation touches today. Keep that reflective momentum going.`,
          accent: "violet",
        },
        {
          key: "memories",
          title: "Memory",
          body: `${input.snapshot.memoriesTouchedCount} memory signals were active today. You are turning experiences into reusable clarity.`,
          accent: "teal",
        },
        {
          key: "focus",
          title: "Focus",
          body: `${input.snapshot.focusSessionsCount} focus sessions totaling ${input.snapshot.focusMinutes} minutes. Consistency beats intensity.`,
          accent: "emerald",
        },
        {
          key: "nutrition_exercise",
          title: "Nutrition + Exercise",
          body: `Food ${input.snapshot.caloriesFood} kcal and exercise burn ${input.snapshot.caloriesExercise} kcal were logged. Keep showing up for your body.`,
          accent: "amber",
        },
        {
          key: "journaling",
          title: "Journaling",
          body: `${input.snapshot.journalEntriesCount} journal entries were captured. Reflection is compounding.`,
          accent: "rose",
        },
      ],
      closingNote:
        "Tomorrow is already set up for a strong start. Keep moving one deliberate step at a time.",
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
- Pace: ${input.pace}${input.activityLevel ? `\n- Activity level: ${input.activityLevel}` : ""}${input.dailySteps ? `\n- Daily steps: ${input.dailySteps}` : ""}${input.exerciseFrequency ? `\n- Exercise frequency: ${input.exerciseFrequency}` : ""}${input.sleepQuality ? `\n- Sleep quality: ${input.sleepQuality}` : ""}${input.stressLevel ? `\n- Stress level: ${input.stressLevel}` : ""}${input.mealsPerDay ? `\n- Meals per day: ${input.mealsPerDay}` : ""}${input.snackingFrequency ? `\n- Snacking: ${input.snackingFrequency}` : ""}${input.waterIntake ? `\n- Water intake: ${input.waterIntake}` : ""}${input.nutritionChallenges?.length ? `\n- Nutrition challenges: ${input.nutritionChallenges.join(", ")}` : ""}`
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
): Promise<{ name: string; description: string; howToFollowThrough: string; tips: string; calorieImpact: { type: "intake" | "burn"; calories: number; label: string } | null }> {
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
    `You are converting a concept or memory into a daily habit the user can practice. Return a JSON object with exactly five keys:
- "name": A short 2-5 word name for the habit (e.g. "Morning reflection", "Pause before reacting").
- "description": A rich 2-3 paragraph description. The first paragraph describes the habit concretely—what it is, when and how to do it. The second paragraph explains the deeper benefit and why it matters. An optional third paragraph connects it to long-term growth. Write in a warm, grounded tone. Separate paragraphs with "\\n\\n".
- "howToFollowThrough": 4-6 actionable steps. Each step should be a complete, specific instruction (not vague), written as "- Step text" with steps separated by "\\n". Example: "- Set a timer for ten minutes to avoid checking the clock during your practice."
- "tips": 3-5 practical tips for sticking with the habit, reducing friction, or avoiding common pitfalls. Each tip should be concrete and specific, written as "- Tip text" with tips separated by "\\n". Example: "- Place your yoga mat out the night before to reduce friction when you wake up."
- "calorieImpact": Estimate the calorie impact of completing this habit once. Return an object with three keys: "type" ("intake" if the habit involves consuming food/drink, "burn" if it involves physical activity or energy expenditure), "calories" (estimated kcal as a positive integer), and "label" (a short human-readable label like "Morning coffee ~5 kcal" or "Standing 3 hrs ~150 kcal burned"). If the habit has no meaningful calorie impact (e.g. meditation, journaling), return null.
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
    calorieImpact?: { type?: string; calories?: number; label?: string } | null;
  };
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const rawCal = parsed.calorieImpact;
  const calorieImpact =
    rawCal &&
    (rawCal.type === "intake" || rawCal.type === "burn") &&
    typeof rawCal.calories === "number" &&
    rawCal.calories > 0 &&
    typeof rawCal.label === "string"
      ? { type: rawCal.type as "intake" | "burn", calories: Math.round(rawCal.calories), label: rawCal.label }
      : null;
  return {
    name: parsed.name ?? "Daily habit",
    description: parsed.description ?? "",
    howToFollowThrough: parsed.howToFollowThrough ?? "",
    tips: parsed.tips ?? "",
    calorieImpact,
  };
}

/** Expand a short manual draft into a full habit; refines name/description and generates steps and tips. */
export async function generateHabitFromManualDraft(
  input: { bucket: HabitBucket; name: string; description: string },
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<{ name: string; description: string; howToFollowThrough: string; tips: string; calorieImpact: { type: "intake" | "burn"; calories: number; label: string } | null }> {
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

Your task — return a JSON object with exactly five keys:
- "name": A clear, concise habit name (2-5 words). Refine their title if needed for clarity; keep their intent.
- "description": A rich 2-3 paragraph description that elevates the user's rough draft into something polished and inspiring, without changing their underlying intent. The first paragraph describes the habit concretely—what it is, when and how to do it. The second paragraph explains the deeper benefit and why it matters. An optional third paragraph connects it to long-term growth. Write in a warm, grounded tone. Separate paragraphs with "\\n\\n".
- "howToFollowThrough": 4-6 actionable steps. Each step should be a complete, specific instruction (not vague), written as "- Step text" with steps separated by "\\n". Example: "- Set a timer for ten minutes to avoid checking the clock during your practice."
- "tips": 3-5 practical tips for sticking with the habit, reducing friction, or avoiding common pitfalls. Each tip should be concrete and specific, written as "- Tip text" with tips separated by "\\n". Example: "- Place your yoga mat out the night before to reduce friction when you wake up."
- "calorieImpact": Estimate the calorie impact of completing this habit once. Return an object with three keys: "type" ("intake" if the habit involves consuming food/drink, "burn" if it involves physical activity or energy expenditure), "calories" (estimated kcal as a positive integer), and "label" (a short human-readable label like "Morning coffee ~5 kcal" or "Standing 3 hrs ~150 kcal burned"). If the habit has no meaningful calorie impact (e.g. meditation, journaling), return null.

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
    calorieImpact?: { type?: string; calories?: number; label?: string } | null;
  };
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const rawCal = parsed.calorieImpact;
  const calorieImpact =
    rawCal &&
    (rawCal.type === "intake" || rawCal.type === "burn") &&
    typeof rawCal.calories === "number" &&
    rawCal.calories > 0 &&
    typeof rawCal.label === "string"
      ? { type: rawCal.type as "intake" | "burn", calories: Math.round(rawCal.calories), label: rawCal.label }
      : null;
  return {
    name: parsed.name?.trim() || input.name.trim() || "Daily habit",
    description: parsed.description?.trim() || input.description.trim(),
    howToFollowThrough: parsed.howToFollowThrough ?? "",
    tips: parsed.tips ?? "",
    calorieImpact,
  };
}

export async function estimateHabitCalorieImpact(
  input: { name: string; description: string },
  usageContext?: GeminiUsageContext
): Promise<{ type: "intake" | "burn"; calories: number; label: string } | null> {
  const model = getModel();
  const result = await model.generateContent(
    `Given a daily habit, estimate its calorie impact for one completion. Return a JSON object with three keys:
- "type": "intake" if the habit involves consuming food or drink (adds calories), or "burn" if it involves physical activity or energy expenditure (burns calories).
- "calories": estimated kcal as a positive integer.
- "label": a short human-readable label (e.g. "Morning coffee ~5 kcal" or "Standing 3 hrs ~150 kcal burned").

If the habit has no meaningful calorie impact (e.g. meditation, journaling, reading), return the JSON value null.

Return ONLY valid JSON, no markdown or extra text.

Habit name: ${input.name}
Description: ${input.description}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  if (cleaned === "null") return null;
  try {
    const parsed = JSON.parse(cleaned) as { type?: string; calories?: number; label?: string } | null;
    if (
      parsed &&
      (parsed.type === "intake" || parsed.type === "burn") &&
      typeof parsed.calories === "number" &&
      parsed.calories > 0 &&
      typeof parsed.label === "string"
    ) {
      return { type: parsed.type as "intake" | "burn", calories: Math.round(parsed.calories), label: parsed.label };
    }
  } catch { /* invalid JSON */ }
  return null;
}

export async function generateHabitResearchNotes(
  input: {
    name: string;
    description: string;
    howToFollowThrough: string;
    tips: string;
    bucket?: HabitBucket;
  },
  languageName?: string,
  usageContext?: GeminiUsageContext
): Promise<string> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all content in ${languageName}.`
      : "";
  const bucketBlock = input.bucket
    ? `\nLife area: ${HABIT_BUCKET_PROMPTS[input.bucket]}`
    : "";
  const model = getModel();
  const result = await model.generateContent(
    `You are creating a practical research brief for a user's 30-day experiment.

Return a concise markdown brief with exactly these headings:
## What this experiment is testing
## What to research (high-value)
## Questions to answer this month
## Success signals to track weekly
## Common mistakes to avoid

Rules:
- Keep it practical and evidence-oriented.
- Use short bullet points under each heading.
- Avoid fluff or generic motivation language.
- Tailor to the specific experiment details.
${languageInstruction}${bucketBlock}

Experiment name: ${input.name}
Description: ${input.description}
How to follow through: ${input.howToFollowThrough}
Tips: ${input.tips}

Return ONLY markdown text, no JSON and no extra commentary.`
  );
  const text = result.response.text().trim();
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  return text;
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

export type BrainDumpCategory =
  | "reflection"
  | "concept"
  | "experiment"
  | "nutrition"
  | "exercise"
  | "weight"
  | "sleep"
  | "spend";

export interface BrainDumpResult {
  category: BrainDumpCategory;
  title: string;
  reflectionText?: string;
  conceptSummary?: string;
  conceptEnrichmentPrompt?: string;
  experimentDescription?: string;
  experimentHowTo?: string;
  experimentTips?: string;
  nutritionText?: string;
  exerciseText?: string;
  weightKg?: number;
  sleepHours?: number;
  hrvMs?: number | null;
  /** Spend entry: amount in the original currency (e.g. 12 for $12). */
  spendAmount?: number;
  /** ISO 4217 currency code, default "USD". */
  spendCurrency?: string;
  /** Short description of what was purchased / spent on. */
  spendMemo?: string;
  /** When set (short-input bundled categorize), persist skips a second Gemini finalize call. */
  precomputedCalorieEstimate?: CalorieTrackingFinalizeResult;
}

function normalizeBrainDumpEntry(
  parsed: Record<string, unknown>,
  fallbackTitle: string
): BrainDumpResult {
  const validCategories: BrainDumpCategory[] = [
    "reflection",
    "concept",
    "experiment",
    "nutrition",
    "exercise",
    "weight",
    "sleep",
    "spend",
  ];
  const category = validCategories.includes(parsed.category as BrainDumpCategory)
    ? (parsed.category as BrainDumpCategory)
    : "reflection";

  const toStr = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  // Parse spend amount — accept number or dollar-prefixed string like "$12" or "12.50"
  let spendAmount: number | undefined;
  if (category === "spend") {
    const raw = parsed.spendAmount;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      spendAmount = raw;
    } else if (typeof raw === "string") {
      const n = Number.parseFloat(raw.replace(/[$,]/g, ""));
      if (Number.isFinite(n) && n > 0) spendAmount = n;
    }
  }

  const rawCurrency = typeof parsed.spendCurrency === "string" ? parsed.spendCurrency.trim().toUpperCase() : "";
  const spendCurrency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "USD";

  const base: BrainDumpResult = {
    category,
    title: typeof parsed.title === "string" ? parsed.title.trim().slice(0, 120) : fallbackTitle,
    reflectionText: toStr(parsed.reflectionText),
    conceptSummary: toStr(parsed.conceptSummary),
    conceptEnrichmentPrompt: toStr(parsed.conceptEnrichmentPrompt),
    experimentDescription: toStr(parsed.experimentDescription),
    experimentHowTo: toStr(parsed.experimentHowTo),
    experimentTips: toStr(parsed.experimentTips),
    nutritionText: toStr(parsed.nutritionText),
    exerciseText: toStr(parsed.exerciseText),
    weightKg: toNum(parsed.weightKg),
    sleepHours: toNum(parsed.sleepHours),
    hrvMs: parsed.hrvMs === null ? null : toNum(parsed.hrvMs),
    ...(category === "spend" && spendAmount != null ? {
      spendAmount,
      spendCurrency,
      spendMemo: toStr(parsed.spendMemo) ?? toStr(parsed.title) ?? fallbackTitle,
    } : {}),
  };

  const ceRaw = parsed.calorieEstimate;
  if (
    (category === "nutrition" || category === "exercise") &&
    ceRaw &&
    typeof ceRaw === "object"
  ) {
    const lineForHighlights =
      category === "nutrition"
        ? (base.nutritionText ?? "").trim()
        : (base.exerciseText ?? "").trim();
    const pre = tryParseCalorieTrackingFinalizePayload(
      ceRaw,
      lineForHighlights || fallbackTitle
    );
    if (pre) {
      base.precomputedCalorieEstimate = pre;
    }
  }

  return base;
}

/** Transcripts this length or shorter can bundle calorie estimation into categorize (one Gemini call). */
export const BRAIN_DUMP_BUNDLE_CALORIE_MAX_CHARS = 800;

/** Remove server-only fields before returning brain-dump entries to the client. */
export function stripBrainDumpClientEntries(entries: BrainDumpResult[]): BrainDumpResult[] {
  return entries.map(({ precomputedCalorieEstimate: _, ...rest }) => rest);
}

/**
 * Categorizes a brain dump into one or more structured entries when the transcript mixes topics
 * (e.g. a meal log and a workout in the same note). Returns at least one entry.
 */
export async function categorizeBrainDump(
  transcript: string,
  usageContext?: GeminiUsageContext,
  categorizeOptions?: { bundleCalorieEstimate?: boolean }
): Promise<BrainDumpResult[]> {
  const trimmedTranscript = transcript.trim();
  const bundleCalorieEstimate = Boolean(
    categorizeOptions?.bundleCalorieEstimate &&
      trimmedTranscript.length > 0 &&
      trimmedTranscript.length <= BRAIN_DUMP_BUNDLE_CALORIE_MAX_CHARS
  );

  const bundleCalorieBlock = bundleCalorieEstimate
    ? `

SHORT INPUT — bundled calorie estimation (required):
- For EVERY entry with category "nutrition" or "exercise", also include "calorieEstimate": { ... } using the SAME JSON shape as a calorie-tracking finalize response:
  - "intent": "nutrition" | "exercise" | "mixed"
  - "confidence": "low" | "medium" | "high", "confidenceScore": 0-100
  - "assumptions": string[], "reasoning": string
  - "nutritionItems": [{ "name", "calories", "proteinGrams", "carbsGrams", "fatGrams" }]
  - "exerciseItems": [{ "name", "caloriesBurned", "durationMinutes" }]
  - "nutrition": { "calories": number|null, "proteinGrams": number|null, "carbsGrams": number|null, "fatGrams": number|null, "facts": { "totalCarbohydratesGrams": number|null, "dietaryFiberGrams": number|null, "sugarGrams": number|null, "addedSugarsGrams": number|null, "sugarAlcoholsGrams": number|null, "netCarbsGrams": number|null, "saturatedFatGrams": number|null, "transFatGrams": number|null, "polyunsaturatedFatGrams": number|null, "monounsaturatedFatGrams": number|null, "cholesterolMg": number|null, "sodiumMg": number|null, "calciumMg": number|null, "ironMg": number|null, "potassiumMg": number|null, "vitaminAIu": number|null, "vitaminCMg": number|null, "vitaminDMcg": number|null, "caffeineMg": number|null }, "notes": string } | null
  - "exercise": { caloriesBurned, carbsUsedGrams, fatUsedGrams, proteinDeltaGrams, notes } | null
  - "highlightSpans": [{ "start", "end", "kind", "reason" }] (0-based indices into THAT entry's nutritionText or exerciseText only)
- Derive calorieEstimate only from that entry's nutritionText or exerciseText.
- For nutrition facts, provide your best realistic estimate per field — use null only when truly unknown.
- For "reflection", "concept", "experiment", "weight", "sleep" entries: omit calorieEstimate.
`
    : "";

  const model = getModel();
  const result = await model.generateContent(
    `You are an AI assistant that categorizes a user's voice brain-dump into one or more structured entries.
${bundleCalorieBlock}
Categories:
1. "reflection" — journaling, emotions, reviewing the day, gratitude, processing experiences.
2. "concept" — idea, mental model, framework, insight to remember.
3. "experiment" — behavior change, habit, practice, challenge to try.
4. "nutrition" — food/drink logging.
5. "exercise" — workout or physical activity logging.
6. "weight" — body weight report.
7. "sleep" — sleep duration/quality (and optional HRV).
8. "spend" — purchase, expense, or money spent (any mention of a dollar amount, price, cost, or payment).

IMPORTANT — Multiple entries:
- If the transcript clearly contains DISTINCT items that belong to DIFFERENT categories, return SEPARATE entries — one JSON object per distinct item.
- CRITICAL: When a note mentions both a food/drink AND a price (e.g. "I ate a $12 burger"), ALWAYS return TWO entries: one "spend" (the cost) and one "nutrition" (the food). The food/drink is logged for nutrition regardless of its price.
- Similarly, "$15 coffee" → spend + nutrition; "paid $30 for a gym class" → spend + exercise.
- If the whole transcript is one coherent note with no mixed categories, return a SINGLE entry.
- Do not split a single meal or single workout into multiple entries.
- Maximum 8 entries. Merge minor fragments with the closest entry.
- Each entry must include "category", "title", and ALL required fields for that category (same as below).

Per-entry fields (match category):
- "reflection": "reflectionText" (cleaned journal, 1-4 paragraphs, preserve voice).
- "concept": "conceptSummary", "conceptEnrichmentPrompt" (25-40 words for coach).
- "experiment": "experimentDescription", "experimentHowTo" (newline-separated steps), "experimentTips" (newline-separated tips).
- "nutrition": "nutritionText" (clean food log line(s) for that item only).
- "exercise": "exerciseText" (clean activity description for that item only).
- "weight": "weightKg" (kg; convert lb via divide by 2.205, 1 decimal).
- "sleep": "sleepHours", "hrvMs" (number or null).
- "spend": "spendAmount" (numeric amount, no currency symbol), "spendCurrency" (ISO 4217 code, default "USD"), "spendMemo" (short description of what was purchased, max 120 chars).

Return ONLY valid JSON:
{ "entries": [ { ... }, ... ] }

User's brain dump transcript:
${trimmedTranscript}`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const rawEntries: unknown[] = Array.isArray(parsed.entries)
      ? parsed.entries
      : parsed.category        ? [parsed]
        : [];

    if (rawEntries.length === 0) {
      return [
        normalizeBrainDumpEntry(
          {
            category: "reflection",
            title: "Voice note",
            reflectionText: transcript.trim(),
          },
          "Voice note"
        ),
      ];
    }

    const out: BrainDumpResult[] = [];
    for (const e of rawEntries.slice(0, 8)) {
      if (e && typeof e === "object") {
        out.push(normalizeBrainDumpEntry(e as Record<string, unknown>, "Brain Dump"));
      }
    }
    return out.length > 0      ? out
      : [
          normalizeBrainDumpEntry(
            {
              category: "reflection",
              title: "Voice note",
              reflectionText: transcript.trim(),
            },
            "Voice note"
          ),
        ];
  } catch {
    return [
      normalizeBrainDumpEntry(
        {
          category: "reflection",
          title: "Voice note",
          reflectionText: transcript.trim(),
        },
        "Voice note"
      ),
    ];
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

/** One night of sleep as stored in the app (hours may be manual; score often from Fitbit). */
export interface SleepInsightsEntry {
  dayKey: string;
  sleepHours: number;
  hrvMs: number | null;
  sleepScore: number | null;
}

/**
 * Gemini markdown note: interprets Fitbit sleep score (1–100) as vendor composite when present.
 */
export async function generateSleepInsightsMarkdown(
  entries: SleepInsightsEntry[],
  usageContext?: GeminiUsageContext
): Promise<string> {
  const sorted = [...entries].sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  const lines = sorted.slice(0, 40).map((e) => {
    const hrv = e.hrvMs != null && Number.isFinite(e.hrvMs) ? `${Math.round(e.hrvMs)} ms` : "not logged";
    const scorePart =
      e.sleepScore != null && e.sleepScore >= 1 && e.sleepScore <= 100
        ? `Fitbit sleep score: ${Math.round(e.sleepScore)}/100 (device composite score on a 1–100 scale; not a clinical measure)`
        : "Fitbit sleep score: not logged for this night";
    return `- ${e.dayKey}: sleep duration logged ${e.sleepHours} h; resting HRV ${hrv}; ${scorePart}`;
  });

  const dataBlock = lines.length > 0 ? lines.join("\n") : "(no nights logged)";

  const model = getModel();
  const result = await model.generateContent(
    `You are a supportive sleep and recovery coach. The user tracks sleep in this app. Some fields may come from a Fitbit-linked account or similar wearable.

How to read the data:
- **Sleep duration (hours)** is what the user logged for that calendar night (time asleep / main sleep block as recorded in the app).
- **Fitbit sleep score (1–100)** when present is Fitbit's proprietary composite (sleep stages, duration, restoration, etc.). It is a consumer wellness metric, not a medical diagnosis. Refer to it as "your Fitbit sleep score" or "the score from your Fitbit" — never as a clinical measure of sleep quality.
- **HRV (ms)** is resting heart rate variability when the user logged it; omit deep interpretation if most values are missing.

USER SLEEP LOG (most recent nights first):
${dataBlock}

Write a helpful insights note in **Markdown**:
- Start with ## title (e.g. "## Sleep insights").
- Use ### subheadings for sections like Patterns, Fitbit score trend (only if scores exist), What to try this week.
- Be specific to the dates and numbers provided.
- 3–7 actionable, non-alarmist suggestions (schedule, wind-down, consistency, light exposure, caffeine, movement). No medical diagnosis or treatment claims.
- If the log is sparse, encourage consistent logging and still offer 2–4 general sleep hygiene tips.
- Keep length roughly 350–900 words unless there is almost no data (then shorter).
- Do not invent nights or scores not shown above.`
  );
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text().trim();
  return text || "Could not generate insights. Please try again.";
}

export interface SleepHabitTipHabit {
  name: string;
  description?: string;
  isHero: boolean;
}

/**
 * Generate a single concise habit-based recommendation to improve sleep score,
 * HRV, or duration, personalised to the user's existing habits.
 */
export async function generateSleepHabitTip(
  entries: SleepInsightsEntry[],
  habits: SleepHabitTipHabit[],
  usageContext?: GeminiUsageContext
): Promise<string> {
  const sorted = [...entries].sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  const recent = sorted.slice(0, 7);

  const sleepLines = recent.map((e) => {
    const hrv = e.hrvMs != null ? `HRV ${Math.round(e.hrvMs)} ms` : "HRV not logged";
    const score = e.sleepScore != null ? `sleep score ${Math.round(e.sleepScore)}/100` : "no sleep score";
    return `  ${e.dayKey}: ${e.sleepHours.toFixed(1)}h, ${hrv}, ${score}`;
  });

  const heroHabits = habits.filter((h) => h.isHero);
  const experimentHabits = habits.filter((h) => !h.isHero);

  const habitLines = (list: SleepHabitTipHabit[]) =>
    list.length > 0
      ? list.map((h) => `  - ${h.name}${h.description ? `: ${h.description}` : ""}`).join("\n")
      : "  (none)";

  const prompt = `You are a concise, evidence-based sleep and recovery coach. The user tracks sleep and follows personal habits.

SLEEP DATA (most recent nights first):
${sleepLines.join("\n") || "  (no nights logged yet)"}

HERO HABITS (performed consistently every day):
${habitLines(heroHabits)}

CURRENT 30-DAY EXPERIMENT HABITS:
${habitLines(experimentHabits)}

YOUR TASK:
Write exactly ONE recommendation (1–2 sentences, max 25 words total). Choose the most impactful option:
  A) Suggest a specific, concrete tweak to an EXISTING habit to improve sleep score, HRV, or duration.
  B) Suggest a NEW habit the user doesn't have yet that could meaningfully improve one of those metrics.

Rules:
- Be specific (name the habit, name the change, name the metric).
- Do not start with "I", bullet points, or labels like "Recommendation:".
- Do not repeat the user's current habit names verbatim unless you are suggesting a change to them.
- Output only the recommendation sentence(s). Nothing else.`;

  const model = getModel();
  const result = await model.generateContent(prompt);
  if (usageContext) recordGeminiUsageFromResult(result, usageContext);
  const text = result.response.text().trim();
  return text || "Try keeping a consistent bedtime — even on weekends — to stabilise your circadian rhythm and improve HRV.";
}

