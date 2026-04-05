import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteAllUserData } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const CONFIRM_PHRASE = "delete everything";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const confirmPhrase = typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : "";
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `You must type "${CONFIRM_PHRASE}" to confirm` },
        { status: 400 }
      );
    }
    await deleteAllUserData(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete user data:", err);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
