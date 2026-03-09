import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadMentalModelsIndex, loadMentalModelContent } from "@/lib/mental-models";
import { getSavedConcepts } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";

const OVERACHIEVER_MESSAGES = [
  "You've already learned them all! 🏆 The only thing left to teach you is... how to take a break. (We're kidding—you're amazing!)",
  "Wow, you've collected every mental model! At this point, you're basically a walking cognitive toolkit. Time to teach the rest of us!",
  "All concepts unlocked! You've achieved peak mental-model status. The only thing left is to invent a new one yourself. ✨",
  "You've mastered the entire library! We're officially out of ideas. Maybe try teaching the AI something? 😄",
];

export async function GET(request: Request) {
  const { userId } = await auth();

  try {
    const { searchParams } = new URL(request.url);
    const excludeIds = searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];
    const language = searchParams.get("language");
    const lang = language && isValidLanguageCode(language) ? language : undefined;

    const savedIds = new Set(excludeIds);
    if (userId) {
      const savedConcepts = await getSavedConcepts(userId);
      savedConcepts.forEach((c) => savedIds.add(c.modelId));
    }

    const index = loadMentalModelsIndex(lang);
    const available = index.mental_models.filter((m) => !savedIds.has(m.id));

    if (available.length === 0) {
      const message =
        OVERACHIEVER_MESSAGES[
          Math.floor(Math.random() * OVERACHIEVER_MESSAGES.length)
        ];
      return NextResponse.json({ overachiever: true, message });
    }

    const randomEntry = available[Math.floor(Math.random() * available.length)];
    const model = loadMentalModelContent(randomEntry.id, lang);
    if (!model) {
      return NextResponse.json(
        { error: "Mental model not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(model);
  } catch (err) {
    console.error("Failed to fetch random mental model:", err);
    return NextResponse.json(
      { error: "Failed to fetch mental model" },
      { status: 500 }
    );
  }
}
