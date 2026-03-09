import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSession, updateSession } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  try {
    const session = await getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await updateSession(sessionId, userId, { isCollapsed: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Restart error:", err);
    return NextResponse.json(
      { error: "Failed to restart conversation" },
      { status: 500 }
    );
  }
}
