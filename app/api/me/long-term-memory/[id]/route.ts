import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLongTermMemory, updateLongTermMemory, deleteLongTermMemory } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlPatch = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlPatch.allowed) return tooManyRequestsResponse(rlPatch.resetMs);
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Long-term memory ID required" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const enrichmentPrompt = body.enrichmentPrompt as string | undefined;
    const title = body.title as string | undefined;
    const summary = body.summary as string | undefined;
    const updates: { enrichmentPrompt?: string; title?: string; summary?: string } = {};
    if (typeof enrichmentPrompt === "string") updates.enrichmentPrompt = enrichmentPrompt;
    if (typeof title === "string") updates.title = title;
    if (typeof summary === "string") updates.summary = summary;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    const updated = await updateLongTermMemory(id, userId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Long-term memory not found" },
        { status: 404 }
      );
    }
    const ltm = await getLongTermMemory(id, userId);
    return NextResponse.json(ltm);
  } catch (err) {
    console.error("Failed to update long-term memory:", err);
    return NextResponse.json(
      { error: "Failed to update long-term memory" },
      { status: 500 }
    );
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
  const rlDel = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlDel.allowed) return tooManyRequestsResponse(rlDel.resetMs);
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Long-term memory ID required" },
      { status: 400 }
    );
  }
  try {
    const deleted = await deleteLongTermMemory(id, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Long-term memory not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete long-term memory:", err);
    return NextResponse.json(
      { error: "Failed to delete long-term memory" },
      { status: 500 }
    );
  }
}
