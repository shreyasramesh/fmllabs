import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  listCustomMentors,
  createCustomMentor,
  CUSTOM_MENTOR_DESCRIPTION_MAX,
  CUSTOM_MENTOR_NAME_MAX,
  CUSTOM_MENTORS_MAX_PER_USER,
} from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const items = await listCustomMentors(userId);
    return NextResponse.json({ mentors: items });
  } catch (err) {
    console.error("Failed to list custom mentors:", err);
    return NextResponse.json({ error: "Failed to list custom mentors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name as string | undefined;
    const description = typeof body.description === "string" ? body.description : "";
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.length > CUSTOM_MENTOR_NAME_MAX || description.length > CUSTOM_MENTOR_DESCRIPTION_MAX) {
      return NextResponse.json(
        {
          error: `name max ${CUSTOM_MENTOR_NAME_MAX} chars, description max ${CUSTOM_MENTOR_DESCRIPTION_MAX}`,
        },
        { status: 400 }
      );
    }
    const created = await createCustomMentor(userId, name, description);
    if (!created) {
      return NextResponse.json(
        { error: `Name required, or you already have ${CUSTOM_MENTORS_MAX_PER_USER} custom mentors` },
        { status: 400 }
      );
    }
    return NextResponse.json(created);
  } catch (err) {
    console.error("Failed to create custom mentor:", err);
    return NextResponse.json({ error: "Failed to create custom mentor" }, { status: 500 });
  }
}
