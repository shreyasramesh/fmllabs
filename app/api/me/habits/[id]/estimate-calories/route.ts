import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHabit, updateHabit } from "@/lib/db";
import { estimateHabitCalorieImpact } from "@/lib/gemini";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const { id: habitId } = await params;
    if (!habitId?.trim()) {
      return NextResponse.json({ error: "Missing habit id" }, { status: 400 });
    }
    const habit = await getHabit(habitId.trim(), userId);
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    const impact = await estimateHabitCalorieImpact(
      { name: habit.name, description: habit.description },
      { userId, eventType: "estimate_habit_calories" }
    );
    await updateHabit(habitId.trim(), userId, {
      calorieImpact: impact ?? null,
    });
    return NextResponse.json({ calorieImpact: impact });
  } catch (err) {
    console.error("Failed to estimate habit calorie impact:", err);
    return NextResponse.json(
      { error: "Failed to estimate calorie impact" },
      { status: 500 }
    );
  }
}
