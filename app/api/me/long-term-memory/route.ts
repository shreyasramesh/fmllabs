import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLongTermMemories } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const items = await getLongTermMemories(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch long-term memory:", err);
    return NextResponse.json(
      { error: "Failed to fetch long-term memory" },
      { status: 500 }
    );
  }
}
