import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { translateTitlesBatch } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const items = body.items as { id: string; title: string }[] | undefined;
    const language = body.language as string | undefined;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ translations: {} });
    }
    if (!language || !isValidLanguageCode(language) || language === "en") {
      return NextResponse.json({
        translations: Object.fromEntries(items.map((i) => [i.id, i.title])),
      });
    }

    const languageName = getLanguageName(language);
    const translations = await translateTitlesBatch(items, languageName);
    return NextResponse.json({ translations });
  } catch (err) {
    console.error("Failed to translate titles:", err);
    return NextResponse.json(
      { error: "Failed to translate titles" },
      { status: 500 }
    );
  }
}
