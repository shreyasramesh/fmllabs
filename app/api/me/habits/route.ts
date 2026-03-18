import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHabits, createHabit } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getHabits(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch habits:", err);
    return NextResponse.json(
      { error: "Failed to fetch habits" },
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
    const sourceType = body.sourceType as "concept" | "ltm" | undefined;
    const sourceId = body.sourceId as string | undefined;
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    const howToFollowThrough = body.howToFollowThrough as string | undefined;
    const tips = body.tips as string | undefined;
    if (
      !sourceType ||
      (sourceType !== "concept" && sourceType !== "ltm") ||
      !sourceId ||
      typeof sourceId !== "string" ||
      !name ||
      typeof name !== "string" ||
      !description ||
      typeof description !== "string" ||
      !howToFollowThrough ||
      typeof howToFollowThrough !== "string" ||
      !tips ||
      typeof tips !== "string"
    ) {
      return NextResponse.json(
        { error: "sourceType, sourceId, name, description, howToFollowThrough, and tips are required" },
        { status: 400 }
      );
    }
    const habit = await createHabit(userId, {
      sourceType,
      sourceId: sourceId.trim(),
      name: name.trim(),
      description: description.trim(),
      howToFollowThrough: howToFollowThrough.trim(),
      tips: tips.trim(),
    });
    return NextResponse.json(habit);
  } catch (err) {
    console.error("Failed to create habit:", err);
    return NextResponse.json(
      { error: "Failed to create habit" },
      { status: 500 }
    );
  }
}
