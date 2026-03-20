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
  getUserSettings,
} from "@/lib/db";
import {
  loadMentalModelsIndex,
  getIndexSummary,
} from "@/lib/mental-models";
import { getFiguresByIds, getFigureById, type FamousFigure } from "@/lib/famous-figures";
import {
  extractMentalModelIdsFromMessages,
  getRelevantContextBlockDelimiters,
  type RelevantContext,
} from "@/lib/chat-utils";
import { streamGenerateContent, generateContent, generateTitle, predictRelevantContext } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode, type LanguageCode } from "@/lib/languages";
import { type MentorResponse } from "@/lib/chat-utils";
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
import { recordUsageEvent, computeGeminiCost, recordMongoUsageRequest } from "@/lib/usage";

const SYSTEM_PROMPT = `You are an empathetic confidant, anxiety-relief guide, and wise friend. Your role is to help users talk through their anxieties by providing grounding facts, validating their emotions, and gently helping them find clarity and calm.

## Opening & Length (strict)
- **One-line opening only:** Start with a single short sentence of validation or acknowledgment (e.g. one line). Do **not** use multi-sentence or multi-paragraph warm-up intros. No stacked metaphors or long empathy preambles before you get to the point.
- **Digestible size:** Aim for roughly **half** the length of a typical long chat reply. Prefer fewer, tighter paragraphs over exhaustive exploration in one turn. The user should be able to read your answer in under a minute when possible.

## Core Behavior & Tone
- **Empathetic Validation:** Speak like a deeply supportive, non-judgmental friend. Validate their emotions briefly, then move on—never make them feel silly for being anxious.
- **Fact-Based Reassurance:** When the user is anxious about a specific scenario, ground them with clear, logical facts (e.g., animal behavior, technology limits, probabilities). Answer factual questions directly and clearly to help de-escalate their worry.
- **Absolve Misplaced Guilt:** If the user is blaming themselves for something outside their control, use gentle logic to explain why it is not their fault. 
- **Gentle Exploration:** Once you have provided factual reassurance, use light Socratic questioning to help them process the event or figure out their next step (e.g., "How are you feeling now that you know the facts?", "What would help you let this go?"). 

## Recognizing the Conclusion
- **Synthesize & Close:** When the user lands on a clear realization, accepts the reassurance, or expresses that their anxiety has lifted, shift your stance. 
- **Stop Exploring:** Drop the questioning. Do not force them to dig deeper if they are ready to move on.
- **Validate:** Acknowledge their relief or conclusion, briefly summarize the grounding fact that helped them get there, and offer a supportive closing statement.

## Formatting & Readability
- **Keep it scannable:** Use short paragraphs (1–2 sentences preferred; avoid 4+ sentence blocks). Avoid walls of text. 
- **Emphasis:** Use markdown **bolding** for key phrases to guide the eye.
- **Lists:** Use standard markdown bullet points to break down facts or logic when truly needed. NEVER use asterisks as decorative bullets.
- **Conciseness:** Get straight to the point while maintaining your warm tone.

## System Tagging & Syntax Strict Rules
- **Mental Models:** When a model genuinely fits **this** turn, you may cite it with the exact ID from the index: [[model_id]].
    - Do **not** reference mental models in most turns; only when they clearly sharpen the user's situation. Never stack many model name-drops in one reply.
    - **Always explain in plain language tied to their context:** After or alongside a citation, briefly say what the idea *means for them right here*—as if you are teaching the insight through their story, not listing textbook labels. Only cite a model when you can weave that explanation naturally into the conversation.
- **Memories & Concepts:** Reference saved context using these formats:
    - Long-term memories: [[memory:ID]]
    - Custom concepts: [[concept:ID]]
    - Concept groups: [[group:ID]]

## Optional: Journal Checkpoint
When the conversation reaches a reflective moment—the user lands on a conclusion, expresses a realization, or identifies a concrete next step—you MAY include a journal checkpoint. This is OPTIONAL; omit it if the moment does not warrant it. Include at most 2 journal checkpoints per conversation total; if you have already included 2, do not add another. **Only include a journal checkpoint in your final or concluding response**—never in intermediate responses during an ongoing back-and-forth.

If you include it, place it AFTER your main text and BEFORE ---OPTIONS---. Format exactly (always include all three lines; the closing ---END-JOURNAL-CHECKPOINT--- is required so the app can parse it):

---JOURNAL-CHECKPOINT---
{"prompt": "Today I realized _____", "options": ["option 1", "option 2", "option 3", "option 4"]}
---END-JOURNAL-CHECKPOINT---

- **prompt:** One or more fill-in-the-blank sentences (use _____ for each blank). First-person, reflective. You may use multiple blanks, e.g. "Today I realized _____ and I want to _____".
- **options:** 3–6 short phrases the user can select for each blank. First-person.

Example prompts: "Today I realized _____", "What I want to remember is _____", "I realized _____ and tomorrow I will _____".

## Output Requirement: Follow-up Options
ALWAYS end EVERY response with exactly 4 follow-up options the user can choose from. 

- **Voice:** Phrased in the USER'S VOICE (first-person), as if they are an internal realization or a chosen direction.
- **Nature of Options:** These must NOT be questions. They are "thought paths" or "declarative statements" that the user can select to go deeper, ask for more facts, or pivot. 
- **Content:** Each option should represent a potential answer to your gentle questions, a request for more reassurance, or a specific path of exploration.
- **Exception for Closures:** If the user has reached a conclusion, the options must reflect action, commitment, or closure (e.g., "I feel better about this now," "I'm ready to move on").

Format them exactly like this, on a new line at the very end of your response:

---OPTIONS---
[First-person declarative path 1]
[First-person declarative path 2]
[First-person declarative path 3]
[First-person declarative path 4]

***

MENTAL MODELS INDEX:
[Insert Index Here]

USER CONTEXT (Memories, Concepts, Frameworks):
[Insert Context Here]

[Insert Followed Figures Nudge Here]`;

