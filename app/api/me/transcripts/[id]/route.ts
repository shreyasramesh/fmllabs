import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscript, deleteSavedTranscript, updateSavedTranscriptText } from "@/lib/db";
import { estimateNutritionFactsFromMacros } from "@/lib/gemini";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const transcript = await getSavedTranscript(id, userId);
    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }
    if (transcript.sourceType !== "journal") {
      return NextResponse.json({ error: "Only journal transcripts are editable" }, { status: 400 });
    }
    if (
      transcript.journalCategory !== "nutrition" &&
      transcript.journalCategory !== "exercise"
    ) {
      return NextResponse.json({ error: "Only nutrition/exercise journals are supported" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      calories?: unknown;
      proteinGrams?: unknown;
      carbsGrams?: unknown;
      fatGrams?: unknown;
      caloriesBurned?: unknown;
      carbsUsedGrams?: unknown;
      fatUsedGrams?: unknown;
      proteinDeltaGrams?: unknown;
    };
    const rawLines = (transcript.transcriptText ?? "").split(/\r?\n/);
    let lines = rawLines.slice();

    if (transcript.journalCategory === "nutrition") {
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
      if (regeneratedFacts.totalCarbohydratesGrams != null) {
        lines = upsertStatLine(lines, "Total Carbohydrates", regeneratedFacts.totalCarbohydratesGrams, "g");
      }
      if (regeneratedFacts.dietaryFiberGrams != null) {
        lines = upsertStatLine(lines, "Dietary Fiber", regeneratedFacts.dietaryFiberGrams, "g");
      }
      if (regeneratedFacts.sugarGrams != null) {
        lines = upsertStatLine(lines, "Sugar", regeneratedFacts.sugarGrams, "g");
      }
      if (regeneratedFacts.addedSugarsGrams != null) {
        lines = upsertStatLine(lines, "Added Sugars", regeneratedFacts.addedSugarsGrams, "g");
      }
      if (regeneratedFacts.sugarAlcoholsGrams != null) {
        lines = upsertStatLine(lines, "Sugar Alcohols", regeneratedFacts.sugarAlcoholsGrams, "g");
      }
      if (regeneratedFacts.netCarbsGrams != null) {
        lines = upsertStatLine(lines, "Net Carbs", regeneratedFacts.netCarbsGrams, "g");
      }
      if (regeneratedFacts.saturatedFatGrams != null) {
        lines = upsertStatLine(lines, "Saturated Fat", regeneratedFacts.saturatedFatGrams, "g");
      }
      if (regeneratedFacts.transFatGrams != null) {
        lines = upsertStatLine(lines, "Trans Fat", regeneratedFacts.transFatGrams, "g");
      }
      if (regeneratedFacts.polyunsaturatedFatGrams != null) {
        lines = upsertStatLine(lines, "Polyunsaturated Fat", regeneratedFacts.polyunsaturatedFatGrams, "g");
      }
      if (regeneratedFacts.monounsaturatedFatGrams != null) {
        lines = upsertStatLine(lines, "Monounsaturated Fat", regeneratedFacts.monounsaturatedFatGrams, "g");
      }
      if (regeneratedFacts.cholesterolMg != null) {
        lines = upsertStatLine(lines, "Cholesterol", regeneratedFacts.cholesterolMg, "mg");
      }
      if (regeneratedFacts.sodiumMg != null) {
        lines = upsertStatLine(lines, "Sodium", regeneratedFacts.sodiumMg, "mg");
      }
      if (regeneratedFacts.calciumMg != null) {
        lines = upsertStatLine(lines, "Calcium", regeneratedFacts.calciumMg, "mg");
      }
      if (regeneratedFacts.ironMg != null) {
        lines = upsertStatLine(lines, "Iron", regeneratedFacts.ironMg, "mg");
      }
      if (regeneratedFacts.potassiumMg != null) {
        lines = upsertStatLine(lines, "Potassium", regeneratedFacts.potassiumMg, "mg");
      }
      if (regeneratedFacts.vitaminAIu != null) {
        lines = upsertStatLine(lines, "Vitamin A", regeneratedFacts.vitaminAIu, "IU");
      }
      if (regeneratedFacts.vitaminCMg != null) {
        lines = upsertStatLine(lines, "Vitamin C", regeneratedFacts.vitaminCMg, "mg");
      }
      if (regeneratedFacts.vitaminDMcg != null) {
        lines = upsertStatLine(lines, "Vitamin D", regeneratedFacts.vitaminDMcg, "mcg");
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
