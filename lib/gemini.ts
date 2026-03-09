import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env.local (get a key from https://aistudio.google.com/apikey)"
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export function getModel(systemInstruction?: string) {
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
  });
}

export async function* streamGenerateContent(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const model = getModel(systemPrompt);

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });

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
}

export async function generateSummaryAndEnrichment(
  messages: { role: string; content: string }[],
  languageName?: string
): Promise<{ summary: string; enrichmentPrompt: string }> {
  const conversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write the summary and enrichmentPrompt in ${languageName}.`
      : "";

  const model = getModel();
  const result = await model.generateContent(
    `You are summarizing a conversation for long-term memory. Return a JSON object with exactly two keys:
- "summary": A 2-4 paragraph narrative summary of the conversation. Capture key topics, decisions, and context.
- "enrichmentPrompt": An extremely compact, dense 1-sentence context (max 25 words). Capture only the most critical facts: key decisions, preferences, or user context. No filler. Example: "User weighing job change; values work-life balance; hesitant about relocation."
${languageInstruction}

Return ONLY valid JSON, no markdown or extra text.

Conversation:
${conversation}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { summary?: string; enrichmentPrompt?: string };
  return {
    summary: parsed.summary ?? "",
    enrichmentPrompt: parsed.enrichmentPrompt ?? "",
  };
}

export async function generateConceptFromUserInput(
  userInput: string,
  languageName?: string
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
  return {
    title: parsed.title ?? "Custom concept",
    summary: parsed.summary ?? "",
    enrichmentPrompt: parsed.enrichmentPrompt ?? "",
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

export async function generateConceptsFromTranscript(
  transcriptText: string,
  videoTitle?: string,
  channel?: string,
  languageName?: string,
  extractPrompt?: string
): Promise<{
  groups: { domain: string; concepts: { title: string; summary: string; enrichmentPrompt: string }[] }[];
}> {
  const languageInstruction =
    languageName && languageName !== "English"
      ? ` Write all concept titles, summaries, enrichmentPrompts, and domain names in ${languageName}.`
      : "";
  const userExtractionInstruction =
    extractPrompt && extractPrompt.trim()
      ? `\n\nUser's extraction focus: ${extractPrompt.trim()}\nPrioritize concepts that align with this.`
      : "";
  const model = getModel();
  const context = [
    videoTitle && `Video title: ${videoTitle}`,
    channel && `Channel: ${channel}`,
    "Transcript:",
    transcriptText.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await model.generateContent(
    `You are extracting clear, reusable concepts from a YouTube video transcript. The user wants to save these as custom concepts for future AI conversations.
${languageInstruction}${userExtractionInstruction}

${context}

Extract 3-8 distinct concepts from the transcript. Each concept should be a clear idea, framework, or insight that would be useful to remember for future reference. Auto-tag each concept into a domain/group (e.g. "Psychology", "Productivity", "Finance", "Career", "Health", "Learning").

Return a JSON object with exactly one key:
- "groups": An array of objects, each with:
  - "domain": A short domain name (2-4 words). Group concepts by domain.
  - "concepts": An array of objects, each with:
    - "title": Short 3-6 word title
    - "summary": 2-4 paragraph narrative
    - "enrichmentPrompt": 1-2 sentence summary for the AI coach. State the core idea, then when it's relevant (e.g., "Relevant when user is X, Y, or Z."). 25-40 words. Written so the AI can match this concept to user dilemmas.

If a concept doesn't fit a clear domain, use "General" or infer from context. Merge domains that are very similar (e.g. "Psychology" and "Behavioral Science" → "Psychology").

Return ONLY valid JSON, no markdown or extra text.
Example: {"groups":[{"domain":"Psychology","concepts":[{"title":"...","summary":"...","enrichmentPrompt":"..."}]}]}`
  );
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    groups?: { domain?: string; concepts?: { title?: string; summary?: string; enrichmentPrompt?: string }[] }[];
  };
  const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
  const groups = rawGroups
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
  return { groups };
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
  conceptGroups: { id: string; title: string; enrichmentPrompts: string[] }[] = []
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
    console.debug("[RelevantContext] LLM REQUEST:", prompt.replace(/\s+/g, " ").trim());
  }

  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (process.env.NODE_ENV === "development") {
    console.debug("[RelevantContext] LLM RESPONSE:", text.replace(/\s+/g, " ").trim());
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
  messages: { role: string; content: string }[]
): Promise<string> {
  const summary = messages
    .slice(0, 6)
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");
  const model = getModel();
  const result = await model.generateContent(
    `Based on this conversation, generate a short 3-6 word title. Return ONLY the title, no quotes or punctuation.\n\nConversation:\n${summary}`
  );
  const text = result.response.text();
  return text.trim().slice(0, 60) || "Conversation";
}

/** Minimal processing: suggest a short source/label (3-8 words) for a nugget. */
export async function suggestNuggetSource(content: string): Promise<string> {
  const trimmed = content.trim().slice(0, 500);
  if (!trimmed) return "";
  const model = getModel();
  const result = await model.generateContent(
    `Suggest a very short label (3-8 words) for this quote/snippet. Examples: "From podcast", "Productivity insight", "Book highlight". Return ONLY the label, no quotes. If unclear, return "Saved quote".\n\nContent:\n${trimmed}`
  );
  const text = result.response.text().trim();
  return text.slice(0, 60) || "Saved quote";
}

/** Minimally improve nugget text for clarity without losing original meaning. */
export async function improveNuggetText(content: string): Promise<string> {
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) return "";
  const model = getModel();
  const result = await model.generateContent(
    `Improve this quote/snippet for clarity. Fix grammar, remove filler, make it more readable. Preserve the original meaning and tone. Return ONLY the improved text, no explanations.\n\nOriginal:\n${trimmed}`
  );
  return result.response.text().trim() || trimmed;
}

/** Return meaning and context for a nugget. */
export async function explainNugget(content: string): Promise<string> {
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) return "";
  const model = getModel();
  const result = await model.generateContent(
    `Explain the meaning and context of this quote/snippet in 2-4 short sentences. What is the core idea? When might it be useful? Be concise and insightful.\n\nQuote:\n${trimmed}`
  );
  return result.response.text().trim() || "";
}
