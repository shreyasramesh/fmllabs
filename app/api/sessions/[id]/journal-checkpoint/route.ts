import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMessages, getSession } from "@/lib/db";
import { generateJournalCheckpointSuggestion } from "@/lib/gemini";
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
      return NextResponse.json({ error: "Not enough conversation context" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const languageCode =
      typeof body.language === "string" && isValidLanguageCode(body.language)
        ? body.language
        : "en";
    const languageName = getLanguageName(languageCode);

    const messagesForModel = messages.map((m) => {
      if (m.role === "user" && m.journalCheckpoint) {
        return {
          role: m.role,
          content: `[Journal checkpoint: ${m.journalCheckpoint}]\n\n${m.content}`,
        };
      }
      return { role: m.role, content: m.content };
    });

    const suggestion = await generateJournalCheckpointSuggestion(
      messagesForModel,
      languageName
    );
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("Journal checkpoint suggestion error:", err);
    return NextResponse.json(
      { error: "Failed to generate journal checkpoint suggestion" },
      { status: 500 }
    );
  }
}
