import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addFocusEntry, deleteFocusEntry, getFocusEntries } from "@/lib/db";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { recordMongoUsageRequest } from "@/lib/usage";

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseOptionalPositiveInteger(value: unknown): number | null {
  const n = parseFiniteNumber(value);
  if (n == null) return null;
  const rounded = Math.round(n);
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  return rounded;
}

function normalizeDatePartsFromBody(body: Record<string, unknown>, fallback: Date): {
  day: number;
  month: number;
  year: number;
} {
  const entryDateStr = typeof body.entryDate === "string" ? body.entryDate.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(entryDateStr)) {
    const [ys, ms, ds] = entryDateStr.split("-");
    return resolveJournalEntryDateParts({
      year: parseInt(ys, 10),
      month: parseInt(ms, 10),
      day: parseInt(ds, 10),
    });
  }
  return resolveJournalEntryDateParts({
    day: body.day ?? fallback.getDate(),
    month: body.month ?? fallback.getMonth() + 1,
    year: body.year ?? fallback.getFullYear(),
  });
}

function summarizeFocusRows(rows: Array<{ minutes: number; entryDay: number; entryMonth: number; entryYear: number }>) {
  const byDay: Record<string, { minutes: number; sessions: number }> = {};
  let totalMinutes = 0;
  for (const row of rows) {
    totalMinutes += row.minutes;
    const key = `${String(row.entryYear).padStart(4, "0")}-${String(row.entryMonth).padStart(2, "0")}-${String(
      row.entryDay
    ).padStart(2, "0")}`;
    const current = byDay[key] ?? { minutes: 0, sessions: 0 };
    current.minutes += row.minutes;
    current.sessions += 1;
    byDay[key] = current;
  }
  return {
    totalMinutes,
    totalSessions: rows.length,
    byDay,
  };
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const { searchParams } = new URL(request.url);
    const day = parseOptionalPositiveInteger(searchParams.get("day"));
    const month = parseOptionalPositiveInteger(searchParams.get("month"));
    const year = parseOptionalPositiveInteger(searchParams.get("year"));
    const limit = parseOptionalPositiveInteger(searchParams.get("limit")) ?? 500;
    const rows = await getFocusEntries(userId, {
      ...(day != null ? { day } : {}),
      ...(month != null ? { month } : {}),
      ...(year != null ? { year } : {}),
      limit,
    });
    const summary = summarizeFocusRows(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map((row) => ({
        id: row._id,
        minutes: row.minutes,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        day: row.entryDay,
        month: row.entryMonth,
        year: row.entryYear,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Focus tracker GET failed:", err);
    return NextResponse.json({ error: "Failed to load focus sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const minutes = parseOptionalPositiveInteger(body.minutes);
    if (minutes == null || minutes > 600) {
      return NextResponse.json({ error: "minutes must be between 1 and 600" }, { status: 400 });
    }
    const endedAt = parseOptionalDate(body.endedAt) ?? new Date();
    const startedAt =
      parseOptionalDate(body.startedAt) ?? new Date(endedAt.getTime() - Math.max(1, minutes) * 60_000);
    if (startedAt.getTime() >= endedAt.getTime()) {
      return NextResponse.json({ error: "startedAt must be before endedAt" }, { status: 400 });
    }
    const { day, month, year } = normalizeDatePartsFromBody(body, endedAt);
    await addFocusEntry(userId, {
      minutes,
      startedAt,
      endedAt,
      entryDay: day,
      entryMonth: month,
      entryYear: year,
    });
    const rows = await getFocusEntries(userId, { limit: 1000 });
    const summary = summarizeFocusRows(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map((row) => ({
        id: row._id,
        minutes: row.minutes,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        day: row.entryDay,
        month: row.entryMonth,
        year: row.entryYear,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Focus tracker POST failed:", err);
    if (err instanceof Error && /Invalid journal entry date|Invalid calendar date/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save focus session" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deleted = await deleteFocusEntry(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Focus entry not found" }, { status: 404 });
    }
    const rows = await getFocusEntries(userId, { limit: 1000 });
    const summary = summarizeFocusRows(rows);
    return NextResponse.json({
      ...summary,
      entries: rows.map((row) => ({
        id: row._id,
        minutes: row.minutes,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        day: row.entryDay,
        month: row.entryMonth,
        year: row.entryYear,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Focus tracker DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete focus session" }, { status: 500 });
  }
}

