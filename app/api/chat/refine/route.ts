import { NextResponse } from "next/server";
import {
  refineChatMessageWithLens,
  type ChatInputLens,
} from "@/lib/gemini";
import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";
import { auth } from "@clerk/nextjs/server";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const VALID_LENSES = new Set<ChatInputLens>([
  "contrarian",
  "systems_thinker",
  "stoic",
  "casual_friend",
  "playful_coach",
]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (userId) {
    const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
    if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const lens = typeof body.lens === "string" ? body.lens.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Message text is required." }, { status: 400 });
    }
    if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Message text must be at most ${EXTRACT_CONCEPTS_MAX_TOTAL_CHARS} characters.` },
        { status: 400 }
      );
    }
    if (!VALID_LENSES.has(lens as ChatInputLens)) {
      return NextResponse.json({ error: "Invalid lens." }, { status: 400 });
    }

    const refinedText = await refineChatMessageWithLens(
      text,
      lens as ChatInputLens,
      { userId: userId ?? null, eventType: "chat_refine_lens" }
    );
    return NextResponse.json({ refinedText });
  } catch (error) {
    console.error("Chat lens refine error:", error);
    return NextResponse.json({ error: "Failed to refine message." }, { status: 500 });
  }
}

