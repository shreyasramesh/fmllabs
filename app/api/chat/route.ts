import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSession,
  getMessages,
  appendMessage,
  createSession,
  updateSession,
  getEnrichmentPromptsWithIds,
  getCustomConceptEnrichmentPromptsWithIds,
  getConceptGroupEnrichmentWithIds,
  getUserMentalModels,
} from "@/lib/db";
import {
  loadMentalModelsIndex,
  getIndexSummary,
} from "@/lib/mental-models";
import {
  extractMentalModelIdsFromMessages,
  getRelevantContextBlockDelimiters,
  type RelevantContext,
} from "@/lib/chat-utils";
import { streamGenerateContent, generateTitle, predictRelevantContext } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode, type LanguageCode } from "@/lib/languages";
import {
  buildCitedContextFromText,
  diffCitationsAgainstPredicted,
  hasCitationMismatches,
  normalizeCitationAlignmentPolicy,
  sanitizeDisallowedCitations,
} from "@/lib/citation-alignment";
import {
  getUserTypeStylePrompt,
  getUserTypeOptionsPrompt,
  isValidUserTypeId,
  type UserTypeId,
} from "@/lib/user-types";

const SYSTEM_PROMPT = `You are a decision-making coach—a wise friend or a clearer version of the user talking to themselves. Your role is to help users think more deeply about their decisions by exploring consequences using Socratic questioning.

## Core Behavior & Tone
- **Be Socratic:** Ask thoughtful questions rather than providing direct answers. Help the user arrive at their own conclusions.
- **Conversational & Warm:** Speak like a supportive friend, not a textbook. Be informal but insightful.
- **Explore Consequences Naturally:** Prompt users to think ahead using varied phrasing (e.g., "then what happens?", "so what would that look like?", "what's the next step?"). 
- **Drive Action:** Help the user figure out "what you can do next" by asking questions that clarify their immediate next steps.

## Recognizing the Conclusion
- **Synthesize & Close:** When the user lands on a clear decision, identifies a concrete next step, or expresses that they have the clarity they need, shift your stance. 
- **Stop Exploring:** Drop the Socratic questioning. Do not force them to dig deeper.
- **Validate:** Acknowledge their conclusion, briefly summarize the key insight that got them there, and offer a supportive closing statement.

## Formatting & Readability
- **Keep it scannable:** Use short paragraphs (2–3 sentences max). Avoid walls of text. 
- **Emphasis:** Use markdown **bolding** for key phrases to guide the eye.
- **Lists:** Use standard markdown bullet points. NEVER use asterisks as decorative bullets.
- **Conciseness:** Get straight to the point while maintaining your warm tone.

## System Tagging & Syntax Strict Rules
- **Mental Models:** When highly relevant, use the exact ID from the index. Format strictly as [[model_id]]. 
    - *Relevance policy:* Use as many mental model references as needed when they genuinely help the current conversation. Do not force or pad references when they are not meaningfully relevant.
- **Memories & Concepts:** Reference saved context using these formats:
    - Long-term memories: [[memory:ID]]
    - Custom concepts: [[concept:ID]]
    - Concept groups: [[group:ID]]

## Output Requirement: Follow-up Options
ALWAYS end EVERY response with exactly 4 follow-up options the user can choose from. 

- **Voice:** Phrased in the USER'S VOICE (first-person), as if they are an internal realization or a chosen direction.
- **Nature of Options:** These must NOT be questions. They are "thought paths" or "declarative statements" that the user can select to go deeper or pivot. 
- **Content:** Each option should represent a potential answer to your Socratic questions or a specific path of exploration (e.g., focusing on risks, focusing on values, or deciding to act).
- **Exception for Closures:** If the user has reached a conclusion, the options must reflect action, commitment, or closure (e.g., "I'm ready to take the first step," "I want to save this plan").

Format them exactly like this, on a new line at the very end of your response:

---OPTIONS---
[First-person declarative path 1]
[First-person declarative path 2]
[First-person declarative path 3]
[First-person declarative path 4]

***

MENTAL MODELS INDEX:
[Insert Index Here]

USER CONTEXT (Memories, Concepts, Groups):
[Insert Context Here]
`;

