import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  saveJournalTranscript,
  addWeightEntry,
  addSleepEntry,
  addFocusEntry,
  createHabit,
  getHabits,
  upsertUserSettings,
  createCustomConcept,
  getDb,
} from "@/lib/db";
import { ObjectId } from "mongodb";
import type {
  NutritionImportRow,
  ExerciseImportRow,
  WeightImportRow,
  SleepImportRow,
  FocusImportRow,
  HabitImportRow,
  HabitCompletionImportRow,
  ReflectionImportRow,
  GoalImportRow,
  ConceptImportRow,
} from "@/lib/import-parser";

function parseDateParts(dateStr: string): { day: number; month: number; year: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function parseTimeParts(timeStr: string): { hour: number; minute: number } {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return { hour: 12, minute: 0 };
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h, minute: m };
}

function formatNutritionTranscript(r: NutritionImportRow): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Nutrition)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(r.description);
  lines.push("");
  lines.push(`- Calories: ${r.calories ?? "unknown"} kcal`);
  lines.push(`- Protein: ${r.protein ?? "unknown"} g`);
  lines.push(`- Carbs: ${r.carbs ?? "unknown"} g`);
  lines.push(`- Fat: ${r.fat ?? "unknown"} g`);
  lines.push(`- Dietary Fiber: ${r.fiber ?? "unknown"} g`);
  lines.push(`- Sugar: ${r.sugar ?? "unknown"} g`);
  lines.push(`- Sodium: ${r.sodium ?? "unknown"} mg`);
  lines.push(`- Caffeine: ${r.caffeine ?? "unknown"} mg`);
  if (r.tag) lines.push(`- Tag: ${r.tag}`);
  if (r.notes) lines.push(`- Notes: ${r.notes}`);
  lines.push("");
  lines.push("Assumptions:");
  lines.push("- Imported from external source");
  return lines.join("\n");
}

function formatExerciseTranscript(r: ExerciseImportRow): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Exercise)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(r.description);
  if (r.duration != null) lines.push(`- Duration: ${r.duration} min`);
  lines.push("");
  lines.push(`- Calories burned: ${r.caloriesBurned ?? "unknown"} kcal`);
  if (r.tag) lines.push(`- Tag: ${r.tag}`);
  if (r.notes) lines.push(`- Notes: ${r.notes}`);
  lines.push("");
  lines.push("Assumptions:");
  lines.push("- Imported from external source");
  return lines.join("\n");
}

