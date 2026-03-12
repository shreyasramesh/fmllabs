import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadAllMentalModelsWithWhenToUse } from "@/lib/mental-models";
import { getUserMentalModels } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";

function normalizeWhenToUse(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && !Array.isArray(item))
        return Object.keys(item)[0] ?? "";
      return String(item ?? "");
    })
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const models = loadAllMentalModelsWithWhenToUse(lang);
  const { userId } = await auth();
  if (userId) {
    const userModels = await getUserMentalModels(userId);
    for (const m of userModels) {
      models.push({
        id: m.id,
        name: m.name,
        when_to_use: normalizeWhenToUse(m.when_to_use),
      });
    }
  }
  return NextResponse.json(models);
}
