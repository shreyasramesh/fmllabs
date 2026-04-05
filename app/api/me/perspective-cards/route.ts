import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSavedPerspectiveCards,
  createSavedPerspectiveCard,
} from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlGet = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rlGet.allowed) return tooManyRequestsResponse(rlGet.resetMs);
  try {
    const cards = await getSavedPerspectiveCards(userId);
    return NextResponse.json(cards);
  } catch (err) {
    console.error("Failed to fetch saved perspective cards:", err);
    return NextResponse.json(
      { error: "Failed to fetch saved perspective cards" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name as string | undefined;
    const prompt = body.prompt as string | undefined;
    const follow_ups = body.follow_ups as string[] | undefined;
    if (!name || typeof name !== "string" || !prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "name and prompt are required" },
        { status: 400 }
      );
    }
    const followUps = Array.isArray(follow_ups)
      ? follow_ups.filter((q): q is string => typeof q === "string")
      : [];
    const sourceDeckId = typeof body.sourceDeckId === "string" ? body.sourceDeckId : undefined;
    const sourceDeckName = typeof body.sourceDeckName === "string" ? body.sourceDeckName : undefined;
    const card = await createSavedPerspectiveCard(
      userId,
      name.trim(),
      prompt.trim(),
      followUps,
      sourceDeckId,
      sourceDeckName
    );
    return NextResponse.json(card);
  } catch (err) {
    console.error("Failed to save perspective card:", err);
    return NextResponse.json(
      { error: "Failed to save perspective card" },
      { status: 500 }
    );
  }
}
