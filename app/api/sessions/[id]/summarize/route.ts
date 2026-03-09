import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSession,
  getMessages,
  getLongTermMemory,
  createLongTermMemory,
  updateLongTermMemory,
  updateSession,
} from "@/lib/db";
import { generateSummaryAndEnrichment } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  try {
    const session = await getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await getMessages(sessionId);
    if (messages.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 messages to summarize" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userEnrichmentPrompt = body.enrichmentPrompt as string | undefined;
    const collapse = body.collapse !== false;
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);

    const { summary, enrichmentPrompt: generatedEnrichment } =
      await generateSummaryAndEnrichment(messages, languageName);
    const enrichmentPrompt =
      typeof userEnrichmentPrompt === "string" && userEnrichmentPrompt.trim()
        ? userEnrichmentPrompt.trim()
        : generatedEnrichment;

    const title =
      session.title ||
      summary.split("\n")[0]?.slice(0, 60) ||
      "Conversation summary";

    let longTermMemoryId: string;
    const existingLtmId = session.longTermMemoryId;

    if (collapse) {
      if (existingLtmId) {
        const existing = await getLongTermMemory(existingLtmId, userId);
        if (existing) {
          await updateLongTermMemory(existingLtmId, userId, {
            title,
            summary,
            enrichmentPrompt,
          });
          longTermMemoryId = existingLtmId;
        } else {
          const created = await createLongTermMemory(
            userId,
            sessionId,
            title,
            summary,
            enrichmentPrompt
          );
          longTermMemoryId = created._id;
        }
      } else {
        const created = await createLongTermMemory(
          userId,
          sessionId,
          title,
          summary,
          enrichmentPrompt
        );
        longTermMemoryId = created._id;
      }
      await updateSession(sessionId, userId, {
        isCollapsed: true,
        longTermMemoryId,
      });
    } else {
      const created = await createLongTermMemory(
        userId,
        sessionId,
        title,
        summary,
        enrichmentPrompt
      );
      longTermMemoryId = created._id;
    }

    const ltm = await getLongTermMemory(longTermMemoryId, userId);
    return NextResponse.json({
      longTermMemory: ltm,
      summary,
      enrichmentPrompt,
    });
  } catch (err) {
    console.error("Summarize error:", err);
    return NextResponse.json(
      { error: "Failed to summarize conversation" },
      { status: 500 }
    );
  }
}
