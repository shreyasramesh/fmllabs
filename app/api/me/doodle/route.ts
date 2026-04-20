import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDoodle, getDoodlesForYear, upsertDoodle, deleteDoodle } from "@/lib/db";
import type { DoodleStroke } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const MAX_STROKES = 500;
const MAX_POINTS_PER_STROKE = 5000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDayKey(v: unknown): v is string {
  return typeof v === "string" && DAY_KEY_RE.test(v);
}

function parseStrokes(raw: unknown): DoodleStroke[] | null {
  if (!Array.isArray(raw)) return null;
  const strokes: DoodleStroke[] = [];
  for (const s of raw.slice(0, MAX_STROKES)) {
    if (!s || typeof s !== "object") continue;
    const obj = s as Record<string, unknown>;
    if (!Array.isArray(obj.points)) continue;
    const points = (obj.points as unknown[])
      .slice(0, MAX_POINTS_PER_STROKE)
      .filter(
        (p): p is { x: number; y: number } =>
          !!p &&
          typeof p === "object" &&
          typeof (p as Record<string, unknown>).x === "number" &&
          typeof (p as Record<string, unknown>).y === "number" &&
          Number.isFinite((p as Record<string, unknown>).x as number) &&
          Number.isFinite((p as Record<string, unknown>).y as number),
      )
      .map((p) => ({ x: p.x, y: p.y }));
    if (points.length === 0) continue;
    strokes.push({
      points,
      color: typeof obj.color === "string" ? obj.color.slice(0, 20) : "#c96442",
      width: typeof obj.width === "number" && Number.isFinite(obj.width) ? Math.max(0.5, Math.min(20, obj.width)) : 3,
    });
  }
  return strokes;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const { searchParams } = new URL(request.url);
  const dayKey = searchParams.get("dayKey");
  const yearParam = searchParams.get("year");

  if (dayKey) {
    if (!isValidDayKey(dayKey)) return NextResponse.json({ error: "Invalid dayKey" }, { status: 400 });
    const doc = await getDoodle(userId, dayKey);
    return NextResponse.json({ doodle: doc ? { dayKey: doc.dayKey, strokes: doc.strokes } : null });
  }

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    const doodles = await getDoodlesForYear(userId, year);
    return NextResponse.json({ doodles });
  }

  return NextResponse.json({ error: "Provide dayKey or year" }, { status: 400 });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 20, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const dayKey = body.dayKey;
  if (!isValidDayKey(dayKey)) return NextResponse.json({ error: "Invalid dayKey" }, { status: 400 });

  const strokes = parseStrokes(body.strokes);
  if (!strokes) return NextResponse.json({ error: "Invalid strokes" }, { status: 400 });

  await upsertDoodle(userId, dayKey, strokes);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimitByUser(userId, { max: 10, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const dayKey = body.dayKey;
  if (!isValidDayKey(dayKey)) return NextResponse.json({ error: "Invalid dayKey" }, { status: 400 });

  await deleteDoodle(userId, dayKey);
  return NextResponse.json({ ok: true });
}
