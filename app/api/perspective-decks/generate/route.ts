import { NextResponse } from "next/server";
import { generatePerspectiveCardFromTopic } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const topic = body.topic as string | undefined;
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);
    const card = await generatePerspectiveCardFromTopic(topic.trim(), languageName);
    return NextResponse.json({ card });
  } catch (err) {
    console.error("Failed to generate perspective card:", err);
    return NextResponse.json(
      { error: "Failed to generate perspective card" },
      { status: 500 }
    );
  }
}
