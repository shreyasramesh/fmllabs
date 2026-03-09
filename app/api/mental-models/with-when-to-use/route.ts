import { NextResponse } from "next/server";
import { loadAllMentalModelsWithWhenToUse } from "@/lib/mental-models";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const models = loadAllMentalModelsWithWhenToUse(lang);
  return NextResponse.json(models);
}
