import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateHabitFromManualDraft } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import { isHabitBucket } from "@/lib/habit-buckets";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const bucket = body.bucket;
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    if (
      !isHabitBucket(bucket) ||
      !name ||
      typeof name !== "string" ||
      !String(name).trim() ||
      !description ||
      typeof description !== "string" ||
      !String(description).trim()
    ) {
      return NextResponse.json(
        { error: "bucket, name, and description are required" },
        { status: 400 }
      );
    }
    const languageCode =
      typeof body.language === "string" && isValidLanguageCode(body.language)
        ? body.language
        : "en";
    const languageName = getLanguageName(languageCode);

    const result = await generateHabitFromManualDraft(
      {
        bucket,
        name: String(name).trim(),
        description: String(description).trim(),
      },
      languageName,
      { userId, eventType: "generate_habit_manual" }
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate habit from manual draft:", err);
    return NextResponse.json(
      { error: "Failed to generate habit" },
      { status: 500 }
    );
  }
}
