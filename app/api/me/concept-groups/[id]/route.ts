import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConceptGroup,
  getCustomConceptsByIds,
  updateConceptGroup,
  deleteConceptGroup,
} from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
