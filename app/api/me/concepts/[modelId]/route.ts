import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { removeSavedConcept, addSavedConcept } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { modelId } = await params;
  if (!modelId) {
    return NextResponse.json(
      { error: "modelId required" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const reflection = body.reflection as string | undefined;
    await addSavedConcept(userId, modelId, reflection ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update reflection:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { modelId } = await params;
  if (!modelId) {
    return NextResponse.json(
      { error: "modelId required" },
      { status: 400 }
    );
  }
  try {
    await removeSavedConcept(userId, modelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove saved concept:", err);
    return NextResponse.json(
      { error: "Failed to remove concept" },
      { status: 500 }
    );
  }
}