interface ImportSections {
  nutrition?: NutritionImportRow[];
  exercise?: ExerciseImportRow[];
  weight?: WeightImportRow[];
  sleep?: SleepImportRow[];
  focus?: FocusImportRow[];
  habits?: HabitImportRow[];
  habitCompletions?: HabitCompletionImportRow[];
  reflections?: ReflectionImportRow[];
  goals?: GoalImportRow[];
  concepts?: ConceptImportRow[];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sections: ImportSections };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sections = body.sections ?? {};
  const inserted: Record<string, number> = {};
  const errors: string[] = [];

  // --- Nutrition ---
  if (sections.nutrition?.length) {
    let count = 0;
    for (const row of sections.nutrition) {
      try {
        const date = parseDateParts(row.date);
        const time = parseTimeParts(row.time);
        const text = formatNutritionTranscript(row);
        const title = row.tag ? `${row.tag}: ${row.description}` : row.description;
        await saveJournalTranscript(userId, text, title.slice(0, 120), date, {
          journalCategory: "nutrition",
          journalEntryTime: time,
        });
        count++;
      } catch (err) {
        errors.push(`Nutrition "${row.description}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.nutrition = count;
  }

  // --- Exercise ---
  if (sections.exercise?.length) {
    let count = 0;
    for (const row of sections.exercise) {
      try {
        const date = parseDateParts(row.date);
        const time = parseTimeParts(row.time);
        const text = formatExerciseTranscript(row);
        const title = row.tag ? `${row.tag}: ${row.description}` : row.description;
        await saveJournalTranscript(userId, text, title.slice(0, 120), date, {
          journalCategory: "exercise",
          journalEntryTime: time,
        });
        count++;
      } catch (err) {
        errors.push(`Exercise "${row.description}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.exercise = count;
  }

  // --- Weight ---
  if (sections.weight?.length) {
    let count = 0;
    for (const row of sections.weight) {
      try {
        const date = parseDateParts(row.date);
        const recordedAt = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0));
        await addWeightEntry(userId, row.weightKg, { recordedAt });
        count++;
      } catch (err) {
        errors.push(`Weight ${row.date}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.weight = count;
  }

  // --- Sleep ---
  if (sections.sleep?.length) {
    let count = 0;
    for (const row of sections.sleep) {
      try {
        const date = parseDateParts(row.date);
        await addSleepEntry(userId, {
          sleepHours: row.hours,
          hrvMs: row.hrvMs,
          entryDay: date.day,
          entryMonth: date.month,
          entryYear: date.year,
        });
        count++;
      } catch (err) {
        errors.push(`Sleep ${row.date}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.sleep = count;
  }

  // --- Focus ---
  if (sections.focus?.length) {
    let count = 0;
    for (const row of sections.focus) {
      try {
        const date = parseDateParts(row.date);
        const start = parseTimeParts(row.startTime);
        const end = parseTimeParts(row.endTime);
        const startedAt = new Date(
          Date.UTC(date.year, date.month - 1, date.day, start.hour, start.minute)
        );
        const endedAt = new Date(
          Date.UTC(date.year, date.month - 1, date.day, end.hour, end.minute)
        );
        await addFocusEntry(userId, {
          tag: row.tag || "Focus",
          minutes: row.duration,
          startedAt,
          endedAt,
          entryDay: date.day,
          entryMonth: date.month,
          entryYear: date.year,
        });
        count++;
      } catch (err) {
        errors.push(`Focus ${row.date}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.focus = count;
  }

  // --- Habits (must run before completions) ---
  const habitNameToId = new Map<string, string>();
  if (sections.habits?.length) {
    let count = 0;
    for (const row of sections.habits) {
      try {
        const created = await createHabit(userId, {
          sourceType: "manual",
          sourceId: "",
          bucket: row.bucket,
          name: row.name,
          description: row.description,
          howToFollowThrough: "",
          tips: "",
        });
        habitNameToId.set(row.name.toLowerCase(), created._id);
        count++;
      } catch (err) {
        errors.push(`Habit "${row.name}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.habits = count;
  }

  // --- Habit Completions ---
  if (sections.habitCompletions?.length) {
    // Also load existing habits so completions can reference pre-existing ones
    if (habitNameToId.size === 0 || sections.habitCompletions.some((c) => !habitNameToId.has(c.habitName.toLowerCase()))) {
      try {
        const existing = await getHabits(userId);
        for (const h of existing) {
          if (!habitNameToId.has(h.name.toLowerCase())) {
            habitNameToId.set(h.name.toLowerCase(), h._id);
          }
        }
      } catch { /* best effort */ }
    }

    let count = 0;
    const database = await getDb();
    const col = database.collection("habit_completions");

    for (const row of sections.habitCompletions) {
      try {
        const habitId = habitNameToId.get(row.habitName.toLowerCase());
        if (!habitId) {
          errors.push(`Habit completion "${row.habitName}" on ${row.date}: habit not found`);
          continue;
        }
        const existing = await col.findOne({ userId, habitId, dateKey: row.date });
        if (existing) continue; // skip duplicates
        await col.insertOne({
          _id: new ObjectId(),
          userId,
          habitId,
          dateKey: row.date,
          completedAt: new Date(),
        });
        count++;
      } catch (err) {
        errors.push(`Habit completion "${row.habitName}" ${row.date}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.habitCompletions = count;
  }

  // --- Reflections ---
  if (sections.reflections?.length) {
    let count = 0;
    for (const row of sections.reflections) {
      try {
        const date = parseDateParts(row.date);
        const time = parseTimeParts(row.time);
        await saveJournalTranscript(userId, row.text, "Reflection", date, {
          journalEntryTime: time,
        });
        count++;
      } catch (err) {
        errors.push(`Reflection ${row.date}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.reflections = count;
  }

  // --- Goals ---
  if (sections.goals?.length) {
    try {
      const updates: Record<string, number> = {};
      for (const row of sections.goals) {
        const key = row.setting.toLowerCase();
        if (key === "daily calories target") updates.goalCaloriesTarget = row.value;
        else if (key === "daily protein target (g)") updates.goalProteinGrams = row.value;
        else if (key === "daily carbs target (g)") updates.goalCarbsGrams = row.value;
        else if (key === "daily fat target (g)") updates.goalFatGrams = row.value;
        // Target weight is informational; stored settings don't have a dedicated field yet
      }
      if (Object.keys(updates).length > 0) {
        await upsertUserSettings(userId, updates as Parameters<typeof upsertUserSettings>[1]);
        inserted.goals = Object.keys(updates).length;
      }
    } catch (err) {
      errors.push(`Goals: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  // --- Concepts ---
  if (sections.concepts?.length) {
    let count = 0;
    for (const row of sections.concepts) {
      try {
        await createCustomConcept(
          userId,
          row.title,
          row.summary,
          `Explore "${row.title}" further: key principles, applications, and related concepts.`
        );
        count++;
      } catch (err) {
        errors.push(`Concept "${row.title}": ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    inserted.concepts = count;
  }

  return NextResponse.json({ inserted, errors });
}
