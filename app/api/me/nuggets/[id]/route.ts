import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteNugget } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const deleted = await deleteNugget(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Nugget not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete nugget:", err);
    return NextResponse.json(
      { error: "Failed to delete nugget" },
      { status: 500 }
    );
  }
}
