import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  persistBrainDumpFields,
  validateBrainDumpFields,
  isValidBrainDumpCategory,
} from "@/lib/brain-dump-persist";
import type { BrainDumpCategory } from "@/lib/gemini";
import type { BrainDumpResult } from "@/lib/gemini";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

function itemToBrainDumpResult(raw: Record<string, unknown>): BrainDumpResult | null {
  const category = raw.category;
  if (!isValidBrainDumpCategory(category)) return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const toStr = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    category,
    title: title.slice(0, 120) || "Brain Dump",
    reflectionText: toStr(raw.reflectionText),
    conceptSummary: toStr(raw.conceptSummary),
    conceptEnrichmentPrompt: toStr(raw.conceptEnrichmentPrompt),
    experimentDescription: toStr(raw.experimentDescription),
    experimentHowTo: toStr(raw.experimentHowTo),
    experimentTips: toStr(raw.experimentTips),
    nutritionText: toStr(raw.nutritionText),
    exerciseText: toStr(raw.exerciseText),
    weightKg: toNum(raw.weightKg),
    sleepHours: toNum(raw.sleepHours),
    hrvMs: raw.hrvMs === null ? null : toNum(raw.hrvMs),
  };
}

const MAX_BATCH = 12;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 20, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({})) as { entries?: unknown };
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json({ error: "entries array is required" }, { status: 400 });
    }
    if (body.entries.length > MAX_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_BATCH} entries per batch` }, { status: 400 });
    }

    const results: { id: string; category: BrainDumpCategory }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < body.entries.length; i += 1) {
      const raw = body.entries[i];
      if (!raw || typeof raw !== "object") {
        errors.push(`Entry ${i + 1}: invalid`);
        continue;
      }
      const fields = itemToBrainDumpResult(raw as Record<string, unknown>);
      if (!fields) {
        errors.push(`Entry ${i + 1}: invalid category`);
        continue;
      }
      const validationError = validateBrainDumpFields(fields);
      if (validationError) {
        errors.push(`Entry ${i + 1}: ${validationError}`);
        continue;
      }
      try {
        const suffix = `_batch_${i}`;
        const saved = await persistBrainDumpFields(userId, fields, { geminiEventSuffix: suffix });
        results.push(saved);
      } catch (e) {
        errors.push(`Entry ${i + 1}: ${e instanceof Error ? e.message : "save failed"}`);
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: errors[0] ?? "Nothing saved", errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ results, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("Brain dump batch save failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
