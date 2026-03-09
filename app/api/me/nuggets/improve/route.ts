import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { improveNuggetText } from "@/lib/gemini";

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
    const improved = await improveNuggetText(content);
    return NextResponse.json({ improved });
  } catch (err) {
    console.error("Failed to improve nugget:", err);
    return NextResponse.json(
      { error: "Failed to improve nugget" },
      { status: 500 }
    );
  }
}
