import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCustomMentorById,
  updateCustomMentor,
  deleteCustomMentor,
  CUSTOM_MENTOR_DESCRIPTION_MAX,
  CUSTOM_MENTOR_NAME_MAX,
} from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Mentor id required" }, { status: 400 });
  }
  try {
    const mentor = await getCustomMentorById(userId, id.trim());
    if (!mentor) {
      return NextResponse.json({ error: "Custom mentor not found" }, { status: 404 });
    }
    return NextResponse.json(mentor);
  } catch (err) {
    console.error("Failed to fetch custom mentor:", err);
    return NextResponse.json({ error: "Failed to fetch custom mentor" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Mentor id required" }, { status: 400 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name as string | undefined;
    const description = body.description as string | undefined;
    const updates: { name?: string; description?: string } = {};
    if (typeof name === "string") updates.name = name;
    if (typeof description === "string") updates.description = description;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates (name or description)" }, { status: 400 });
    }
    if (
      (updates.name != null && updates.name.length > CUSTOM_MENTOR_NAME_MAX) ||
      (updates.description != null && updates.description.length > CUSTOM_MENTOR_DESCRIPTION_MAX)
    ) {
      return NextResponse.json(
        {
          error: `name max ${CUSTOM_MENTOR_NAME_MAX} chars, description max ${CUSTOM_MENTOR_DESCRIPTION_MAX}`,
        },
        { status: 400 }
      );
    }
    const updated = await updateCustomMentor(userId, id.trim(), updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Custom mentor not found or name cannot be empty" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update custom mentor:", err);
    return NextResponse.json({ error: "Failed to update custom mentor" }, { status: 500 });
  }
}

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
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Mentor id required" }, { status: 400 });
  }
  try {
    const ok = await deleteCustomMentor(userId, id.trim());
    if (!ok) {
      return NextResponse.json({ error: "Custom mentor not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete custom mentor:", err);
    return NextResponse.json({ error: "Failed to delete custom mentor" }, { status: 500 });
  }
}
