import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { persistBrainDumpFields, validateBrainDumpFields, isValidBrainDumpCategory } from "@/lib/brain-dump-persist";
import type { BrainDumpResult } from "@/lib/gemini";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

function bodyToBrainDumpResult(body: Record<string, unknown>): BrainDumpResult | null {
  const category = body.category;
  if (!isValidBrainDumpCategory(category)) return null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const toStr = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    category,
    title: title.slice(0, 120) || "Brain Dump",
    reflectionText: toStr(body.reflectionText),
    conceptSummary: toStr(body.conceptSummary),
    conceptEnrichmentPrompt: toStr(body.conceptEnrichmentPrompt),
    experimentDescription: toStr(body.experimentDescription),
    experimentHowTo: toStr(body.experimentHowTo),
    experimentTips: toStr(body.experimentTips),
    nutritionText: toStr(body.nutritionText),
    exerciseText: toStr(body.exerciseText),
    weightKg: toNum(body.weightKg),
    sleepHours: toNum(body.sleepHours),
    hrvMs: body.hrvMs === null ? null : toNum(body.hrvMs),
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const fields = bodyToBrainDumpResult(body);
    if (!fields) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const validationError = validateBrainDumpFields(fields);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const saved = await persistBrainDumpFields(userId, fields);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("Brain dump save failed:", err);
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