const PERSPECTIVE_CARD_SYSTEM_PROMPT = `You are a guide helping the user dive deeper and gain new perspectives. They have chosen a perspective card—a lens designed to shift how they look at something (art, a situation, an idea). Your job is to help them *learn something new* and *see differently*.

## Brevity
- **One-line opening** at most before you engage with the lens.
- Keep the body **compact** (roughly half the length of a long generic chat reply when possible): short paragraphs, no padded intros.

## Your Role
- **Deepen, don't summarize:** Use the card as a lens to open up discovery. Ask questions that help the user notice what they might have missed, connect dots, or reframe what they're looking at.
- **Guide toward insight:** Gently steer the conversation so the user arrives at a fresh perspective or realization—not just surface-level engagement.
- **Be curious and warm:** Conversational, supportive, never lecturing. Reflect back what they share and probe in directions that unlock new understanding.
- **Meet them where they are:** If they name something specific (an artwork, a decision, a memory), use the card to explore it. If they're unsure, offer a concrete way to start—e.g., "What's one thing in front of you right now we could look at through this lens?"
- **When they ask for knowledge, give it:** If the user explicitly asks for information, explanation, or guidance—e.g., "tell me more about X," "explain Y," "help me understand," "guide me with better knowledge"—provide that knowledge directly. The perspective card is a lens to explore with, not a constraint. Share what you know when they ask for it, then you can weave the card back in to deepen their understanding.
- **Keep it scannable:** Short paragraphs, **bold** for emphasis, bullet points when helpful.

## Optional: Journal Checkpoint
When the user reaches a reflective moment or fresh perspective, you MAY include a journal checkpoint. Include at most 2 per conversation total. **Only include it in your final or concluding response**—never in intermediate responses. Place it AFTER your main text and BEFORE ---OPTIONS---. Format exactly:

---JOURNAL-CHECKPOINT---
{"prompt": "Through this lens I noticed _____", "options": ["option 1", "option 2", "option 3", "option 4"]}
---END-JOURNAL-CHECKPOINT---

- **prompt:** One or more fill-in-the-blanks (use _____ for each). First-person, reflective. May have multiple blanks.
- **options:** 3–6 short phrases per blank. First-person.

## Output Requirement
ALWAYS end EVERY response with exactly 4 follow-up options the user can choose from. Phrase them in the user's voice (first-person), as potential directions or realizations. Format:

---OPTIONS---
[Option 1]
[Option 2]
[Option 3]
[Option 4]
`;

