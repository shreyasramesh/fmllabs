import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConceptGroup,
  getCustomConceptsByIds,
  updateConceptGroup,
  deleteConceptGroup,
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
  const rlGet = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rlGet.allowed) return tooManyRequestsResponse(rlGet.resetMs);
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Concept group ID required" },
      { status: 400 }
    );
  }
  try {
    const group = await getConceptGroup(id, userId);
    if (!group) {
      return NextResponse.json(
        { error: "Concept group not found" },
        { status: 404 }
      );
    }
    const concepts =
      group.conceptIds.length > 0
        ? await getCustomConceptsByIds(group.conceptIds, userId)
        : [];
    return NextResponse.json({ ...group, concepts });
  } catch (err) {
    console.error("Failed to fetch concept group:", err);
    return NextResponse.json(
      { error: "Failed to fetch concept group" },
      { status: 500 }
    );
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
  const rlPatch = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlPatch.allowed) return tooManyRequestsResponse(rlPatch.resetMs);
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Concept group ID required" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title as string | undefined;
    const conceptIds = body.conceptIds as string[] | undefined;
    const updates: { title?: string; conceptIds?: string[] } = {};
    if (typeof title === "string") updates.title = title;
    if (Array.isArray(conceptIds)) updates.conceptIds = conceptIds;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    const updated = await updateConceptGroup(id, userId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Concept group not found" },
        { status: 404 }
      );
    }
    const group = await getConceptGroup(id, userId);
    return NextResponse.json(group);
  } catch (err) {
    console.error("Failed to update concept group:", err);
    return NextResponse.json(
      { error: "Failed to update concept group" },
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
      { error: "Concept group ID required" },
      { status: 400 }
    );
  }
  try {
    const deleted = await deleteConceptGroup(id, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Concept group not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete concept group:", err);
    return NextResponse.json(
      { error: "Failed to delete concept group" },
      { status: 500 }
    );
  }
}
