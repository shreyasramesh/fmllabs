import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  categorizeBrainDump,
  BRAIN_DUMP_BUNDLE_CALORIE_MAX_CHARS,
  type BrainDumpCategory,
} from "@/lib/gemini";
import { persistBrainDumpFields, validateBrainDumpFields } from "@/lib/brain-dump-persist";
import { parseClientQuickCalorieSnapshot } from "@/lib/quick-calorie-snapshot";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const MAX_TRANSCRIPT_LENGTH = 20_000;
const MAX_BATCH = 12;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 20, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({})) as {
      text?: unknown;
      clientQuickCalories?: unknown;
      habitTags?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Transcript text is required" }, { status: 400 });
    }
    if (text.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: `Transcript must be at most ${MAX_TRANSCRIPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const entries = await categorizeBrainDump(
      text,
      { userId, eventType: "brain_dump_quick_note" },
      { bundleCalorieEstimate: text.length <= BRAIN_DUMP_BUNDLE_CALORIE_MAX_CHARS }
    );

    if (entries.length === 0 || entries.length > MAX_BATCH) {
      return NextResponse.json({ error: "Could not categorize this note" }, { status: 400 });
    }

    const results: { id: string; category: BrainDumpCategory }[] = [];
    const errors: string[] = [];
    const clientSnaps = Array.isArray(body.clientQuickCalories) ? body.clientQuickCalories : null;
    /** Inline estimate is for one combined line; only safe when categorize returns a single entry. */
    const useClientQuickRow =
      clientSnaps != null &&
      clientSnaps.length > 0 &&
      entries.length === 1;
    const habitTags = Array.isArray(body.habitTags)
      ? (body.habitTags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 20)
      : undefined;

    for (let i = 0; i < entries.length; i += 1) {
      const fields = entries[i];
      const validationError = validateBrainDumpFields(fields);
      if (validationError) {
        errors.push(`Entry ${i + 1}: ${validationError}`);
        continue;
      }
      try {
        const suffix = `_quick_${i}`;
        const clientQuickCalorie =
          useClientQuickRow && clientSnaps
            ? parseClientQuickCalorieSnapshot(clientSnaps[0])
            : null;
        const saved = await persistBrainDumpFields(userId, fields, {
          geminiEventSuffix: suffix,
          originalText: text,
          ...(clientQuickCalorie ? { clientQuickCalorie } : {}),
          ...(habitTags?.length ? { habitTags } : {}),
        });
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
    console.error("Brain dump quick-note failed:", err);
    return NextResponse.json({ error: "Quick note save failed" }, { status: 500 });
  }
}
