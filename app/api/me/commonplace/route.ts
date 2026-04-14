import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCommonplaceEntries,
  saveCommonplaceEntry,
  updateCommonplaceEntry,
  deleteSavedTranscript,
} from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 60, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const entries = await getCommonplaceEntries(userId);
    return NextResponse.json(entries);
  } catch (err) {
    console.error("Failed to fetch commonplace entries:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const author = typeof body.author === "string" ? body.author.trim() : undefined;
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
    if (!source) return NextResponse.json({ error: "source is required" }, { status: 400 });
    const entry = await saveCommonplaceEntry(userId, text, source, author);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("Failed to save commonplace entry:", err);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const fields: { transcriptText?: string; quoteSource?: string; quoteAuthor?: string } = {};
    if (typeof body.text === "string") fields.transcriptText = body.text;
    if (typeof body.source === "string") fields.quoteSource = body.source;
    if (typeof body.author === "string") fields.quoteAuthor = body.author;
    if (!Object.keys(fields).length) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }
    const ok = await updateCommonplaceEntry(id, userId, fields);
    if (!ok) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update commonplace entry:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const ok = await deleteSavedTranscript(id, userId);
    if (!ok) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete commonplace entry:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
