import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedTranscripts, getUserSettings } from "@/lib/db";

const DEFAULT_GOALS = {
  caloriesTarget: 2000,
  carbsGrams: 250,
  proteinGrams: 125,
  fatGrams: 56,
};

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [transcripts, settings] = await Promise.all([
    getSavedTranscripts(userId),
    getUserSettings(userId),
  ]);

  const goals = {
    caloriesTarget: settings?.goalCaloriesTarget ?? DEFAULT_GOALS.caloriesTarget,
    carbsGrams: settings?.goalCarbsGrams ?? DEFAULT_GOALS.carbsGrams,
    proteinGrams: settings?.goalProteinGrams ?? DEFAULT_GOALS.proteinGrams,
    fatGrams: settings?.goalFatGrams ?? DEFAULT_GOALS.fatGrams,
  };

  const todayKey = toDayKey(new Date());
  let caloriesFood = 0;
  let caloriesExercise = 0;
  let carbsGrams = 0;
  let proteinGrams = 0;
  let fatGrams = 0;

  for (const t of transcripts) {
    if (t.sourceType !== "journal" || !t.transcriptText) continue;
    if (t.transcriptText.includes("Source: Habit completion")) continue;

    let itemDayKey: string | null = null;
    if (
      typeof t.journalEntryYear === "number" &&
      typeof t.journalEntryMonth === "number" &&
      typeof t.journalEntryDay === "number"
    ) {
      itemDayKey = toDayKey(new Date(t.journalEntryYear, t.journalEntryMonth - 1, t.journalEntryDay));
    } else if (t.createdAt) {
      const d = new Date(t.createdAt);
      if (!Number.isNaN(d.getTime())) itemDayKey = toDayKey(d);
    }
    if (itemDayKey !== todayKey) continue;

    if (t.journalCategory === "nutrition") {
      const cal = extractNumber(t.transcriptText, /- Calories:\s*([\d.]+)\s*kcal/i);
      const c = extractNumber(t.transcriptText, /- Carbs:\s*([\d.]+)\s*g/i);
      const p = extractNumber(t.transcriptText, /- Protein:\s*([\d.]+)\s*g/i);
      const f = extractNumber(t.transcriptText, /- Fat:\s*([\d.]+)\s*g/i);
      if (cal !== null) caloriesFood += cal;
      if (c !== null) carbsGrams += c;
      if (p !== null) proteinGrams += p;
      if (f !== null) fatGrams += f;
    }

    if (t.journalCategory === "exercise") {
      const burned = extractNumber(t.transcriptText, /- Calories burned:\s*([\d.]+)\s*kcal/i);
      if (burned !== null) caloriesExercise += burned;
    }
  }

  return NextResponse.json({
    caloriesFood: Math.round(caloriesFood),
    caloriesTarget: goals.caloriesTarget,
    caloriesRemaining: Math.round(goals.caloriesTarget - caloriesFood + caloriesExercise),
    proteinGrams: Math.round(proteinGrams),
    proteinTarget: goals.proteinGrams,
    carbsGrams: Math.round(carbsGrams),
    carbsTarget: goals.carbsGrams,
    fatGrams: Math.round(fatGrams),
    fatTarget: goals.fatGrams,
  });
}
