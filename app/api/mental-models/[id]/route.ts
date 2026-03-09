import { NextResponse } from "next/server";
import { loadMentalModelContent } from "@/lib/mental-models";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const model = loadMentalModelContent(id, lang);
  if (!model) {
    return NextResponse.json({ error: "Mental model not found" }, { status: 404 });
  }
  return NextResponse.json(model);
}
