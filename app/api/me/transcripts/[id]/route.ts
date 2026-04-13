import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscript, deleteSavedTranscript, updateSavedTranscriptText, updateTranscriptHabitTags, updateTranscriptSortOverride } from "@/lib/db";
import { upsertSpendAmountLine } from "@/lib/spend-journal";
import { estimateNutritionFactsFromMacros } from "@/lib/gemini";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlGet = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rlGet.allowed) return tooManyRequestsResponse(rlGet.resetMs);
  const { id } = await params;
  try {
    const transcript = await getSavedTranscript(id, userId);
    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }
    return NextResponse.json(transcript);
  } catch (err) {
    console.error("Failed to fetch transcript:", err);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlDel = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlDel.allowed) return tooManyRequestsResponse(rlDel.resetMs);
  const { id } = await params;
  try {
    const deleted = await deleteSavedTranscript(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete transcript:", err);
    return NextResponse.json(
      { error: "Failed to delete transcript" },
      { status: 500 }
    );
  }
}

function parseNumberish(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatStatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function upsertStatLine(lines: string[], label: string, value: number, unit: string): string[] {
  const prefix = `- ${label}:`;
  const nextLine = `${prefix} ${formatStatValue(value)} ${unit}`.trim();
  const idx = lines.findIndex((line) => line.toLowerCase().startsWith(prefix.toLowerCase()));
  if (idx >= 0) {
    const updated = lines.slice();
    updated[idx] = nextLine;
    return updated;
  }
  return [...lines, nextLine];
}

function extractNutritionContextFromTranscript(text: string): string {
  const normalized = text.replace(/\r/g, "");
  const enrichedMatch = /Enriched entry:\s*([\s\S]*?)(?:\n\n|$)/i.exec(normalized);
  if (enrichedMatch?.[1]?.trim()) return enrichedMatch[1].trim();
  return normalized.slice(0, 1200).trim();
}

const NUTRITION_FACT_LINE_SPECS: Array<{
  key:
    | "totalCarbohydratesGrams"
    | "dietaryFiberGrams"
    | "sugarGrams"
    | "addedSugarsGrams"
    | "sugarAlcoholsGrams"
    | "netCarbsGrams"
    | "saturatedFatGrams"
    | "transFatGrams"
    | "polyunsaturatedFatGrams"
    | "monounsaturatedFatGrams"
    | "cholesterolMg"
    | "sodiumMg"
    | "calciumMg"
    | "ironMg"
    | "potassiumMg"
    | "vitaminAIu"
    | "vitaminCMg"
    | "vitaminDMcg";
  label: string;
  unit: string;
}> = [
  { key: "totalCarbohydratesGrams", label: "Total Carbohydrates", unit: "g" },
  { key: "dietaryFiberGrams", label: "Dietary Fiber", unit: "g" },
  { key: "sugarGrams", label: "Sugar", unit: "g" },
  { key: "addedSugarsGrams", label: "Added Sugars", unit: "g" },
  { key: "sugarAlcoholsGrams", label: "Sugar Alcohols", unit: "g" },
  { key: "netCarbsGrams", label: "Net Carbs", unit: "g" },
  { key: "saturatedFatGrams", label: "Saturated Fat", unit: "g" },
  { key: "transFatGrams", label: "Trans Fat", unit: "g" },
  { key: "polyunsaturatedFatGrams", label: "Polyunsaturated Fat", unit: "g" },
  { key: "monounsaturatedFatGrams", label: "Monounsaturated Fat", unit: "g" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "calciumMg", label: "Calcium", unit: "mg" },
  { key: "ironMg", label: "Iron", unit: "mg" },
  { key: "potassiumMg", label: "Potassium", unit: "mg" },
  { key: "vitaminAIu", label: "Vitamin A", unit: "IU" },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg" },
  { key: "vitaminDMcg", label: "Vitamin D", unit: "mcg" },
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlPatch = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlPatch.allowed) return tooManyRequestsResponse(rlPatch.resetMs);
  const { id } = await params;
  try {
    const transcript = await getSavedTranscript(id, userId);
    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }
    if (transcript.sourceType !== "journal") {
      return NextResponse.json({ error: "Only journal transcripts are editable" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      habitTags?: unknown;
      plainText?: unknown;
      sortOverrideMs?: unknown;
      calories?: unknown;
      proteinGrams?: unknown;
      carbsGrams?: unknown;
      fatGrams?: unknown;
      caloriesBurned?: unknown;
      carbsUsedGrams?: unknown;
      fatUsedGrams?: unknown;
      proteinDeltaGrams?: unknown;
      facts?: unknown;
      amount?: unknown;
      currency?: unknown;
    };

    // habitTags update — allowed on any journal entry regardless of category
    if (body.habitTags !== undefined) {
      if (!Array.isArray(body.habitTags)) {
        return NextResponse.json({ error: "habitTags must be an array" }, { status: 400 });
      }
      const tags = (body.habitTags as unknown[])
        .filter((t): t is string => typeof t === "string")
        .slice(0, 20);
      const ok = await updateTranscriptHabitTags(id, userId, tags);
      if (!ok) return NextResponse.json({ error: "Failed to update habit tags" }, { status: 500 });
      return NextResponse.json({ ok: true, habitTags: tags });
    }

    // sortOverrideMs update — reorder transcript entries
    if (body.sortOverrideMs !== undefined) {
      const sortMs = typeof body.sortOverrideMs === "number" ? body.sortOverrideMs : Number(body.sortOverrideMs);
      if (!Number.isFinite(sortMs) || sortMs <= 0) {
        return NextResponse.json({ error: "sortOverrideMs must be a positive number" }, { status: 400 });
      }
      const ok = await updateTranscriptSortOverride(id, userId, Math.round(sortMs));
      if (!ok) return NextResponse.json({ error: "Failed to update sort order" }, { status: 500 });
      return NextResponse.json({ ok: true, sortOverrideMs: Math.round(sortMs) });
    }

    // plainText update — for reflection entries and free-text edits on any journal entry
    if (body.plainText !== undefined) {
      if (typeof body.plainText !== "string" || !body.plainText.trim()) {
        return NextResponse.json({ error: "plainText must be a non-empty string" }, { status: 400 });
      }
      const newText = body.plainText.trim().slice(0, 8000);
      const updated = await updateSavedTranscriptText(id, userId, newText);
      if (!updated) return NextResponse.json({ error: "Failed to update transcript" }, { status: 500 });
      return NextResponse.json(updated);
    }

    if (
      transcript.journalCategory !== "nutrition" &&
      transcript.journalCategory !== "exercise" &&
      transcript.journalCategory !== "spend"
    ) {
      return NextResponse.json(
        { error: "Only nutrition, exercise, or spend journals are supported for text edits" },
        { status: 400 }
      );
    }

    const rawLines = (transcript.transcriptText ?? "").split(/\r?\n/);
    let lines = rawLines.slice();

    if (transcript.journalCategory === "spend") {
      const amount = parseNumberish(body.amount);
      const currencyRaw = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
      if (amount == null || amount <= 0 || amount > 1e7) {
        return NextResponse.json({ error: "Invalid spend amount" }, { status: 400 });
      }
      if (!/^[A-Z]{3}$/.test(currencyRaw)) {
        return NextResponse.json({ error: "currency must be a 3-letter ISO code" }, { status: 400 });
      }
      lines = upsertSpendAmountLine(lines, amount, currencyRaw);
    } else if (transcript.journalCategory === "nutrition") {
      const calories = parseNumberish(body.calories);
      const proteinGrams = parseNumberish(body.proteinGrams);
      const carbsGrams = parseNumberish(body.carbsGrams);
      const fatGrams = parseNumberish(body.fatGrams);
      if (
        calories == null ||
        proteinGrams == null ||
        carbsGrams == null ||
        fatGrams == null
      ) {
        return NextResponse.json({ error: "Invalid nutrition stats payload" }, { status: 400 });
      }
      const nutritionContextText = extractNutritionContextFromTranscript(transcript.transcriptText ?? "");
      const regeneratedFacts = await estimateNutritionFactsFromMacros(
        {
          entryText: nutritionContextText,
          calories,
          proteinGrams,
          carbsGrams,
          fatGrams,
        },
        { userId, eventType: "transcript_nutrition_reestimate_on_edit" }
      );
      lines = upsertStatLine(lines, "Calories", calories, "kcal");
      lines = upsertStatLine(lines, "Protein", proteinGrams, "g");
      lines = upsertStatLine(lines, "Carbs", carbsGrams, "g");
      lines = upsertStatLine(lines, "Fat", fatGrams, "g");
      const factOverridesRaw =
        body.facts && typeof body.facts === "object"
          ? (body.facts as Record<string, unknown>)
          : null;
      const factsByKey: Record<string, number | null | undefined> = {
        ...regeneratedFacts,
      };
      if (factOverridesRaw) {
        for (const { key } of NUTRITION_FACT_LINE_SPECS) {
          if (!(key in factOverridesRaw)) continue;
          const parsedOverride = parseNumberish(factOverridesRaw[key]);
          if (parsedOverride != null) {
            factsByKey[key] = parsedOverride;
          }
        }
      }
      for (const { key, label, unit } of NUTRITION_FACT_LINE_SPECS) {
        const value = factsByKey[key];
        if (value == null) continue;
        lines = upsertStatLine(lines, label, value, unit);
      }
    } else {
      const caloriesBurned = parseNumberish(body.caloriesBurned);
      const carbsUsedGrams = parseNumberish(body.carbsUsedGrams);
      const fatUsedGrams = parseNumberish(body.fatUsedGrams);
      const proteinDeltaGrams = parseNumberish(body.proteinDeltaGrams);
      if (
        caloriesBurned == null ||
        carbsUsedGrams == null ||
        fatUsedGrams == null ||
        proteinDeltaGrams == null
      ) {
        return NextResponse.json({ error: "Invalid exercise stats payload" }, { status: 400 });
      }
      lines = upsertStatLine(lines, "Calories burned", caloriesBurned, "kcal");
      lines = upsertStatLine(lines, "Carbs used", carbsUsedGrams, "g");
      lines = upsertStatLine(lines, "Fat used", fatUsedGrams, "g");
      lines = upsertStatLine(lines, "Protein delta", proteinDeltaGrams, "g");
    }

    const updatedText = lines.join("\n").trim();
    const updated = await updateSavedTranscriptText(id, userId, updatedText);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update transcript" }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update transcript:", err);
    return NextResponse.json({ error: "Failed to update transcript" }, { status: 500 });
  }
}
