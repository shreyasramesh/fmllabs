import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDomainQuestions } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const domain = body.domain as string | undefined;
    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 }
      );
    }
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);
    const result = await generateDomainQuestions(domain.trim(), languageName);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate domain questions:", err);
    return NextResponse.json(
      { error: "Failed to generate domain questions" },
      { status: 500 }
    );
  }
}
