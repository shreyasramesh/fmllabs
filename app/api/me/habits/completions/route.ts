import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getHabitCompletions } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to || !DATE_KEY_RE.test(from) || !DATE_KEY_RE.test(to)) {
      return NextResponse.json(
        { error: "from and to query params required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const completions = await getHabitCompletions(userId, from, to);
    return NextResponse.json(completions);
  } catch (err) {
    console.error("Failed to fetch habit completions:", err);
    return NextResponse.json(
      { error: "Failed to fetch habit completions" },
      { status: 500 }
    );
  }
}
