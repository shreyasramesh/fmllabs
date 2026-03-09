import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getNuggets, createNugget } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getNuggets(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch nuggets:", err);
    return NextResponse.json(
      { error: "Failed to fetch nuggets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const content = body.content as string | undefined;
    const source = body.source as string | undefined;
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }
    const nugget = await createNugget(userId, content, source);
    return NextResponse.json(nugget);
  } catch (err) {
    console.error("Failed to create nugget:", err);
    return NextResponse.json(
      { error: "Failed to create nugget" },
      { status: 500 }
    );
  }
}
