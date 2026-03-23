import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHabit, getHabits, isHabitBucket } from "@/lib/db";

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
    const sourceType = body.sourceType as "concept" | "ltm" | "manual" | undefined;
    const sourceId = body.sourceId as string | undefined;
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    const howToFollowThrough = body.howToFollowThrough as string | undefined;
    const tips = body.tips as string | undefined;
    const bucket = body.bucket;
    const isManual = sourceType === "manual";
    const hasLinkedSource =
      sourceType === "concept" || sourceType === "ltm";
    if (
      !sourceType ||
      (!isManual && !hasLinkedSource) ||
      (!isManual &&
        (!sourceId ||
          typeof sourceId !== "string" ||
          !String(sourceId).trim())) ||
      !isHabitBucket(bucket) ||
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
        {
          error:
            "sourceType, bucket, name, description, howToFollowThrough, and tips are required; sourceId is required unless sourceType is manual",
        },
        { status: 400 }
      );
    }
    const habit = await createHabit(userId, {
      sourceType,
      sourceId: isManual ? "" : String(sourceId).trim(),
      bucket,
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