const PERSPECTIVE_CARD_SYSTEM_PROMPT = `You are a guide helping the user dive deeper and gain new perspectives. They have chosen a perspective card—a lens designed to shift how they look at something (art, a situation, an idea). Your job is to help them *learn something new* and *see differently*.

## Your Role
- **Deepen, don't summarize:** Use the card as a lens to open up discovery. Ask questions that help the user notice what they might have missed, connect dots, or reframe what they're looking at.
- **Guide toward insight:** Gently steer the conversation so the user arrives at a fresh perspective or realization—not just surface-level engagement.
- **Be curious and warm:** Conversational, supportive, never lecturing. Reflect back what they share and probe in directions that unlock new understanding.
- **Meet them where they are:** If they name something specific (an artwork, a decision, a memory), use the card to explore it. If they're unsure, offer a concrete way to start—e.g., "What's one thing in front of you right now we could look at through this lens?"
- **Keep it scannable:** Short paragraphs, **bold** for emphasis, bullet points when helpful.

## Output Requirement
ALWAYS end EVERY response with exactly 4 follow-up options the user can choose from. Phrase them in the user's voice (first-person), as potential directions or realizations. Format:

---OPTIONS---
[Option 1]
[Option 2]
[Option 3]
[Option 4]
`;

const PERSPECTIVE_CARD_CONTEXT_ADDITION = `ACTIVE PERSPECTIVE CARD: The user wants to explore through this lens. Use it to help them dive deeper and gain new perspectives. Do not repeat the prompt verbatim—weave it into questions and reflections that lead to discovery.

"[Insert Card Prompt Here]"

`;

