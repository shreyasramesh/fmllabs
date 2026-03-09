import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { truncateMessagesAfter } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const keepCount = body.keepCount as number | undefined;
    if (typeof keepCount !== "number" || keepCount < 0) {
      return NextResponse.json(
        { error: "keepCount must be a non-negative number" },
        { status: 400 }
      );
    }
    const ok = await truncateMessagesAfter(id, userId, keepCount);
    if (!ok) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to truncate messages:", err);
    return NextResponse.json(
      { error: "Failed to truncate messages" },
      { status: 500 }
    );
  }
}
