import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateConceptFromUserInput } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const userInput = body.userInput as string | undefined;
    if (!userInput || typeof userInput !== "string" || !userInput.trim()) {
      return NextResponse.json(
        { error: "userInput is required" },
        { status: 400 }
      );
    }
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);
    const result = await generateConceptFromUserInput(userInput.trim(), languageName);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate custom concept:", err);
    return NextResponse.json(
      { error: "Failed to generate custom concept" },
      { status: 500 }
    );
  }
}
