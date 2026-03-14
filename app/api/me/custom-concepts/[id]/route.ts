import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCustomConcept,
  updateCustomConcept,
  deleteCustomConcept,
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
      { error: "Custom concept ID required" },
      { status: 400 }
    );
  }
  try {
    const concept = await getCustomConcept(id, userId);
    if (!concept) {
      return NextResponse.json(
        { error: "Custom concept not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(concept);
  } catch (err) {
    console.error("Failed to fetch custom concept:", err);
    return NextResponse.json(
      { error: "Failed to fetch custom concept" },
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
      { error: "Custom concept ID required" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const enrichmentPrompt = body.enrichmentPrompt as string | undefined;
    const title = body.title as string | undefined;
    const summary = body.summary as string | undefined;
    const sourceVideoTitle = body.sourceVideoTitle as string | undefined;
    const updates: {
      enrichmentPrompt?: string;
      title?: string;
      summary?: string;
      sourceVideoTitle?: string;
    } =
      {};
    if (typeof enrichmentPrompt === "string") updates.enrichmentPrompt = enrichmentPrompt;
    if (typeof title === "string") updates.title = title;
    if (typeof summary === "string") updates.summary = summary;
    if (typeof sourceVideoTitle === "string") updates.sourceVideoTitle = sourceVideoTitle;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    const updated = await updateCustomConcept(id, userId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Custom concept not found" },
        { status: 404 }
      );
    }
    const concept = await getCustomConcept(id, userId);
    return NextResponse.json(concept);
  } catch (err) {
    console.error("Failed to update custom concept:", err);
    return NextResponse.json(
      { error: "Failed to update custom concept" },
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
      { error: "Custom concept ID required" },
      { status: 400 }
    );
  }
  try {
    const deleted = await deleteCustomConcept(id, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Custom concept not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete custom concept:", err);
    return NextResponse.json(
      { error: "Failed to delete custom concept" },
      { status: 500 }
    );
  }
}
