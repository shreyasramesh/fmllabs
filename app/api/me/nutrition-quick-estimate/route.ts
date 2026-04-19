import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { finalizeCalorieTrackingEstimate } from "@/lib/gemini";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

/**
 * Lightweight Gemini estimate for a single food/drink line (Amy-style inline calories / sources).
 * Does not persist; used by Brain Dump nutrition UI only.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 2_000) : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await finalizeCalorieTrackingEstimate(text, [], {
      userId,
      eventType: "nutrition_quick_estimate",
    });

    const calories =
      result.intent === "nutrition" || result.intent === "mixed"
        ? (result.nutrition?.calories ?? null)
        : null;

    let exerciseCaloriesBurned: number | null = null;
    if (result.intent === "exercise" || result.intent === "mixed") {
      const exTotal = result.exercise?.caloriesBurned;
      if (typeof exTotal === "number" && Number.isFinite(exTotal) && exTotal > 0) {
        exerciseCaloriesBurned = exTotal;
      } else if (Array.isArray(result.exerciseItems) && result.exerciseItems.length > 0) {
        const sum = result.exerciseItems.reduce((acc, it) => {
          const c = it.caloriesBurned;
          return acc + (typeof c === "number" && Number.isFinite(c) ? c : 0);
        }, 0);
        if (sum > 0) exerciseCaloriesBurned = sum;
      }
    }

    const itemCount = result.nutritionItems?.length ?? 0;
    const assumptionCount = Array.isArray(result.assumptions) ? result.assumptions.length : 0;
    const sourceCount = Math.min(99, Math.max(0, itemCount + assumptionCount));

    const nutritionItems = (result.nutritionItems ?? []).map((i) => ({
      name: i.name,
      calories: i.calories,
      proteinGrams: i.proteinGrams,
      carbsGrams: i.carbsGrams,
      fatGrams: i.fatGrams,
    }));

    return NextResponse.json({
      calories,
      exerciseCaloriesBurned,
      sourceCount,
      confidence: result.confidence,
      intent: result.intent,
      reasoning: result.reasoning ?? "",
      assumptions: result.assumptions ?? [],
      nutritionItems,
      nutritionNotes: result.nutrition?.notes ?? "",
      exerciseNotes: result.exercise?.notes ?? "",
      proteinGrams: result.nutrition?.proteinGrams ?? null,
      carbsGrams: result.nutrition?.carbsGrams ?? null,
      fatGrams: result.nutrition?.fatGrams ?? null,
      facts: result.nutrition?.facts ?? null,
      confidenceScore: result.confidenceScore,
      highlightSpans: result.highlightSpans ?? [],
      dietaryFlags: result.dietaryFlags ?? [],
    });
  } catch (err) {
    console.error("nutrition-quick-estimate failed:", err);
    return NextResponse.json({ error: "Estimate failed" }, { status: 500 });
  }
}