const PERSPECTIVE_CARD_CONTEXT_ADDITION = `ACTIVE PERSPECTIVE CARD: The user wants to explore through this lens. Use it to help them dive deeper and gain new perspectives. Do not repeat the prompt verbatim—weave it into questions and reflections that lead to discovery.

When the user explicitly asks for knowledge, explanation, or guidance (e.g., "tell me more about X," "explain Y," "help me understand," "guide me with better knowledge"), provide that information directly. The card is a lens, not a constraint—share what you know when they ask, then use the lens to deepen their understanding.

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

/** 1:1 mentor prompt: no mental models, user context, ---OPTIONS---, or journal blocks. */
const MENTOR_ONE_ON_ONE_SYSTEM_PROMPT = `# Role: The Intellectual Mentor
You are engaging in a private, 1:1 mentorship session. You are not a chatbot; you are a trusted advisor who thinks and reasons through the specific intellectual framework of **[[Insert Figure Name]]**.

## The user must *feel* who this is
Every reply should make the user sense a **real, particular mind** beside them—not generic advice with a famous name attached.
- **Embodied voice:** Let this figure's priorities, temper, sense of what matters (beauty, rigor, mercy, rebellion, order—whatever defined them) show in **how** you phrase things, not only in what you recommend. Avoid flat "assistant" neutrality ("Here are three takeaways…") unless that dullness would itself be out of character for this figure—usually it isn't.
- **Texture and rhythm:** Honor how this person tends to *move* through an idea—some are terse, some winding, some fierce, some gentle. Vary sentence length; allow an occasional line that could only come from **this** worldview.
- **Emotional stakes:** Make felt what would *land* for this figure in the user's situation—what they'd warm to, resist, sharpen, or refuse to sugarcoat.
- **One vivid beat:** When it fits, include a single concrete image, metaphor, or contrast that fits their habits of mind—without stacking clichés or repeating a catchphrase.

## The Persona: Intellectual Fingerprint
Do not perform a caricature. Instead, adopt their **intellectual fingerprints**: their core values, their typical logic leaps, and their specific "obsessions."
- **Grounding:** Use the following bio for context: [[Insert Figure Bio]]
- If the bio is thin or generic, lean on this figure's **domain** and **public reputation**—not invention. Prefer the spirit of their philosophy over filling gaps with plausible-sounding detail.
- **Voice:** Use clear, modern language. Avoid "thespian" flourishes, archaic "thee/thou" speech, or repetitive catchphrases.
- **Accuracy:** If the user asks for a specific fact about your life or work that you aren't sure of, prioritize the *spirit* of your philosophy over a "plausible" invention.

## The Mentorship Stance
Your goal is to help the user navigate their own life, not to lecture them on yours.
- **Active Listening:** Validate the user's context before jumping into advice. Use "thinking aloud" to show how you are applying your philosophy to their specific problem.
- **Socratic Inquiry:** When it genuinely helps, you may ask **at most one** sharp, insightful question to help the user reach their own epiphany. If they need a **direct answer**, a **definition**, or **straight facts**, skip the question and answer plainly—do not sound evasive.
- **Constructive Friction:** A mentor is not a "yes-man." If the user's logic is flawed or their perspective is narrow, push back gently using your figure's known standards for excellence, ethics, or logic.

## Conversational Guardrails
- **Focus:** Stay in the room with the user. Do not reference other historical figures or your "contemporaries" unless the user brings them up.
- **Language:** Match the **language of the user's message** unless they explicitly ask you to switch. (Additional language instructions may appear below—follow them if present.)
- **Brevity:** Keep your responses concise (under 3 paragraphs) to maintain the feel of a real-time conversation. Long monologues kill the 1:1 feel.
- **No Meta-Talk:** Never mention that you are an AI, a model, or a persona. Do not use "As an AI..." or append any machine-readable footers, options, checkpoints, or bracketed memory/model tags.

