import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveJournalEntryDateParts } from "@/lib/journal-entry-date";
import { getPacificTimeParts, parseJournalEntryTimeFromBody } from "@/lib/journal-entry-time";
import { saveJournalTranscript } from "@/lib/db";
import {
  formatSpendJournalTranscript,
  normalizeSpendCurrencyInput,
  spendJournalTitle,
} from "@/lib/spend-journal";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const AMOUNT_MIN = 1e-6;
const AMOUNT_MAX = 1e7;
const MEMO_MAX = 2000;
const TAG_MAX = 80;
const NOTES_MAX = 2000;

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

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseMemo(body: Record<string, unknown>): string | null {
  const raw =
    typeof body.memo === "string"
      ? body.memo
      : typeof body.description === "string"
        ? body.description
        : "";
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > MEMO_MAX) return null;
  return trimmed;
}

function parseOptionalTag(body: Record<string, unknown>): string {
  if (typeof body.tag !== "string") return "";
  const t = body.tag.trim().replace(/\s+/g, " ");
  if (!t || t.length > TAG_MAX) return "";
  return t;
}

function parseOptionalNotes(body: Record<string, unknown>): string {
  if (typeof body.notes !== "string") return "";
  const n = body.notes.trim();
  if (n.length > NOTES_MAX) return "";
  return n;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlPost = rateLimitByUser(userId, { max: 40, windowMs: 60_000 });
  if (!rlPost.allowed) return tooManyRequestsResponse(rlPost.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const amount = parseAmount(body.amount);
    if (amount == null || amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
      return NextResponse.json(
        { error: `amount must be between ${AMOUNT_MIN} and ${AMOUNT_MAX}` },
        { status: 400 }
      );
    }
    const currency = normalizeSpendCurrencyInput(body.currency);
    if (currency == null) {
      return NextResponse.json({ error: "currency must be a 3-letter ISO code (e.g. USD)" }, { status: 400 });
    }
    const memo = parseMemo(body);
    if (!memo) {
      return NextResponse.json(
        { error: "memo or description is required (non-empty, max " + MEMO_MAX + " chars)" },
        { status: 400 }
      );
    }
    const tag = parseOptionalTag(body);
    const notes = parseOptionalNotes(body);
    const now = new Date();
    let entryDate: { day: number; month: number; year: number };
    try {
      entryDate = normalizeDatePartsFromBody(body, now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entry date";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const journalEntryTime = parseJournalEntryTimeFromBody(body) ?? getPacificTimeParts(now);

    const transcriptText = formatSpendJournalTranscript(memo, { amount, currency, tag, notes });
    const title = spendJournalTitle(memo, amount, currency);

    const saved = await saveJournalTranscript(userId, transcriptText, title, entryDate, {
      journalCategory: "spend",
      journalEntryTime,
    });

    return NextResponse.json({
      id: saved._id,
      title: saved.videoTitle ?? title,
      amount,
      currency,
    });
  } catch (err) {
    console.error("Spend journal POST failed:", err);
    if (err instanceof Error && /Invalid journal entry date|Invalid calendar date/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save spend entry" }, { status: 500 });
  }
}
