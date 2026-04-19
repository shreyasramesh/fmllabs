import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDailyGoal, upsertDailyGoal } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const goal = await getDailyGoal(userId, todayKey());
  return NextResponse.json({ confirmed: !!goal, goal });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 10, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const body = (await request.json().catch(() => ({}))) as {
    caloriesTarget?: unknown;
    exercisePlan?: unknown;
    focusAreas?: unknown;
  };

  const caloriesTarget =
    typeof body.caloriesTarget === "number" && Number.isFinite(body.caloriesTarget)
      ? Math.round(Math.max(800, Math.min(6000, body.caloriesTarget)))
      : 2000;
  const exercisePlan =
    typeof body.exercisePlan === "string" ? body.exercisePlan.slice(0, 200) : "";
  const focusAreas = Array.isArray(body.focusAreas)
    ? body.focusAreas.filter((a: unknown): a is string => typeof a === "string").slice(0, 5)
    : [];

  await upsertDailyGoal(userId, todayKey(), { caloriesTarget, exercisePlan, focusAreas });
  return NextResponse.json({ ok: true });
}
