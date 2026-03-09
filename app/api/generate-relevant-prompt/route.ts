import { NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

export async function POST(request: Request) {
  let suggestion: string;
  let messages: { role: string; content: string }[];

  try {
    const body = await request.json();
    suggestion = body.suggestion;
    messages = body.messages ?? [];

    if (!suggestion || typeof suggestion !== "string") {
      return NextResponse.json(
        { error: "suggestion is required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const conversationContext =
    messages.length > 0
      ? messages
          .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
          .join("\n\n")
      : "No prior messages in this conversation.";

  const model = getModel();
  const result = await model.generateContent(
    `You are helping a user in a decision-making conversation. They are viewing context (e.g. a mental model, long-term memory, or custom concept) with this content:

"${suggestion}"

Based on the current conversation context below, generate ONE short message (1-2 sentences) that the user could send to continue the conversation. The message should:
- Apply the suggestion to their specific situation
- Feel natural and conversational (first-person, as if the user is speaking)
- Be relevant to what's been discussed
- Be concise (max ~50 words)

Return ONLY the message text, nothing else. No quotes, no preamble.

Conversation so far:
${conversationContext}`
  );

  const text = result.response.text().trim();
  return NextResponse.json({ text: text || suggestion });
}
