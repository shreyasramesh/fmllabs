import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConceptGroup,
  getCustomConceptsByIds,
  updateConceptGroup,
} from "@/lib/db";
import { generateFrameworkChainOfThought } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Concept group ID required" },
      { status: 400 }
    );
  }

  try {
    const body = await _request.json().catch(() => ({}));
    const languageCode =
      typeof body.language === "string" && isValidLanguageCode(body.language)
        ? body.language
        : "en";
    const languageName = getLanguageName(languageCode);

    const group = await getConceptGroup(id, userId);
    if (!group) {
      return NextResponse.json(
        { error: "Concept group not found" },
        { status: 404 }
      );
    }

    if (!group.conceptIds.length) {
      return NextResponse.json(
        { error: "Add at least one concept to this framework first." },
        { status: 400 }
      );
    }

    const concepts = await getCustomConceptsByIds(group.conceptIds, userId);
    if (concepts.length === 0) {
      return NextResponse.json(
        { error: "No concepts found for this framework." },
        { status: 400 }
      );
    }

    const { chainOfThought } = await generateFrameworkChainOfThought(
      group.title,
      concepts.map((c) => ({
        title: c.title,
        summary: c.summary,
        enrichmentPrompt: c.enrichmentPrompt,
      })),
      languageName,
      { userId, eventType: "framework_chain_of_thought" }
    );

    const updated = await updateConceptGroup(
      id,
      userId,
      { chainOfThought },
      { unsetLegacyFrameworkSummary: true }
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to save chain-of-thought" },
        { status: 500 }
      );
    }

    const fresh = await getConceptGroup(id, userId);
    if (!fresh) {
      return NextResponse.json(
        { error: "Concept group not found" },
        { status: 404 }
      );
    }
    const conceptsOut =
      fresh.conceptIds.length > 0
        ? await getCustomConceptsByIds(fresh.conceptIds, userId)
        : [];

    return NextResponse.json({ ...fresh, concepts: conceptsOut });
  } catch (err) {
    console.error("Framework chain-of-thought error:", err);
    return NextResponse.json(
      { error: "Failed to generate chain-of-thought" },
      { status: 500 }
    );
  }
}
