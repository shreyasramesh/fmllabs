import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConceptGroup,
  getCustomConceptsByIds,
  updateConceptGroup,
} from "@/lib/db";
import { generateFrameworkSummary } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
        { error: "Add at least one concept to this framework before summarizing." },
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

    const { summary, chainOfThought } = await generateFrameworkSummary(
      group.title,
      concepts.map((c) => ({
        title: c.title,
        summary: c.summary,
        enrichmentPrompt: c.enrichmentPrompt,
      })),
      languageName,
      { userId, eventType: "framework_summarize" }
    );

    const updated = await updateConceptGroup(id, userId, {
      summary,
      chainOfThought,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to save summary" },
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
    console.error("Framework summarize error:", err);
    return NextResponse.json(
      { error: "Failed to summarize framework" },
      { status: 500 }
    );
  }
}
