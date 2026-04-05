import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserScore } from "@/lib/score";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const user = await currentUser();
    const displayName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Anonymous"
      : undefined;
    const imageUrl = user?.imageUrl;
    const score = await getUserScore(userId, { displayName, imageUrl });
    return NextResponse.json(score);
  } catch (err) {
    console.error("Failed to fetch score:", err);
    return NextResponse.json({ error: "Failed to fetch score" }, { status: 500 });
  }
}
