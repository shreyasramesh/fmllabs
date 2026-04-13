import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addWeightEntry, deleteWeightEntry, getWeightEntries, updateWeightEntrySortOverride } from "@/lib/db";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeWeightKg(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n == null) return null;
  const rounded = Math.round(n * 10) / 10;
  if (rounded < 20 || rounded > 400) return null;
  return rounded;
}

function normalizeRecordedAt(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function mapEntry(row: { _id: string; weightKg: number; targetWeightKg?: number | null; recordedAt: Date; createdAt: Date; sortOverrideMs?: number }) {
  return {
    id: row._id,
    weightKg: row.weightKg,
    targetWeightKg: row.targetWeightKg ?? null,
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
    sortOverrideMs: row.sortOverrideMs,
  };
}

function summarizeWeight(entries: Array<{ weightKg: number; targetWeightKg?: number | null }>) {
  const currentWeightKg = entries.length > 0 ? entries[0]!.weightKg : null;
  const targetWeightKg =
    entries.find((row) => typeof row.targetWeightKg === "number")?.targetWeightKg ?? null;
  return { currentWeightKg, targetWeightKg };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const rows = await getWeightEntries(userId, 1000);
    const summary = summarizeWeight(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map(mapEntry),
    });
  } catch (err) {
    console.error("Weight tracker GET failed:", err);
    return NextResponse.json({ error: "Failed to load weight tracker" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const weightKg = normalizeWeightKg(body.weightKg);
    if (weightKg == null) {
      return NextResponse.json({ error: "weightKg must be between 20 and 400 kg" }, { status: 400 });
    }
    const targetRaw = body.targetWeightKg;
    const targetWeightKg =
      targetRaw === null || targetRaw === undefined || targetRaw === ""
        ? null
        : normalizeWeightKg(targetRaw);
    if (targetRaw != null && targetRaw !== "" && targetWeightKg == null) {
      return NextResponse.json({ error: "targetWeightKg must be between 20 and 400 kg" }, { status: 400 });
    }
    const recordedAt = normalizeRecordedAt(body.recordedAt);
    await addWeightEntry(userId, weightKg, {
      targetWeightKg,
      ...(recordedAt ? { recordedAt } : {}),
    });
    const rows = await getWeightEntries(userId, 1000);
    const summary = summarizeWeight(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map(mapEntry),
    });
  } catch (err) {
    console.error("Weight tracker POST failed:", err);
    return NextResponse.json({ error: "Failed to save weight entry" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const sortMs = typeof body.sortOverrideMs === "number" ? body.sortOverrideMs : Number(body.sortOverrideMs);
    if (!Number.isFinite(sortMs) || sortMs <= 0) {
      return NextResponse.json({ error: "sortOverrideMs must be a positive number" }, { status: 400 });
    }
    const ok = await updateWeightEntrySortOverride(id, userId, Math.round(sortMs));
    if (!ok) return NextResponse.json({ error: "Weight entry not found" }, { status: 404 });
    return NextResponse.json({ ok: true, sortOverrideMs: Math.round(sortMs) });
  } catch (err) {
    console.error("Weight tracker PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update weight entry" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deleted = await deleteWeightEntry(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Weight entry not found" }, { status: 404 });
    }
    const rows = await getWeightEntries(userId, 1000);
    const summary = summarizeWeight(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map(mapEntry),
    });
  } catch (err) {
    console.error("Weight tracker DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete weight entry" }, { status: 500 });
  }
}
