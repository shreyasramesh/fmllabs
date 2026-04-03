import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addSleepEntry, deleteSleepEntry, getSleepEntries } from "@/lib/db";
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

function normalizeDatePartsFromBody(body: Record<string, unknown>, fallback: Date) {
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

function mapEntry(e: { _id: string; sleepHours: number; hrvMs: number | null; entryDay: number; entryMonth: number; entryYear: number; createdAt: Date }) {
  return {
    id: e._id,
    sleepHours: e.sleepHours,
    hrvMs: e.hrvMs,
    day: e.entryDay,
    month: e.entryMonth,
    year: e.entryYear,
    dayKey: `${String(e.entryYear).padStart(4, "0")}-${String(e.entryMonth).padStart(2, "0")}-${String(e.entryDay).padStart(2, "0")}`,
    createdAt: e.createdAt,
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
    const limitRaw = parseFiniteNumber(searchParams.get("limit"));
    const limit = limitRaw != null && limitRaw > 0 ? Math.min(Math.round(limitRaw), 200) : 30;
    const rows = await getSleepEntries(userId, { limit });
    return NextResponse.json({ entries: rows.map(mapEntry) });
  } catch (err) {
    console.error("Sleep GET failed:", err);
    return NextResponse.json({ error: "Failed to load sleep entries" }, { status: 500 });
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

    const sleepHours = parseFiniteNumber(body.sleepHours);
    if (sleepHours == null || sleepHours < 0.5 || sleepHours > 24) {
      return NextResponse.json({ error: "sleepHours must be between 0.5 and 24" }, { status: 400 });
    }

    let hrvMs: number | null = null;
    if (body.hrvMs != null) {
      const parsed = parseFiniteNumber(body.hrvMs);
      if (parsed == null || parsed < 1 || parsed > 300) {
        return NextResponse.json({ error: "hrvMs must be between 1 and 300 (or omitted)" }, { status: 400 });
      }
      hrvMs = Math.round(parsed);
    }

    const { day, month, year } = normalizeDatePartsFromBody(body, new Date());

    await addSleepEntry(userId, {
      sleepHours: Math.round(sleepHours * 10) / 10,
      hrvMs,
      entryDay: day,
      entryMonth: month,
      entryYear: year,
    });

    const rows = await getSleepEntries(userId, { limit: 30 });
    return NextResponse.json({ entries: rows.map(mapEntry) });
  } catch (err) {
    console.error("Sleep POST failed:", err);
    if (err instanceof Error && /Invalid journal entry date|Invalid calendar date/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save sleep entry" }, { status: 500 });
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
    const deleted = await deleteSleepEntry(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Sleep entry not found" }, { status: 404 });
    }
    const rows = await getSleepEntries(userId, { limit: 30 });
    return NextResponse.json({ entries: rows.map(mapEntry) });
  } catch (err) {
    console.error("Sleep DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete sleep entry" }, { status: 500 });
  }
}
