import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHabit, updateHabit } from "@/lib/db";
import { generateHabitResearchNotes } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode, type LanguageCode } from "@/lib/languages";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Habit ID required" }, { status: 400 });
  }

  try {
    const habit = await getHabit(id, userId);
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { language?: string };
    const requestedLanguage = typeof body.language === "string" ? body.language : "";
    const languageCode: LanguageCode = isValidLanguageCode(requestedLanguage)
      ? requestedLanguage
      : "en";
    const languageName =
      languageCode === "en" ? "English" : getLanguageName(languageCode);

    const researchNotes = await generateHabitResearchNotes(
      {
        name: habit.name,
        description: habit.description,
        howToFollowThrough: habit.howToFollowThrough,
        tips: habit.tips,
        bucket: habit.bucket,
      },
      languageName,
      { userId, eventType: "generate_habit_research" }
    );

    await updateHabit(id, userId, {
      researchNotes: researchNotes.trim(),
      researchUpdatedAt: new Date(),
    });

    const updated = await getHabit(id, userId);
    return NextResponse.json(updated ?? habit);
  } catch (err) {
    console.error("Failed to generate habit research:", err);
    return NextResponse.json(
      { error: "Failed to generate research notes" },
      { status: 500 }
    );
  }
}

