import { NextResponse } from "next/server";
import { loadFamousFigures } from "@/lib/famous-figures";
import { getModel } from "@/lib/gemini";
import { recordUsageEvent, computeGeminiCost } from "@/lib/usage";

const CATEGORY_IDS = [
  "philosophy",
  "scientist",
  "billionaires",
  "athletes",
  "investors",
  "musicians",
  "writers",
  "artists",
  "entrepreneurs",
  "spiritual_teachers",
] as const;

function recordGeminiUsage(
  result: { response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } },
  eventType: string
) {
  const um = result.response.usageMetadata;
  if (um && (um.promptTokenCount ?? 0) > 0) {
    const costUsd = computeGeminiCost(um.promptTokenCount ?? 0, um.candidatesTokenCount ?? 0);
    recordUsageEvent({
      userId: null,
      service: "gemini",
      eventType,
      costUsd,
      metadata: {
        inputTokens: um.promptTokenCount ?? 0,
        outputTokens: um.candidatesTokenCount ?? 0,
      },
    }).catch(() => {});
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const cardName = typeof body.cardName === "string" ? body.cardName.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const { figures: allFigures, categories } = loadFamousFigures();
    const byCategory = new Map<string, typeof allFigures>();
    for (const f of allFigures) {
      const list = byCategory.get(f.category) ?? [];
      list.push(f);
      byCategory.set(f.category, list);
    }

    const model = getModel();

    // Step 1: Pick the most relevant category
    const categoryList = categories.map((c) => `- ${c.id}: ${c.name}`).join("\n");
    const categoryResult = await model.generateContent(
      `You are selecting the most relevant category of famous figures for a perspective exercise.

PERSPECTIVE CARD${cardName ? ` (${cardName})` : ""}:
${prompt}

CATEGORIES:
${categoryList}

Which category's figures would best guide the user through this perspective? Consider whose worldview, expertise, or voice would deepen the experience.

Return ONLY a JSON object with one key: "category" (the category id, e.g. "philosophy"). No markdown, no extra text.`
    );

    let categoryText = categoryResult.response.text().trim();
    categoryText = categoryText.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const categoryParsed = JSON.parse(categoryText) as { category?: string };
    let categoryId = typeof categoryParsed.category === "string" ? categoryParsed.category.trim() : null;

    if (!categoryId || !CATEGORY_IDS.includes(categoryId as (typeof CATEGORY_IDS)[number])) {
      categoryId = "philosophy";
    }

    recordGeminiUsage(categoryResult, "perspective_card_select_category");

    // Step 2: Pick the exact figure from that category
    const categoryFigures = byCategory.get(categoryId) ?? [];
    if (categoryFigures.length === 0) {
      const fallback = allFigures.find((f) => f.category === "philosophy") ?? allFigures[0];
      return NextResponse.json({
        id: fallback!.id,
        name: fallback!.name,
        description: fallback!.description,
      });
    }

    const figureList = categoryFigures
      .map((f) => `- ${f.id}: ${f.name} (${f.description})`)
      .join("\n");

    const figureResult = await model.generateContent(
      `You are selecting the single most relevant famous figure to guide a user through a perspective exercise.

PERSPECTIVE CARD${cardName ? ` (${cardName})` : ""}:
${prompt}

FIGURES IN CATEGORY (id, name, description):
${figureList}

Pick the ONE figure whose worldview, expertise, or voice would best help the user explore this perspective. Consider: Who would ask the most insightful questions? Whose lens would deepen the user's experience?

Return ONLY a JSON object with exactly two keys:
- "id": the figure's id (e.g. "marcus_aurelius")
- "reason": one short sentence why (max 15 words)

No markdown, no extra text.`
    );

    let figureText = figureResult.response.text().trim();
    figureText = figureText.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const figureParsed = JSON.parse(figureText) as { id?: string };
    const id = typeof figureParsed.id === "string" ? figureParsed.id.trim() : null;

    recordGeminiUsage(figureResult, "perspective_card_select_figure");

    const figure =
      (id && categoryFigures.find((f) => f.id === id)) ??
      categoryFigures.find((f) => f.id.toLowerCase() === id?.toLowerCase()) ??
      categoryFigures[0];

    if (!figure) {
      const fallback = allFigures[0];
      return NextResponse.json({
        id: fallback!.id,
        name: fallback!.name,
        description: fallback!.description,
      });
    }

    return NextResponse.json({
      id: figure.id,
      name: figure.name,
      description: figure.description,
    });
  } catch (err) {
    console.error("select-figure error:", err);
    return NextResponse.json({ error: "Failed to select figure" }, { status: 500 });
  }
}
