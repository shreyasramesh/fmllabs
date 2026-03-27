import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscript, deleteSavedTranscript, updateSavedTranscriptText } from "@/lib/db";

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
      lines = upsertStatLine(lines, "Calories", calories, "kcal");
      lines = upsertStatLine(lines, "Protein", proteinGrams, "g");
      lines = upsertStatLine(lines, "Carbs", carbsGrams, "g");
      lines = upsertStatLine(lines, "Fat", fatGrams, "g");
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
