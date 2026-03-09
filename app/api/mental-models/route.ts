import { NextResponse } from "next/server";
import { loadMentalModelsIndex } from "@/lib/mental-models";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const index = loadMentalModelsIndex(lang);
  const list = index.mental_models.map((m) => ({ id: m.id, name: m.name }));
  return NextResponse.json(list);
}
