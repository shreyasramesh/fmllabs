import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadMentalModelContent } from "@/lib/mental-models";
import { getUserMentalModelById } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const lang = language && isValidLanguageCode(language) ? language : undefined;
  if (id.startsWith("custom_")) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Mental model not found" }, { status: 404 });
    }
    const userModel = await getUserMentalModelById(userId, id);
    if (!userModel) {
      return NextResponse.json({ error: "Mental model not found" }, { status: 404 });
    }
    const { _id, userId: _uid, createdAt, updatedAt, ...rest } = userModel;
    return NextResponse.json(rest);
  }
  const model = loadMentalModelContent(id, lang);
  if (!model) {
    return NextResponse.json({ error: "Mental model not found" }, { status: 404 });
  }
  return NextResponse.json(model);
}
