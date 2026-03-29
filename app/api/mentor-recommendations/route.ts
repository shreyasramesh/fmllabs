import { NextResponse } from "next/server";
import { loadFamousFigures } from "@/lib/famous-figures";
import {
  recommendMentorsForQuery,
  type MentorRecommendationCandidate,
} from "@/lib/gemini";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+[{\]}\\|;:'",<>/?]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 24);
}

function scoreCandidate(query: string, tokens: string[], candidate: MentorRecommendationCandidate): number {
  const name = candidate.name.toLowerCase();
  const desc = candidate.description.toLowerCase();
  const blob = `${name} ${desc}`;
  let score = 0;
  if (name.includes(query)) score += 10;
  if (desc.includes(query)) score += 7;
  for (const token of tokens) {
    if (name.includes(token)) score += 4;
    else if (desc.includes(token)) score += 2;
  }
  return score;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 400) : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const requestedCountRaw =
      typeof body.count === "number" ? body.count : Number.parseInt(String(body.count ?? "3"), 10);
    const requestedCount = Number.isFinite(requestedCountRaw)
      ? Math.max(1, Math.min(5, Math.floor(requestedCountRaw)))
      : 3;
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const { figures } = loadFamousFigures();
    const scoped = categoryId ? figures.filter((f) => f.category === categoryId) : figures;
    const tokens = tokenize(query);
    const qNorm = query.toLowerCase();
    const ranked = scoped
      .map((f) => ({
        candidate: {
          id: f.id,
          name: f.name,
          description: f.description,
          category: f.category,
        } satisfies MentorRecommendationCandidate,
        score: scoreCandidate(qNorm, tokens, f),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 120)
      .map((r) => r.candidate);

    const shortlist = ranked.length > 0 ? ranked : scoped.slice(0, 120);
    const llmSuggestions = await recommendMentorsForQuery(
      query,
      shortlist,
      requestedCount,
      {
        userId: null,
        eventType: "mentor_recommendations",
      }
    ).catch(() => []);

    const figureById = new Map(figures.map((f) => [f.id, f]));
    const usedIds = new Set<string>();
    const suggestions = llmSuggestions
      .map((row) => {
        const match = figureById.get(row.id);
        if (!match || usedIds.has(match.id)) return null;
        usedIds.add(match.id);
        return {
          id: match.id,
          name: match.name,
          description: match.description,
          category: match.category,
          reason: row.reason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (suggestions.length < requestedCount) {
      for (const f of shortlist) {
        if (suggestions.length >= requestedCount) break;
        if (usedIds.has(f.id)) continue;
        usedIds.add(f.id);
        suggestions.push({
          id: f.id,
          name: f.name,
          description: f.description,
          category: f.category,
          reason: "Likely fit based on your description.",
        });
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, requestedCount) });
  } catch (err) {
    console.error("mentor-recommendations error:", err);
    return NextResponse.json({ error: "Failed to generate mentor recommendations" }, { status: 500 });
  }
}

