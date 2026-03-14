import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSession,
  getMessages,
  getLongTermMemory,
  deleteSession,
  addMentalModelTag,
  updateSession,
  expandSession,
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
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }
  try {
    let session = await getSession(id, userId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    let messages = session.isCollapsed ? [] : await getMessages(id);
    let longTermMemory: Awaited<ReturnType<typeof getLongTermMemory>> = null;
    if (session.longTermMemoryId && session.isCollapsed) {
      longTermMemory = await getLongTermMemory(session.longTermMemoryId, userId);
      if (!longTermMemory) {
        // LTM was deleted; expand session and return full conversation
        await expandSession(id, userId);
        session = (await getSession(id, userId))!;
        messages = await getMessages(id);
      }
    }
    return NextResponse.json({
      session,
      messages,
      longTermMemory: longTermMemory ?? undefined,
    });
  } catch (err) {
    console.error("Failed to fetch session:", err);
    return NextResponse.json(
      { error: "Failed to fetch session" },
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
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const mentalModelTag = body.mentalModelTag as string | undefined;
    const isCollapsed = body.isCollapsed as boolean | undefined;
    const longTermMemoryId = body.longTermMemoryId as string | undefined;
    const convertedToDeepConversation = body.convertedToDeepConversation as boolean | undefined;
    if (mentalModelTag && typeof mentalModelTag === "string") {
      const added = await addMentalModelTag(id, userId, mentalModelTag);
      if (!added) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const session = await getSession(id, userId);
      return NextResponse.json(session);
    }
    if (typeof isCollapsed === "boolean" && typeof longTermMemoryId === "string") {
      const updated = await updateSession(id, userId, { isCollapsed, longTermMemoryId });
      if (!updated) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const session = await getSession(id, userId);
      return NextResponse.json(session);
    }
    if (typeof convertedToDeepConversation === "boolean") {
      const updated = await updateSession(id, userId, { convertedToDeepConversation });
      if (!updated) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const session = await getSession(id, userId);
      return NextResponse.json(session);
    }
    return NextResponse.json({ error: "mentalModelTag, (isCollapsed, longTermMemoryId), or convertedToDeepConversation required" }, { status: 400 });
  } catch (err) {
    console.error("Failed to add mental model tag:", err);
    return NextResponse.json(
      { error: "Failed to add tag" },
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
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }
  try {
    const deleted = await deleteSession(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete session:", err);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
