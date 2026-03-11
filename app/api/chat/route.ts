import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSession,
  getMessages,
  appendMessage,
  createSession,
  updateSession,
  getEnrichmentPromptsWithIds,
  getLongTermMemoriesByIds,
  getCustomConceptEnrichmentPromptsWithIds,
  getCustomConceptsByIds,
  getConceptGroupsByIds,
  getConceptGroupEnrichmentWithIds,
} from "@/lib/db";
import {
  loadMentalModelsIndex,
  getIndexSummary,
  buildAllOneLinersContext,
  buildUserMentionContextForModels,
} from "@/lib/mental-models";
import { extractMentalModelIdsFromMessages, getRelevantContextBlockDelimiters } from "@/lib/chat-utils";
import { streamGenerateContent, generateTitle, predictRelevantContext } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode, type LanguageCode } from "@/lib/languages";
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
  let enrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let ltmEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let ccEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let conceptGroupEnrichment: { id: string; title: string; enrichmentPrompts: string[] }[] = [];
  let mentionedLtms: { title: string; summary: string }[] = [];
  let mentionedCustomConcepts: { title: string; summary: string }[] = [];

  if (isAnonymous || incognito) {
    messagesForModel = [
      ...bodyMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
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

    const mentionedGroupIdsToFetch =
      mentionedConceptGroupIds.length > 0 ? mentionedConceptGroupIds : [];
    const [
      existingMessages,
      enrichmentWithIdsRes,
      ccEnrichmentRes,
      mentionedLtmsRes,
      mentionedCustomConceptsRes,
      mentionedGroupsRes,
      conceptGroupEnrichmentRes,
    ] = await Promise.all([
      getMessages(sessionId!),
      getEnrichmentPromptsWithIds(userId!),
      getCustomConceptEnrichmentPromptsWithIds(userId!),
      mentionedLongTermMemoryIds.length > 0
        ? getLongTermMemoriesByIds(mentionedLongTermMemoryIds, userId!)
        : Promise.resolve([]),
      mentionedCustomConceptIds.length > 0
        ? getCustomConceptsByIds(mentionedCustomConceptIds, userId!)
        : Promise.resolve([]),
      mentionedGroupIdsToFetch.length > 0
        ? getConceptGroupsByIds(mentionedGroupIdsToFetch, userId!)
        : Promise.resolve([]),
      getConceptGroupEnrichmentWithIds(userId!),
    ]);
    conceptGroupEnrichment = conceptGroupEnrichmentRes;

    messagesForModel = [
      ...existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];
    enrichmentWithIds = [...enrichmentWithIdsRes, ...ccEnrichmentRes];
    ltmEnrichmentWithIds = enrichmentWithIdsRes;
    ccEnrichmentWithIds = ccEnrichmentRes;
    mentionedLtms = mentionedLtmsRes;
    mentionedCustomConcepts = [...mentionedCustomConceptsRes];
    if (mentionedGroupsRes.length > 0) {
      const groupConceptIds = mentionedGroupsRes.flatMap((g) => g.conceptIds);
      const groupConceptIdsSet = new Set(groupConceptIds);
      const groupConceptIdsUnique = [...groupConceptIdsSet];
      const groupConcepts =
        groupConceptIdsUnique.length > 0
          ? await getCustomConceptsByIds(groupConceptIdsUnique, userId!)
          : [];
      const mentionedCcIds = new Set(mentionedCustomConceptsRes.map((c) => c._id));
      for (const c of groupConcepts) {
        if (!mentionedCcIds.has(c._id)) {
          mentionedCustomConcepts.push(c);
          mentionedCcIds.add(c._id);
        }
      }
    }
  }

  const index = loadMentalModelsIndex(language);
  const indexSummary = getIndexSummary(language);
  const allOneLinersContext = buildAllOneLinersContext(language);

  const sentMentalModels = index.mental_models.map((m) => m.id);
  const sentLtms = [
    ...enrichmentWithIds.map((e) => e.id),
    ...mentionedLongTermMemoryIds,
    ...mentionedCustomConceptIds,
  ].filter((id, i, arr) => arr.indexOf(id) === i);
  const sentConceptGroups = [...mentionedConceptGroupIds].filter(
    (id, i, arr) => arr.indexOf(id) === i
  );

  const userMentionedModelContext =
    mentionedMentalModelIds.length > 0
      ? buildUserMentionContextForModels(mentionedMentalModelIds, language)
      : "";
  const userMentionedLtmContext =
    mentionedLtms.length > 0
      ? `USER-MENTIONED LONG-TERM MEMORIES:\n${mentionedLtms.map((ltm) => `## ${ltm.title}\n${ltm.summary}`).join("\n---\n")}`
      : "";
  const userMentionedCustomConceptContext =
    mentionedCustomConcepts.length > 0
      ? `USER-MENTIONED CUSTOM CONCEPTS:\n${mentionedCustomConcepts.map((cc) => `## ${cc.title}\n${cc.summary}`).join("\n---\n")}`
      : "";

  const userMentionBlock =
    userMentionedModelContext || userMentionedLtmContext || userMentionedCustomConceptContext
      ? `USER-MENTIONED CONTEXT (the user explicitly referenced these):\n${userMentionedModelContext ? `\nMENTAL MODELS:\n${userMentionedModelContext}` : ""}${userMentionedLtmContext ? `\n\n${userMentionedLtmContext}` : ""}${userMentionedCustomConceptContext ? `\n\n${userMentionedCustomConceptContext}` : ""}\n\n`
      : "";

  const conversationHistory = messagesForModel.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const predictedContext = await predictRelevantContext(
    message,
    conversationHistory,
    index.mental_models.map((m) => ({
      id: m.id,
      name: m.name,
      oneLiner: m.description.split("\n")[0]?.trim() ?? m.description,
    })),
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

  const ltmToInclude = predLtmIds.size > 0
    ? ltmEnrichmentWithIds.filter((e) => predLtmIds.has(e.id))
    : ltmEnrichmentWithIds;
  const ccToInclude = predCcIds.size > 0
    ? ccEnrichmentWithIds.filter((e) => predCcIds.has(e.id))
    : ccEnrichmentWithIds;
  const cgToInclude = predCgIds.size > 0
    ? conceptGroupEnrichment.filter((g) => predCgIds.has(g.id))
    : conceptGroupEnrichment;

  const ltmBlock =
    ltmToInclude.length > 0
      ? `LONG-TERM MEMORIES (use [[memory:ID]] when referencing):\n${ltmToInclude.map((e) => `- [${e.id}]: ${e.enrichmentPrompt}`).join("\n")}\n\n`
      : "";
  const ccBlock =
    ccToInclude.length > 0
      ? `CUSTOM CONCEPTS (use [[concept:ID]] when referencing):\n${ccToInclude.map((e) => `- [${e.id}]: ${e.enrichmentPrompt}`).join("\n")}\n\n`
      : "";
  const cgBlock =
    cgToInclude.length > 0
      ? `CONCEPT GROUPS / DOMAINS (use [[group:ID]] when referencing):\n${cgToInclude.map((g) => `- [${g.id}] ${g.title}: ${g.enrichmentPrompts.join(" | ")}`).join("\n")}\n\n`
      : "";
  const enrichmentBlock = ltmBlock + ccBlock + cgBlock;

  const mentalModelsBlock =
    allOneLinersContext.length > 0
      ? `\n\nALL MENTAL MODELS (id | name | one-liner):\n${allOneLinersContext}`
      : "";

  const languageInstruction =
    language !== "en"
      ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}. All your responses, follow-up options, and references must be in that language.`
      : "";

  const userTypeStylePrompt = getUserTypeStylePrompt(userType as UserTypeId);
  const conversationStyleInstruction =
    userTypeStylePrompt
      ? `\n\nCONVERSATION STYLE: ${userTypeStylePrompt}`
      : "";

  const indexContent = (indexSummary + mentalModelsBlock).trim() || "(none)";
  const contextContent = (userMentionBlock + enrichmentBlock).trim() || "(none)";
  const optionsStyleInstruction =
    getUserTypeOptionsPrompt(userType as UserTypeId) || "Natural, conversational first-person.";
  const fullSystemPrompt =
    SYSTEM_PROMPT.replace("[Insert Index Here]", indexContent)
      .replace("[Insert Context Here]", contextContent)
      .replace("[Options Style Instruction]", optionsStyleInstruction) +
    languageInstruction +
    conversationStyleInstruction;

  const ltmIdToTitle = new Map(ltmEnrichmentWithIds.map((e) => [e.id, e.title ?? e.enrichmentPrompt?.slice(0, 40) ?? "Memory"]));
  const ccIdToTitle = new Map(ccEnrichmentWithIds.map((e) => [e.id, e.title ?? e.enrichmentPrompt?.slice(0, 40) ?? "Concept"]));
  const cgIdToTitle = new Map(conceptGroupEnrichment.map((g) => [g.id, g.title]));
  const relevantContextResult = {
    mentalModels: predictedContext.mentalModels,
    longTermMemories: predictedContext.longTermMemories.map((m) => ({ ...m, title: ltmIdToTitle.get(m.id) ?? "Memory" })),
    customConcepts: predictedContext.customConcepts.map((c) => ({
      ...c,
      title: ccIdToTitle.get(c.id) ?? cgIdToTitle.get(c.id) ?? "Concept",
    })),
    conceptGroups: predictedContext.conceptGroups.map((g) => ({
      ...g,
      title: cgIdToTitle.get(g.id) ?? ccIdToTitle.get(g.id) ?? "Domain",
    })),
  };

  const { start: ctxStart, end: ctxEnd } = getRelevantContextBlockDelimiters();
  const contextBlockForStream = `${ctxStart}\n${JSON.stringify(relevantContextResult)}\n${ctxEnd}`;

  if (process.env.NODE_ENV === "development") {
    const requestText = messagesForModel.map((m) => `${m.role}: ${m.content}`).join(" | ");
    console.debug("[Chat] LLM REQUEST:", requestText.replace(/\s+/g, " ").trim());
  }

  try {
    if (!isAnonymous && !incognito && sessionId) {
      await appendMessage(sessionId, "user", rawMessage ?? message);
    }

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(contextBlockForStream));
          for await (const chunk of streamGenerateContent(
            fullSystemPrompt,
            messagesForModel
          )) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          if (process.env.NODE_ENV === "development") {
            console.debug("[Chat] LLM RESPONSE:", fullResponse.replace(/\s+/g, " ").trim());
          }
          const contextBlock = `\n---RELEVANT-CONTEXT---\n${JSON.stringify(relevantContextResult)}`;
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
        "X-Context-Sent-Mental-Models": JSON.stringify(sentMentalModels),
        "X-Context-Sent-LTMs": JSON.stringify(sentLtms),
        "X-Context-Sent-Concept-Groups": JSON.stringify(sentConceptGroups),
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
