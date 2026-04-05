import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCustomConcept, getLongTermMemory, isHabitBucket } from "@/lib/db";
import { generateHabitFromConceptOrLtm } from "@/lib/gemini";
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
    const sourceType = body.sourceType as "concept" | "ltm" | undefined;
    const sourceId = body.sourceId as string | undefined;
    if (
      !sourceType ||
      (sourceType !== "concept" && sourceType !== "ltm") ||
      !sourceId ||
      typeof sourceId !== "string"
    ) {
      return NextResponse.json(
        { error: "sourceType and sourceId are required" },
        { status: 400 }
      );
    }
    const languageCode =
      typeof body.language === "string" && isValidLanguageCode(body.language)
        ? body.language
        : "en";
    const languageName = getLanguageName(languageCode);

    const bucketRaw = body.bucket;
    const bucket =
      bucketRaw !== undefined && bucketRaw !== null && isHabitBucket(bucketRaw)
        ? bucketRaw
        : undefined;

    let source: { title: string; summary: string; enrichmentPrompt: string };
    if (sourceType === "concept") {
      const concept = await getCustomConcept(sourceId, userId);
      if (!concept) {
        return NextResponse.json(
          { error: "Concept not found" },
          { status: 404 }
        );
      }
      source = {
        title: concept.title,
        summary: concept.summary,
        enrichmentPrompt: concept.enrichmentPrompt,
      };
    } else {
      const ltm = await getLongTermMemory(sourceId, userId);
      if (!ltm) {
        return NextResponse.json(
          { error: "Long-term memory not found" },
          { status: 404 }
        );
      }
      source = {
        title: ltm.title,
        summary: ltm.summary,
        enrichmentPrompt: ltm.enrichmentPrompt,
      };
    }

    const result = await generateHabitFromConceptOrLtm(
      { type: sourceType, ...source },
      languageName,
      { userId, eventType: "generate_habit" },
      bucket
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate habit:", err);
    return NextResponse.json(
      { error: "Failed to generate habit" },
      { status: 500 }
    );
  }
}
