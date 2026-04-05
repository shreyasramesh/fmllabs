import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteSavedPerspectiveCard } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deleted = await deleteSavedPerspectiveCard(id, userId);
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("Failed to delete saved perspective card:", err);
    return NextResponse.json(
      { error: "Failed to delete saved perspective card" },
      { status: 500 }
    );
  }
}
