import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCustomConcept, updateCustomConcept } from "@/lib/db";
import { translateConcept } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const conceptId = body.conceptId as string | undefined;
    const targetLanguage = body.targetLanguage as string | undefined;

    if (!conceptId || typeof conceptId !== "string" || !conceptId.trim()) {
      return NextResponse.json(
        { error: "conceptId is required" },
        { status: 400 }
      );
    }
    if (!targetLanguage || !isValidLanguageCode(targetLanguage)) {
      return NextResponse.json(
        { error: "Valid targetLanguage is required" },
        { status: 400 }
      );
    }

    const concept = await getCustomConcept(conceptId, userId);
    if (!concept) {
      return NextResponse.json(
        { error: "Concept not found" },
        { status: 404 }
      );
    }

    const languageName = getLanguageName(targetLanguage);
    const translated = await translateConcept(
      {
        title: concept.title,
        summary: concept.summary,
        enrichmentPrompt: concept.enrichmentPrompt,
      },
      languageName
    );

    const updated = await updateCustomConcept(conceptId, userId, translated);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update concept" },
        { status: 500 }
      );
    }

    return NextResponse.json(translated);
  } catch (err) {
    console.error("Failed to translate concept:", err);
    return NextResponse.json(
      { error: "Failed to translate concept" },
      { status: 500 }
    );
  }
}