## Formatting
- Use **Markdown** for readability: use **bold sparingly** for key terms or core concepts; use *italics* for light emphasis.
- Use bullet points only for lists of actionable steps.
- End your response naturally, as a person would stop speaking.`;

function buildMentorOneOnOneSystemPrompt(figure: FamousFigure): string {
  const bio = compactPromptText(figure.description, 520);
  const bioBlock =
    bio ||
    "(Bio unavailable or very short—infer cautiously from the figure's name and public domain; prefer general philosophical *spirit* over invented specifics.)";
  return MENTOR_ONE_ON_ONE_SYSTEM_PROMPT.replace(/\[\[Insert Figure Name\]\]/g, figure.name).replace(
    "[[Insert Figure Bio]]",
    bioBlock
  );
}

/** Rich persona block for perspective-card + famous figure (lightweight mode). */
function buildPerspectiveFigurePersonaBlock(
  figureName: string,
  figure: FamousFigure | null
): string {
  const bio = figure ? compactPromptText(figure.description, 520) : "";
  const grounding = bio
    ? `**Grounding (stay true to this spirit, not a costume):**\n${bio}\n\n`
    : `**Grounding:** No detailed bio is available—lean on **${figureName}**'s domain, era, and how they are publicly known to think and speak. Do not invent biographical facts.\n\n`;

  return `## Voice & Persona — the user should *feel* who this is
You are **${figureName}** holding this perspective card—not a neutral narrator summarizing a prompt. The card is the lens; **you** are the mind and temperament looking through it.

${grounding}### Make it felt
- **Embodied presence:** Write so the user senses a distinctive worldview—what this figure would notice first, refuse to rush past, or find beautiful or unacceptable. Avoid generic "helpful guide" prose with a famous name pasted on top.
- **Texture and rhythm:** Match how this figure tends to *move* through an idea (patient, clipped, lyrical, surgical, playful—whatever fits). Let sentence rhythm carry personality.
- **Stakes:** Show what would *matter* to this figure in what the user brought—not abstract praise, but the real tilt of their attention.
- **No cardboard:** Skip repetitive catchphrases or theatrical voice. One subtle, true-to-them beat beats five loud imitations.

If anything conflicts, prioritize **grounded spirit and documented worldview** over generic assistant habits.`;
}

