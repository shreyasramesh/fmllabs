import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  loadMentalModelContent,
  getOneLiner,
} from "@/lib/mental-models";
import { getUserMentalModelById } from "@/lib/db";
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
  const { userId } = await auth();
  const result: Record<string, { oneLiner: string; quickIntro: string }> = {};
  for (const id of ids) {
    if (id.startsWith("custom_") && userId) {
      const userModel = await getUserMentalModelById(userId, id);
      if (userModel) {
        result[id] = {
          oneLiner: getOneLiner(userModel),
          quickIntro:
            userModel.quick_introduction.slice(0, 120) +
            (userModel.quick_introduction.length > 120 ? "…" : ""),
        };
      }
    } else {
      const model = loadMentalModelContent(id, lang);
      if (model) {
        result[id] = {
          oneLiner: getOneLiner(model),
          quickIntro:
            model.quick_introduction.slice(0, 120) +
            (model.quick_introduction.length > 120 ? "…" : ""),
        };
      }
    }
  }
  return NextResponse.json(result);
}