function compactPromptText(value: string | undefined, maxLen = 220): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .trim()
    .slice(0, maxLen);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatDevLogBlock(title: string, content: string): string {
  const divider = "=".repeat(28);
  return `\n${divider} ${title} ${divider}\n${content}\n${"=".repeat(
    divider.length * 2 + title.length + 2
  )}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  let isAnonymous = !userId;
  let incognito = false;

  let sessionId: string | undefined;
  let message: string;
  let rawMessage: string | undefined;
  let language: string = "en";
  let userType: string = "millennial";
  let mentionedMentalModelIds: string[] = [];
  let mentionedLongTermMemoryIds: string[] = [];
  let mentionedCustomConceptIds: string[] = [];
  let mentionedConceptGroupIds: string[] = [];
  let bodyMessages: { role: string; content: string }[] = [];
  let prependMessages: { role: string; content: string }[] = [];
  let activeCardPrompt: string | undefined;
  let activeCardName: string | undefined;

  try {
    const body = await request.json();
    if (typeof body.language === "string" && isValidLanguageCode(body.language)) {
      language = body.language;
    }
    if (typeof body.userType === "string" && isValidUserTypeId(body.userType)) {
      userType = body.userType;
    }
    sessionId = body.sessionId;
    incognito = body.incognito === true;
    message = body.message;
    rawMessage =
      typeof body.rawMessage === "string" ? body.rawMessage : undefined;
    if (Array.isArray(body.mentionedMentalModelIds)) {
      mentionedMentalModelIds = body.mentionedMentalModelIds.filter(
        (id: unknown) => typeof id === "string"
      );
    }
    if (Array.isArray(body.mentionedLongTermMemoryIds)) {
      mentionedLongTermMemoryIds = body.mentionedLongTermMemoryIds.filter(
        (id: unknown) => typeof id === "string"
      );
    }
    if (Array.isArray(body.mentionedCustomConceptIds)) {
      mentionedCustomConceptIds = body.mentionedCustomConceptIds.filter(
        (id: unknown) => typeof id === "string"
      );
    }
    if (Array.isArray(body.mentionedConceptGroupIds)) {
      mentionedConceptGroupIds = body.mentionedConceptGroupIds.filter(
        (id: unknown) => typeof id === "string"
      );
    }
    if (Array.isArray(body.messages)) {
      bodyMessages = body.messages.filter(
        (m: unknown) =>
          m &&
          typeof m === "object" &&
          "role" in m &&
          "content" in m &&
          typeof (m as { role: unknown; content: unknown }).role === "string" &&
          typeof (m as { role: unknown; content: unknown }).content === "string"
      );
    }
    if (Array.isArray(body.prependMessages)) {
      prependMessages = body.prependMessages.filter(
        (m: unknown) =>
          m &&
          typeof m === "object" &&
          "role" in m &&
          "content" in m &&
          typeof (m as { role: unknown; content: unknown }).role === "string" &&
          typeof (m as { role: unknown; content: unknown }).content === "string"
      );
    }
    if (typeof body.activeCardPrompt === "string" && body.activeCardPrompt.trim()) {
      activeCardPrompt = body.activeCardPrompt.trim();
      activeCardName = typeof body.activeCardName === "string" && body.activeCardName.trim()
        ? body.activeCardName.trim()
        : "Perspective card";
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let messagesForModel: { role: "user" | "assistant"; content: string }[];
  let ltmEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let ccEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let conceptGroupEnrichment: { id: string; title: string; enrichmentPrompts: string[] }[] = [];
  let userMentalModels: Awaited<ReturnType<typeof getUserMentalModels>> = [];

  if (isAnonymous || incognito) {
    const history = bodyMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    const prepended = prependMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    messagesForModel = [
      ...prepended,
      ...history,
      { role: "user" as const, content: message },
    ];
  } else {
    let session = sessionId ? await getSession(sessionId, userId!) : null;

    if (!session && sessionId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session) {
      const newSession = await createSession(userId!);
      sessionId = newSession._id;
    }

    const [
      existingMessages,
      ltmEnrichmentWithIdsRes,
      ccEnrichmentRes,
      conceptGroupEnrichmentRes,
      userMentalModelsRes,
    ] = await Promise.all([
      getMessages(sessionId!),
      getEnrichmentPromptsWithIds(userId!),
      getCustomConceptEnrichmentPromptsWithIds(userId!),
      getConceptGroupEnrichmentWithIds(userId!),
      getUserMentalModels(userId!),
    ]);
    conceptGroupEnrichment = conceptGroupEnrichmentRes;
    userMentalModels = userMentalModelsRes;

    const prepended = prependMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    if (prepended.length > 0 && sessionId) {
      for (const m of prepended) {
        await appendMessage(sessionId, m.role as "user" | "assistant", m.content);
      }
    }
    messagesForModel = [
      ...prepended,
      ...existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];
    ltmEnrichmentWithIds = ltmEnrichmentWithIdsRes;
    ccEnrichmentWithIds = ccEnrichmentRes;
  }

  const isLightweight =
    !!activeCardPrompt && messagesForModel.length <= 1;

  let fullSystemPrompt: string;
  let contextBlockForStream: string;
  let predictedContextResult: RelevantContext;
  let mmIdToName = new Map<string, string>();
  let ltmIdToTitle = new Map<string, string>();
  let ccIdToTitle = new Map<string, string>();
  let cgIdToTitle = new Map<string, string>();

  if (isLightweight) {
    const langInstr =
      language !== "en"
        ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}.`
        : "";
    fullSystemPrompt =
      PERSPECTIVE_CARD_SYSTEM_PROMPT +
      "\n\nPERSPECTIVE CARD PROMPT:\n" +
      activeCardPrompt! +
      langInstr;
    predictedContextResult = {
      mentalModels: [],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
      perspectiveCards: activeCardName && activeCardPrompt
        ? [{ id: "active", title: activeCardName, reason: "Applied perspective", prompt: activeCardPrompt }]
        : [],
    };
    const { start: ctxStart, end: ctxEnd } = getRelevantContextBlockDelimiters();
    contextBlockForStream = `${ctxStart}\n${JSON.stringify({
      predictedContext: predictedContextResult,
    })}\n${ctxEnd}`;
  } else {
  const index = loadMentalModelsIndex(language);
  let indexSummary = getIndexSummary(language);
  mmIdToName = new Map(index.mental_models.map((m) => [m.id, m.name]));
  const mmById = new Map(index.mental_models.map((m) => [m.id, m]));
  for (const m of userMentalModels) {
    mmIdToName.set(m.id, m.name);
    mmById.set(m.id, {
      id: m.id,
      name: m.name,
      path: "",
      description: m.one_liner?.trim() || m.quick_introduction,
    } as (typeof index.mental_models)[0]);
    indexSummary += `\n- ${m.id}: ${m.name} — ${m.one_liner?.trim() || m.quick_introduction}`;
  }
  const ltmById = new Map(ltmEnrichmentWithIds.map((e) => [e.id, e]));
  const ccById = new Map(ccEnrichmentWithIds.map((e) => [e.id, e]));
  const cgById = new Map(conceptGroupEnrichment.map((g) => [g.id, g]));

  const mentionedMmBlock =
    mentionedMentalModelIds.length > 0
      ? `USER-MENTIONED MENTAL MODELS:\n${mentionedMentalModelIds
          .map((id, index) => {
            const mm = mmById.get(id);
            if (!mm) return null;
            const oneLiner = mm.description.split("\n")[0]?.trim() ?? mm.description;
            return `- rank:${index + 1} | id:${id} | name:"${compactPromptText(mm.name, 80)}" | one_liner:"${compactPromptText(oneLiner)}"`;
          })
          .filter(Boolean)
          .join("\n")}`
      : "";
  const mentionedLtmBlock =
    mentionedLongTermMemoryIds.length > 0
      ? `USER-MENTIONED LONG-TERM MEMORIES:\n${mentionedLongTermMemoryIds
          .map((id, index) => {
            const ltm = ltmById.get(id);
            if (!ltm) return `- rank:${index + 1} | id:${id} | title:"Memory"`;
            return `- rank:${index + 1} | id:${id} | title:"${compactPromptText(
              ltm.title ?? "Memory",
              80
            )}" | enrichment:"${compactPromptText(ltm.enrichmentPrompt, 220)}"`;
          })
          .join("\n")}`
      : "";
  const mentionedCcBlock =
    mentionedCustomConceptIds.length > 0
      ? `USER-MENTIONED CUSTOM CONCEPTS:\n${mentionedCustomConceptIds
          .map((id, index) => {
            const cc = ccById.get(id);
            if (!cc) return `- rank:${index + 1} | id:${id} | title:"Concept"`;
            return `- rank:${index + 1} | id:${id} | title:"${compactPromptText(
              cc.title ?? "Concept",
              80
            )}" | enrichment:"${compactPromptText(cc.enrichmentPrompt, 220)}"`;
          })
          .join("\n")}`
      : "";
  const mentionedCgBlock =
    mentionedConceptGroupIds.length > 0
      ? `USER-MENTIONED CONCEPT GROUPS:\n${mentionedConceptGroupIds
          .map((id, index) => {
            const cg = cgById.get(id);
            if (!cg) return `- rank:${index + 1} | id:${id} | title:"Domain"`;
            const prompts = cg.enrichmentPrompts
              .map((p) => compactPromptText(p, 100))
              .filter(Boolean)
              .join(" | ");
            return `- rank:${index + 1} | id:${id} | title:"${compactPromptText(
              cg.title,
              80
            )}" | concept_enrichment:"${prompts}"`;
          })
          .join("\n")}`
      : "";
  const userMentionSections = [
    mentionedMmBlock,
    mentionedLtmBlock,
    mentionedCcBlock,
    mentionedCgBlock,
  ].filter((s) => s.trim().length > 0);
  const userMentionBlock =
    userMentionSections.length > 0
      ? `USER-MENTIONED CONTEXT (explicitly referenced by user):\n${userMentionSections.join(
          "\n\n"
        )}\n\n`
      : "";

  const conversationHistory = messagesForModel.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const mentalModelCandidates = [
    ...index.mental_models.map((m) => ({
      id: m.id,
      name: m.name,
      oneLiner: m.description.split("\n")[0]?.trim() ?? m.description,
    })),
    ...userMentalModels.map((m) => ({
      id: m.id,
      name: m.name,
      oneLiner: m.one_liner?.trim() || m.quick_introduction.split(/[.!?]/)[0]?.trim() || m.quick_introduction,
    })),
  ];
  const predictedContext = await predictRelevantContext(
    message,
    conversationHistory,
    mentalModelCandidates,
    ltmEnrichmentWithIds,
    ccEnrichmentWithIds,
    conceptGroupEnrichment
  ).catch((e) => {
    console.error("predictRelevantContext failed:", e);
    return {
      mentalModels: [] as { id: string; reason: string }[],
      longTermMemories: [] as { id: string; reason: string }[],
      customConcepts: [] as { id: string; reason: string }[],
      conceptGroups: [] as { id: string; reason: string }[],
    };
  });

  const predLtmIds = new Set(predictedContext.longTermMemories.map((m) => m.id));
  const predCcIds = new Set(predictedContext.customConcepts.map((c) => c.id));
  const predCgIds = new Set(predictedContext.conceptGroups.map((g) => g.id));
  const predMmIds = new Set(predictedContext.mentalModels.map((m) => m.id));
  const predictedMmReasonById = new Map(
    predictedContext.mentalModels.map((m) => [m.id, m.reason])
  );
  const predictedLtmReasonById = new Map(
    predictedContext.longTermMemories.map((m) => [m.id, m.reason])
  );
  const predictedCcReasonById = new Map(
    predictedContext.customConcepts.map((m) => [m.id, m.reason])
  );
  const predictedCgReasonById = new Map(
    predictedContext.conceptGroups.map((m) => [m.id, m.reason])
  );

  // Scope prompt context strictly to predicted relevant items.
  const mmToInclude = [
    ...index.mental_models.filter((m) => predMmIds.has(m.id)),
    ...userMentalModels
      .filter((m) => predMmIds.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.one_liner?.trim() || m.quick_introduction,
      })),
  ];
  const ltmToInclude = ltmEnrichmentWithIds.filter((e) => predLtmIds.has(e.id));
  const ccToInclude = ccEnrichmentWithIds.filter((e) => predCcIds.has(e.id));
  const cgToInclude = conceptGroupEnrichment.filter((g) => predCgIds.has(g.id));

  const mmBlock =
    mmToInclude.length > 0
      ? `PREDICTED MENTAL MODELS (reference format: [[model_id]]):\n${mmToInclude
          .map((m, index) => {
            const oneLiner = m.description.split("\n")[0]?.trim() ?? m.description;
            return `- rank:${index + 1} | id:${m.id} | name:"${compactPromptText(
              m.name,
              80
            )}" | reason:"${compactPromptText(
              predictedMmReasonById.get(m.id) ?? "predicted relevant",
              80
            )}" | one_liner:"${compactPromptText(oneLiner)}"`;
          })
          .join("\n")}\n\n`
      : "";

  const ltmBlock =
    ltmToInclude.length > 0
      ? `PREDICTED LONG-TERM MEMORIES (reference format: [[memory:ID]]):\n${ltmToInclude
          .map(
            (e, index) =>
              `- rank:${index + 1} | id:${e.id} | title:"${compactPromptText(
                e.title ?? "Memory",
                80
              )}" | reason:"${compactPromptText(
                predictedLtmReasonById.get(e.id) ?? "predicted relevant",
                80
              )}" | enrichment:"${compactPromptText(e.enrichmentPrompt, 260)}"`
          )
          .join("\n")}\n\n`
      : "";
  const ccBlock =
    ccToInclude.length > 0
      ? `PREDICTED CUSTOM CONCEPTS (reference format: [[concept:ID]]):\n${ccToInclude
          .map(
            (e, index) =>
              `- rank:${index + 1} | id:${e.id} | title:"${compactPromptText(
                e.title ?? "Concept",
                80
              )}" | reason:"${compactPromptText(
                predictedCcReasonById.get(e.id) ?? "predicted relevant",
                80
              )}" | enrichment:"${compactPromptText(e.enrichmentPrompt, 260)}"`
          )
          .join("\n")}\n\n`
      : "";
  const cgBlock =
    cgToInclude.length > 0
      ? `PREDICTED CONCEPT GROUPS (reference format: [[group:ID]]):\n${cgToInclude
          .map((g, index) => {
            const prompts = g.enrichmentPrompts
              .map((p) => compactPromptText(p, 120))
              .filter(Boolean)
              .join(" | ");
            return `- rank:${index + 1} | id:${g.id} | title:"${compactPromptText(
              g.title,
              80
            )}" | reason:"${compactPromptText(
              predictedCgReasonById.get(g.id) ?? "predicted relevant",
              80
            )}" | concept_enrichment:"${prompts}"`;
          })
          .join("\n")}\n\n`
      : "";
  const enrichmentSections = [mmBlock, ltmBlock, ccBlock, cgBlock].filter(
    (s) => s.trim().length > 0
  );
  const enrichmentBlock =
    enrichmentSections.length > 0
      ? `AVAILABLE CONTEXT FOR THIS TURN (only predicted relevant items):\n${enrichmentSections.join(
          ""
        )}`
      : "AVAILABLE CONTEXT FOR THIS TURN: (none predicted)";
  const citationFormatGuide = `REFERENCE FORMAT GUIDE:\n- Mental model: [[model_id]]\n- Long-term memory: [[memory:ID]]\n- Custom concept: [[concept:ID]]\n- Concept group: [[group:ID]]`;

  const languageInstruction =
    language !== "en"
      ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}. All your responses, follow-up options, and references must be in that language.`
      : "";

  const userTypeStylePrompt = getUserTypeStylePrompt(userType as UserTypeId);
  const conversationStyleInstruction =
    userTypeStylePrompt
      ? `\n\nCONVERSATION STYLE: ${userTypeStylePrompt}`
      : "";

  const indexContent = indexSummary.trim() || "(none)";
  const cardContextBlock = activeCardPrompt
    ? PERSPECTIVE_CARD_CONTEXT_ADDITION.replace(
        "[Insert Card Prompt Here]",
        activeCardPrompt
      )
    : "";
  const contextContent = (
    cardContextBlock +
    citationFormatGuide +
    "\n\n" +
    userMentionBlock +
    enrichmentBlock
  ).trim() || "(none)";
  const optionsStyleInstruction =
    getUserTypeOptionsPrompt(userType as UserTypeId) || "Natural, conversational first-person.";
  fullSystemPrompt =
    SYSTEM_PROMPT.replace("[Insert Index Here]", indexContent)
      .replace("[Insert Context Here]", contextContent)
      .replace("[Options Style Instruction]", optionsStyleInstruction) +
    languageInstruction +
    conversationStyleInstruction;

  ltmIdToTitle = new Map(
    ltmEnrichmentWithIds.map((e) => [
      e.id,
      e.title ?? e.enrichmentPrompt?.slice(0, 40) ?? "Memory",
    ])
  );
  ccIdToTitle = new Map(
    ccEnrichmentWithIds.map((e) => [
      e.id,
      e.title ?? e.enrichmentPrompt?.slice(0, 40) ?? "Concept",
    ])
  );
  cgIdToTitle = new Map(conceptGroupEnrichment.map((g) => [g.id, g.title]));
  predictedContextResult = {
    mentalModels: predictedContext.mentalModels,
    longTermMemories: predictedContext.longTermMemories.map((m) => ({
      ...m,
      title: ltmIdToTitle.get(m.id) ?? "Memory",
    })),
    customConcepts: predictedContext.customConcepts.map((c) => ({
      ...c,
      title: ccIdToTitle.get(c.id) ?? cgIdToTitle.get(c.id) ?? "Concept",
    })),
    conceptGroups: predictedContext.conceptGroups.map((g) => ({
      ...g,
      title: cgIdToTitle.get(g.id) ?? ccIdToTitle.get(g.id) ?? "Domain",
    })),
    perspectiveCards: activeCardName && activeCardPrompt
      ? [{ id: "active", title: activeCardName, reason: "Applied perspective", prompt: activeCardPrompt }]
      : [],
  };
  const contextEnvelopeForStream = {
    predictedContext: predictedContextResult,
  };

  const { start: ctxStart, end: ctxEnd } = getRelevantContextBlockDelimiters();
  contextBlockForStream = `${ctxStart}\n${JSON.stringify(
    contextEnvelopeForStream
  )}\n${ctxEnd}`;
  }

  const citationAlignmentPolicy = normalizeCitationAlignmentPolicy(
    process.env.CITATION_ALIGNMENT_POLICY
  );

  const predictedMentalModelIds = predictedContextResult.mentalModels.map(
    (m) => m.id
  );
  const predictedLtmIds = predictedContextResult.longTermMemories.map((m) => m.id);
  const predictedCustomConceptIds = predictedContextResult.customConcepts.map(
    (c) => c.id
  );
  const predictedConceptGroupIds = predictedContextResult.conceptGroups.map(
    (g) => g.id
  );

  // Gemini requires the first message to be from the user. If we have prepended
  // assistant messages, inject them into the system prompt and strip from history.
  let messagesForGemini = messagesForModel;
  let systemPromptForGemini = fullSystemPrompt;
  while (messagesForGemini[0]?.role === "assistant") {
    const m = messagesForGemini[0];
    systemPromptForGemini =
      `You have just said the following to the user:\n\n${m.content}\n\nThe user is now responding. Continue the conversation naturally.\n\n` +
      systemPromptForGemini;
    messagesForGemini = messagesForGemini.slice(1);
  }

  if (process.env.NODE_ENV === "development") {
    const requestText = messagesForGemini
      .map(
        (m, index) =>
          `${index + 1}. ${m.role.toUpperCase()}\n${m.content.trim()}`
      )
      .join("\n\n");
    console.debug(formatDevLogBlock("[Chat] LLM REQUEST", requestText));
  }

  try {
    if (!isAnonymous && !incognito && sessionId) {
      await appendMessage(sessionId, "user", rawMessage ?? message);
    }

    const encoder = new TextEncoder();
    let fullResponse = "";
    let citedContextResult: RelevantContext = {
      mentalModels: [],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(contextBlockForStream));
          for await (const chunk of streamGenerateContent(
            systemPromptForGemini,
            messagesForGemini
          )) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          if (process.env.NODE_ENV === "development") {
            console.debug(
              formatDevLogBlock("[Chat] LLM RESPONSE", fullResponse.trim())
            );
          }
          const citationLabels = {
            mentalModelLabels: mmIdToName,
            longTermMemoryLabels: ltmIdToTitle,
            customConceptLabels: ccIdToTitle,
            conceptGroupLabels: cgIdToTitle,
          };
          citedContextResult = buildCitedContextFromText(fullResponse, citationLabels);
          const citationDiff = diffCitationsAgainstPredicted(
            predictedContextResult,
            citedContextResult
          );
          if (hasCitationMismatches(citationDiff)) {
            if (citationAlignmentPolicy === "warn" || citationAlignmentPolicy === "enforce") {
              console.warn(
                formatDevLogBlock(
                  "[CitationAlignment] MISMATCH",
                  prettyJson(citationDiff)
                )
              );
            }
            if (citationAlignmentPolicy === "enforce") {
              const sanitized = sanitizeDisallowedCitations(
                fullResponse,
                predictedContextResult,
                citationLabels
              );
              if (sanitized !== fullResponse) {
                fullResponse = sanitized;
                citedContextResult = buildCitedContextFromText(fullResponse, citationLabels);
              }
            }
          }
          const contextEnvelopeForPersist = {
            predictedContext: predictedContextResult,
            citedContext: citedContextResult,
          };
          const contextBlock = `\n---RELEVANT-CONTEXT---\n${JSON.stringify(
            contextEnvelopeForPersist
          )}`;
          if (!isAnonymous && !incognito && sessionId && userId) {
            await appendMessage(sessionId, "assistant", fullResponse + contextBlock);
            const allMessages = [
              ...messagesForModel,
              { role: "assistant", content: fullResponse },
            ];
            const mentalModelTags = extractMentalModelIdsFromMessages(allMessages);
            generateTitle(allMessages)
              .then((title) =>
                updateSession(sessionId, userId, { title, mentalModelTags })
              )
              .catch((e) => console.error("Title update failed:", e));
          }
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode("\n\nSorry, something went wrong. Please try again.")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Context-Sent-Mental-Models": JSON.stringify(predictedMentalModelIds),
        "X-Context-Sent-LTMs": JSON.stringify(predictedLtmIds),
        "X-Context-Sent-Concept-Groups": JSON.stringify(predictedConceptGroupIds),
        "X-Context-Sent-Custom-Concepts": JSON.stringify(predictedCustomConceptIds),
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
