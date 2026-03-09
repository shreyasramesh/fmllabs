import { NextResponse } from "next/server";
import {
  loadMentalModelContent,
  getOneLiner,
  getTryThis,
} from "@/lib/mental-models";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json(
      { error: "ids query parameter required" },
      { status: 400 }
    );
  }
  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({});
  }
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  const result: Record<
    string,
    { oneLiner: string; quickIntro: string }
  > = {};
  for (const id of ids) {
    const model = loadMentalModelContent(id, lang);
    if (model) {
      result[id] = {
        oneLiner: getOneLiner(model),
        quickIntro: model.quick_introduction.slice(0, 120) + (model.quick_introduction.length > 120 ? "…" : ""),
      };
    }
  }
  return NextResponse.json(result);
}