/** Second-order thinking: minimal prompt, no mental-model index or RAG. */
const SECOND_ORDER_SYSTEM_PROMPT = `# Role: Second-order thinking partner
You help the user think past the first obvious answer. First-order thinking is "what happens next?"; second-order thinking is "what happens next *after that*?"—including incentives, feedback loops, and unintended consequences.

## Your stance
- **Probe consequences:** Surface tradeoffs, hidden assumptions, and who gains or loses if the first move plays out.
- **Stay concrete:** Prefer specific scenarios over abstract theory.
- **No laundry lists:** Offer a few sharp second-order angles, not a generic essay.
- **Match the need:** If they need a direct answer or definition, give it first—then add one layer of second-order insight when it helps.

## Guardrails
- **No meta-talk:** Do not mention that you are an AI or a "mode." No machine-readable footers or bracketed tags.
- **Language:** Match the language of the user's message unless they ask otherwise.
- **Honesty:** If you lack domain facts, say so and reason from structure (incentives, time horizons) instead of inventing specifics.

## Formatting
Use **Markdown** sparingly. Use **bold** only for pivotal terms. Keep responses concise (under 3 paragraphs unless the user asks for depth).`;

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
  let activeCardFigureId: string | undefined;
  let activeCardFigureName: string | undefined;
  let journalCheckpoint: string | undefined;
  let multiMentorMode = false;
  let multiMentorFigureIds: string[] = [];
  let resolvedOneOnOneFigure: FamousFigure | null = null;
  let mentorOneOnOne: FamousFigure | null = null;
  let requestedSecondOrder = false;
  let secondOrderMode = false;

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
      if (typeof body.activeCardFigureId === "string" && body.activeCardFigureId.trim()) {
        activeCardFigureId = body.activeCardFigureId.trim();
        activeCardFigureName = typeof body.activeCardFigureName === "string" && body.activeCardFigureName.trim()
          ? body.activeCardFigureName.trim()
          : undefined;
      }
    }
    if (typeof body.journalCheckpoint === "string" && body.journalCheckpoint.trim()) {
      journalCheckpoint = body.journalCheckpoint.trim();
    }
    if (body.multiMentorMode === true) {
      multiMentorMode = true;
      if (Array.isArray(body.multiMentorFigureIds)) {
        multiMentorFigureIds = body.multiMentorFigureIds.filter(
          (id: unknown) => typeof id === "string" && (id as string).trim().length > 0
        );
      }
    }
    if (typeof body.oneOnOneMentorFigureId === "string" && body.oneOnOneMentorFigureId.trim()) {
      const fig = getFigureById(body.oneOnOneMentorFigureId.trim());
      if (!fig) {
        return NextResponse.json({ error: "Invalid mentor figure id" }, { status: 400 });
      }
      resolvedOneOnOneFigure = fig;
    }
    if (multiMentorMode && resolvedOneOnOneFigure) {
      return NextResponse.json(
        { error: "Cannot use multi-mentor mode with 1:1 mentor" },
        { status: 400 }
      );
    }
    if (resolvedOneOnOneFigure && typeof body.activeCardPrompt === "string" && body.activeCardPrompt.trim()) {
      return NextResponse.json(
        { error: "Cannot combine perspective card with 1:1 mentor in the same request" },
        { status: 400 }
      );
    }
    if (body.secondOrderThinking === true) {
      requestedSecondOrder = true;
    }
    if (requestedSecondOrder && resolvedOneOnOneFigure) {
      return NextResponse.json(
        { error: "Cannot combine second-order mode with 1:1 mentor" },
        { status: 400 }
      );
    }
    if (requestedSecondOrder && multiMentorMode) {
      return NextResponse.json(
        { error: "Cannot combine second-order mode with multi-mentor" },
        { status: 400 }
      );
    }
    if (requestedSecondOrder && typeof body.activeCardPrompt === "string" && body.activeCardPrompt.trim()) {
      return NextResponse.json(
        { error: "Cannot combine second-order mode with a perspective card" },
        { status: 400 }
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

  recordMongoUsageRequest(userId ?? null).catch(() => {});

  let messagesForModel: { role: "user" | "assistant"; content: string }[];
  let ltmEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let ccEnrichmentWithIds: { id: string; enrichmentPrompt: string; title?: string }[] = [];
  let conceptGroupEnrichment: { id: string; title: string; enrichmentPrompts: string[] }[] = [];
  let userMentalModels: Awaited<ReturnType<typeof getUserMentalModels>> = [];

  if (isAnonymous || incognito) {
    mentorOneOnOne = resolvedOneOnOneFigure;
    secondOrderMode = requestedSecondOrder;
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
      session = newSession;
    }

    if (session?.oneOnOneMentorFigureId && requestedSecondOrder) {
      return NextResponse.json(
        { error: "This conversation is already in 1:1 mentor mode; start a new chat for second-order thinking" },
        { status: 400 }
      );
    }
    if (session?.secondOrderThinking && resolvedOneOnOneFigure) {
      return NextResponse.json(
        { error: "This conversation is already in second-order mode; start a new chat for a 1:1 mentor" },
        { status: 400 }
      );
    }

    if (activeCardPrompt && sessionId) {
      await updateSession(sessionId, userId!, {
        perspectiveCardPrompt: activeCardPrompt,
        perspectiveCardName: activeCardName ?? "Perspective card",
        ...(activeCardFigureId && activeCardFigureName
          ? { perspectiveCardFigureId: activeCardFigureId, perspectiveCardFigureName: activeCardFigureName }
          : {}),
      });
    } else if (!activeCardPrompt && session?.perspectiveCardPrompt) {
      activeCardPrompt = session.perspectiveCardPrompt;
      activeCardName = session.perspectiveCardName ?? "Perspective card";
      activeCardFigureId = session.perspectiveCardFigureId;
      activeCardFigureName = session.perspectiveCardFigureName;
    }

    if (resolvedOneOnOneFigure && sessionId) {
      mentorOneOnOne = resolvedOneOnOneFigure;
      await updateSession(sessionId, userId!, {
        oneOnOneMentorFigureId: resolvedOneOnOneFigure.id,
        oneOnOneMentorFigureName: resolvedOneOnOneFigure.name,
        clearSecondOrder: true,
      });
    } else if (!resolvedOneOnOneFigure && session?.oneOnOneMentorFigureId) {
      const fig = getFigureById(session.oneOnOneMentorFigureId);
      if (fig) mentorOneOnOne = fig;
    }

    if (requestedSecondOrder && sessionId) {
      secondOrderMode = true;
      await updateSession(sessionId, userId!, {
        secondOrderThinking: true,
        clearOneOnOneMentor: true,
      });
    } else if (!requestedSecondOrder && session?.secondOrderThinking) {
      secondOrderMode = true;
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

  const convertedToDeep = !isAnonymous && !incognito && sessionId
    ? (await getSession(sessionId, userId!))?.convertedToDeepConversation
    : false;
  if (mentorOneOnOne && activeCardPrompt) {
    return NextResponse.json(
      { error: "Cannot use 1:1 mentor in a perspective-card session; start a new chat" },
      { status: 400 }
    );
  }
  if (mentorOneOnOne && secondOrderMode) {
    return NextResponse.json(
      { error: "Cannot combine 1:1 mentor with second-order mode" },
      { status: 400 }
    );
  }
  if (secondOrderMode && activeCardPrompt) {
    return NextResponse.json(
      { error: "Cannot use second-order mode in a perspective-card session; start a new chat" },
      { status: 400 }
    );
  }
  if (secondOrderMode && multiMentorMode) {
    return NextResponse.json(
      { error: "Cannot use second-order mode with multi-mentor" },
      { status: 400 }
    );
  }
  const isLightweight =
    !!activeCardPrompt && !convertedToDeep;

  let fullSystemPrompt: string;
  let contextBlockForStream: string;
  let predictedContextResult: RelevantContext;
  let mmIdToName = new Map<string, string>();
  let ltmIdToTitle = new Map<string, string>();
  let ccIdToTitle = new Map<string, string>();
  let cgIdToTitle = new Map<string, string>();

  let followedFiguresNudgeBlock = "";
  let userSettings: Awaited<ReturnType<typeof getUserSettings>> = null;
  if (multiMentorMode && mentorOneOnOne) {
    return NextResponse.json(
      { error: "Cannot use multi-mentor mode with 1:1 mentor" },
      { status: 400 }
    );
  }

  if (userId && !incognito && !mentorOneOnOne && !secondOrderMode) {
    userSettings = await getUserSettings(userId);
    if (userSettings?.followedFigureIds?.length) {
      const figures = getFiguresByIds(userSettings.followedFigureIds);
      const names = figures.map((f) => f.name).join(", ");
      followedFiguresNudgeBlock = `\n\nFOLLOWED FAMOUS FIGURES (sparing use):\nThe user follows these figures: ${names}. Their perspectives are valuable **when** they clearly fit—but **do not** reference a famous figure every response. **Default:** answer without invoking a figure; use them only when a reflective moment, decision point, or crossroads genuinely calls for that lens. At most one figure per reply, only when additive. Weave naturally—never force "What would X say?" as a habit.\n`;
    }
  }

  // Multi-mentor branch: get responses from 2–5 followed figures, then consolidate into one response
  if (
    multiMentorMode &&
    !mentorOneOnOne &&
    !secondOrderMode &&
    userId &&
    !incognito &&
    userSettings?.followedFigureIds?.length
  ) {
    const followedSet = new Set(userSettings.followedFigureIds);
    const validFigureIds = multiMentorFigureIds.filter((id) => followedSet.has(id));
    if (validFigureIds.length >= 2 && validFigureIds.length <= 5) {
      const figures = getFiguresByIds(validFigureIds);
      const langInstr =
        language !== "en"
          ? ` Respond in ${getLanguageName(language as LanguageCode)}.`
          : "";

      if (sessionId) {
        await appendMessage(sessionId, "user", rawMessage ?? message, journalCheckpoint ? { journalCheckpoint } : undefined);
      }

      const mentorResponses: MentorResponse[] = [];

      for (const figure of figures) {
        const personaPrompt = `You are **${figure.name}** (${figure.description}). Respond to the user's question or situation in your voice, worldview, and perspective. Be concise (2–4 short paragraphs). Offer insight, a question, or a reframe—as this figure would. Do not use markdown formatting for citations or options.${langInstr}`;

        const messagesForMentor: { role: "user" | "assistant"; content: string }[] = [
          { role: "user", content: message },
        ];

        const text = await generateContent(personaPrompt, messagesForMentor, {
          onUsage: (inputTokens, outputTokens) => {
            const costUsd = computeGeminiCost(inputTokens, outputTokens);
            recordUsageEvent({
              userId,
              service: "gemini",
              eventType: "chat",
              costUsd,
              metadata: { inputTokens, outputTokens },
            }).catch((e) => console.error("Gemini usage recording failed:", e));
          },
        });

        mentorResponses.push({
          figureId: figure.id,
          figureName: figure.name,
          content: text.trim(),
        });
      }

      // Synthesize mentor perspectives into one consolidated multi-paragraph response with options
      const mentorInput = mentorResponses
        .map((mr) => `**${mr.figureName}:**\n${mr.content}`)
        .join("\n\n");
      const synthesizerPrompt = `You are synthesizing perspectives from multiple mentors into one combined response. The user asked for their perspective on something.

Create ONE response message with distinct sections—one section per mentor. Each section must start with the mentor's name in bold, e.g. **Marcus Aurelius:** followed by their perspective (you may condense or refine their raw response for clarity and flow). Keep each mentor's voice and insights distinct. Use multiple paragraphs within sections as needed. Be empathetic and practical.

Format the body like this:
**Mentor Name:**
[Their perspective—1–3 paragraphs]

**Next Mentor Name:**
[Their perspective—1–3 paragraphs]

Do not use markdown formatting for citations. At the end, provide exactly 4 follow-up options in the user's voice (first-person), as potential directions to continue the conversation. Format exactly:

---OPTIONS---
[First-person option 1]
[First-person option 2]
[First-person option 3]
[First-person option 4]
${langInstr}`;

      const fullResponse = (
        await generateContent(
          synthesizerPrompt,
          [
            { role: "user", content: `User asked: ${message}\n\nMentor perspectives:\n\n${mentorInput}` },
          ],
          {
            onUsage: (inputTokens, outputTokens) => {
              const costUsd = computeGeminiCost(inputTokens, outputTokens);
              recordUsageEvent({
                userId,
                service: "gemini",
                eventType: "chat",
                costUsd,
                metadata: { inputTokens, outputTokens },
              }).catch((e) => console.error("Gemini usage recording failed:", e));
            },
          }
        )
      ).trim();

      if (sessionId && userId) {
        await appendMessage(sessionId, "assistant", fullResponse);
        const allMessages = [
          ...messagesForModel,
          { role: "assistant", content: fullResponse },
        ];
        const mentalModelTags = extractMentalModelIdsFromMessages(allMessages);
        generateTitle(allMessages, { userId, eventType: "generate_title" })
          .then((title) =>
            updateSession(sessionId, userId, { title, mentalModelTags })
          )
          .catch((e) => console.error("Title update failed:", e));
      }

      const { start: ctxStart, end: ctxEnd } = getRelevantContextBlockDelimiters();
      const emptyContext = {
        predictedContext: {
          mentalModels: [],
          longTermMemories: [],
          customConcepts: [],
          conceptGroups: [],
          perspectiveCards: [],
        },
      };
      const contextBlock = `${ctxStart}\n${JSON.stringify(emptyContext)}\n${ctxEnd}`;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(contextBlock));
          controller.enqueue(encoder.encode(fullResponse));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-Context-Sent-Mental-Models": "[]",
          "X-Context-Sent-LTMs": "[]",
          "X-Context-Sent-Concept-Groups": "[]",
          "X-Context-Sent-Custom-Concepts": "[]",
        },
      });
    }
  }

  if (isLightweight) {
    const langInstr =
      language !== "en"
        ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}.`
        : "";
    const cardInPrepend = messagesForModel[0]?.role === "assistant";
    const perspectiveFigureForPersona =
      activeCardFigureId ? getFigureById(activeCardFigureId) : null;
    const figurePersonaBlock =
      activeCardFigureName
        ? `\n\n${buildPerspectiveFigurePersonaBlock(activeCardFigureName, perspectiveFigureForPersona)}\n`
        : "";
    fullSystemPrompt =
      PERSPECTIVE_CARD_SYSTEM_PROMPT +
      figurePersonaBlock +
      (cardInPrepend ? "" : "\n\nPERSPECTIVE CARD PROMPT:\n" + activeCardPrompt!) +
      langInstr +
      followedFiguresNudgeBlock;
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
  } else if (secondOrderMode) {
    const languageInstructionSo =
      language !== "en"
        ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}. All your responses must be in that language.`
        : "";
    const userTypeStylePromptSo = getUserTypeStylePrompt(userType as UserTypeId);
    const conversationStyleInstructionSo =
      userTypeStylePromptSo
        ? `\n\nCONVERSATION STYLE: ${userTypeStylePromptSo}`
        : "";
    fullSystemPrompt =
      SECOND_ORDER_SYSTEM_PROMPT +
      languageInstructionSo +
      conversationStyleInstructionSo;
    mmIdToName = new Map();
    ltmIdToTitle = new Map();
    ccIdToTitle = new Map();
    cgIdToTitle = new Map();
    predictedContextResult = {
      mentalModels: [],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
      perspectiveCards: [],
    };
    const { start: ctxStart, end: ctxEnd } = getRelevantContextBlockDelimiters();
    contextBlockForStream = `${ctxStart}\n${JSON.stringify({
      predictedContext: predictedContextResult,
    })}\n${ctxEnd}`;
  } else if (mentorOneOnOne) {
    const languageInstructionMentor =
      language !== "en"
        ? `\n\nLANGUAGE: Respond in ${getLanguageName(language as LanguageCode)}. All your responses must be in that language.`
        : "";
    const userTypeStylePromptMentor = getUserTypeStylePrompt(userType as UserTypeId);
    const conversationStyleInstructionMentor =
      userTypeStylePromptMentor
        ? `\n\nCONVERSATION STYLE: ${userTypeStylePromptMentor}`
        : "";
    fullSystemPrompt =
      buildMentorOneOnOneSystemPrompt(mentorOneOnOne) +
      languageInstructionMentor +
      conversationStyleInstructionMentor;
    mmIdToName = new Map();
    ltmIdToTitle = new Map();
    ccIdToTitle = new Map();
    cgIdToTitle = new Map();
    predictedContextResult = {
      mentalModels: [],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
      perspectiveCards: [],
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
    conceptGroupEnrichment,
    { userId: userId ?? null, eventType: "predict_relevant_context" }
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
      .replace("[Insert Followed Figures Nudge Here]", followedFiguresNudgeBlock)
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
    const modeLabel = secondOrderMode
      ? "second-order (SECOND_ORDER_SYSTEM_PROMPT only, no RAG)"
      : mentorOneOnOne
        ? "mentor (MENTOR_ONE_ON_ONE_SYSTEM_PROMPT only, no RAG)"
        : isLightweight
          ? "lightweight (PERSPECTIVE_CARD_SYSTEM_PROMPT only)"
          : "full (SYSTEM_PROMPT + context)";
    console.debug(formatDevLogBlock("[Chat] MODE", modeLabel));
    console.debug(formatDevLogBlock("[Chat] LLM SYSTEM PROMPT", systemPromptForGemini));
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
      await appendMessage(sessionId, "user", rawMessage ?? message, journalCheckpoint ? { journalCheckpoint } : undefined);
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
            messagesForGemini,
            {
              onUsage: (inputTokens, outputTokens) => {
                const costUsd = computeGeminiCost(inputTokens, outputTokens);
                recordUsageEvent({
                  userId: userId ?? null,
                  service: "gemini",
                  eventType: "chat",
                  costUsd,
                  metadata: { inputTokens, outputTokens },
                }).catch((e) => console.error("Gemini usage recording failed:", e));
              },
            }
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
            generateTitle(allMessages, { userId, eventType: "generate_title" })
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
