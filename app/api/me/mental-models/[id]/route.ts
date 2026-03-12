import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getUserMentalModelById,
  updateUserMentalModel,
  deleteUserMentalModel,
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
  if (!id || !id.startsWith("custom_")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const model = await getUserMentalModelById(userId, id);
    if (!model) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { _id, userId: _uid, createdAt, updatedAt, ...rest } = model;
    return NextResponse.json(rest);
  } catch (err) {
    console.error("Failed to fetch mental model:", err);
    return NextResponse.json(
      { error: "Failed to fetch mental model" },
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
  if (!id || !id.startsWith("custom_")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    const allowed = [
      "name",
      "quick_introduction",
      "in_more_detail",
      "why_this_is_important",
      "when_to_use",
      "how_can_you_spot_it",
      "examples",
      "real_world_implications",
      "professional_application",
      "how_can_this_be_misapplied",
      "related_content",
      "one_liner",
      "try_this",
      "ask_yourself",
    ];
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    const ok = await updateUserMentalModel(userId, id, updates);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const model = await getUserMentalModelById(userId, id);
    if (!model) return NextResponse.json({ ok: true });
    const { _id, userId: _uid, createdAt, updatedAt, ...rest } = model;
    return NextResponse.json(rest);
  } catch (err) {
    console.error("Failed to update mental model:", err);
    return NextResponse.json(
      { error: "Failed to update mental model" },
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
  if (!id || !id.startsWith("custom_")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const ok = await deleteUserMentalModel(userId, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete mental model:", err);
    return NextResponse.json(
      { error: "Failed to delete mental model" },
      { status: 500 }
    );
  }
}
