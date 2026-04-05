import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSessions, createSession } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const sessions = await getSessions(userId);
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("Failed to fetch sessions:", err);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title as string | undefined;
    const responseVerbosityRaw = body.responseVerbosity;
    const responseVerbosity =
      responseVerbosityRaw === "compact" || responseVerbosityRaw === "detailed"
        ? responseVerbosityRaw
        : undefined;
    const session = await createSession(userId, title, responseVerbosity);
    return NextResponse.json(session);
  } catch (err) {
    console.error("Failed to create session:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
