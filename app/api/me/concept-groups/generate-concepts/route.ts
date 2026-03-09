import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateConceptsFromDomainAndAnswers } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const domain = body.domain as string | undefined;
    const answers = body.answers as { question: string; answer: string }[] | undefined;
    if (
      !domain ||
      typeof domain !== "string" ||
      !domain.trim() ||
      !Array.isArray(answers) ||
      answers.length === 0
    ) {
      return NextResponse.json(
        { error: "domain and answers array are required" },
        { status: 400 }
      );
    }
    const validAnswers = answers.filter(
      (a) =>
        a &&
        typeof a.question === "string" &&
        typeof a.answer === "string" &&
        a.question.trim() &&
        a.answer.trim()
    );
    if (validAnswers.length === 0) {
      return NextResponse.json(
        { error: "At least one valid question/answer pair is required" },
        { status: 400 }
      );
    }
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);
    const result = await generateConceptsFromDomainAndAnswers(
      domain.trim(),
      validAnswers.map((a) => ({
        question: a.question.trim(),
        answer: a.answer.trim(),
      })),
      languageName
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate concepts from domain:", err);
    return NextResponse.json(
      { error: "Failed to generate concepts from domain" },
      { status: 500 }
    );
  }
}
