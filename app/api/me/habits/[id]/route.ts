import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  deleteHabit,
  getHabit,
  isHabitBucket,
  type HabitBucket,
  updateHabit,
} from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Habit ID required" },
      { status: 400 }
    );
  }
  try {
    const habit = await getHabit(id, userId);
    if (!habit) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(habit);
  } catch (err) {
    console.error("Failed to fetch habit:", err);
    return NextResponse.json(
      { error: "Failed to fetch habit" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Habit ID required" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const updates: {
      name?: string;
      description?: string;
      howToFollowThrough?: string;
      tips?: string;
      bucket?: HabitBucket;
    } = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.description === "string") updates.description = body.description;
    if (typeof body.howToFollowThrough === "string") updates.howToFollowThrough = body.howToFollowThrough;
    if (typeof body.tips === "string") updates.tips = body.tips;
    if (body.bucket !== undefined) {
      if (!isHabitBucket(body.bucket)) {
        return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
      }
      updates.bucket = body.bucket;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    const updated = await updateHabit(id, userId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }
    const habit = await getHabit(id, userId);
    return NextResponse.json(habit);
  } catch (err) {
    console.error("Failed to update habit:", err);
    return NextResponse.json(
      { error: "Failed to update habit" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Habit ID required" },
      { status: 400 }
    );
  }
  try {
    const deleted = await deleteHabit(id, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete habit:", err);
    return NextResponse.json(
      { error: "Failed to delete habit" },
      { status: 500 }
    );
  }
}
