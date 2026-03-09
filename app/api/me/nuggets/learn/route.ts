import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { explainNugget } from "@/lib/gemini";

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
    const explanation = await explainNugget(content);
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("Failed to learn nugget:", err);
    return NextResponse.json(
      { error: "Failed to learn nugget" },
      { status: 500 }
    );
  }
}
