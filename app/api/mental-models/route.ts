import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadMentalModelsIndex } from "@/lib/mental-models";
import { getUserMentalModels } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const index = loadMentalModelsIndex(lang);
  const list = index.mental_models.map((m) => ({ id: m.id, name: m.name }));
  const { userId } = await auth();
  if (userId) {
    const userModels = await getUserMentalModels(userId);
    for (const m of userModels) {
      list.push({ id: m.id, name: m.name });
    }
  }
  return NextResponse.json(list, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
