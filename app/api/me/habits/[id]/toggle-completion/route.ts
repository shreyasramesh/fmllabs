import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHabit, toggleHabitCompletion } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const { id: habitId } = await params;
    if (!habitId || typeof habitId !== "string" || !habitId.trim()) {
      return NextResponse.json({ error: "Missing habit id" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const dateKey = body.dateKey as string | undefined;
    if (!dateKey || !DATE_KEY_RE.test(dateKey)) {
      return NextResponse.json(
        { error: "dateKey is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const habit = await getHabit(habitId.trim(), userId);
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    const calorieImpact = habit.calorieImpact
      ? {
          ...habit.calorieImpact,
          label: habit.calorieImpact.label?.trim() || habit.name?.trim() || "Habit completion",
        }
      : null;
    const result = await toggleHabitCompletion(userId, habitId.trim(), dateKey, calorieImpact);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to toggle habit completion:", err);
    return NextResponse.json(
      { error: "Failed to toggle habit completion" },
      { status: 500 }
    );
  }
}
