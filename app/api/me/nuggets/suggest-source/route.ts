import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { suggestNuggetSource } from "@/lib/gemini";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const content = body.content as string | undefined;
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }
    const source = await suggestNuggetSource(content);
    return NextResponse.json({ source });
  } catch (err) {
    console.error("Failed to suggest nugget source:", err);
    return NextResponse.json(
      { error: "Failed to suggest source" },
      { status: 500 }
    );
  }
}
