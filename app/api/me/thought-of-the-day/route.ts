import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  addConceptReview,
  getConceptReviews,
  getCustomConcepts,
} from "@/lib/db";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(
  reviews: Array<{ reviewedAt: Date }>
): number {
  const reviewDays = new Set(reviews.map((r) => toDayKey(r.reviewedAt)));
  if (reviewDays.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = toDayKey(cursor);
    if (reviewDays.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function pickTodayConcept(
  concepts: Array<{ _id: string; title: string; summary: string; enrichmentPrompt: string }>,
  reviews: Array<{ conceptId: string; reviewedAt: Date }>,
  todayKey: string
) {
  if (concepts.length === 0) return null;

  const lastReviewMap = new Map<string, Date>();
  let totalReviews = 0;
  let reviewedToday = false;

  for (const r of reviews) {
    totalReviews++;
    const existing = lastReviewMap.get(r.conceptId);
    if (!existing || r.reviewedAt > existing) {
      lastReviewMap.set(r.conceptId, r.reviewedAt);
    }
  }

  const neverReviewed = concepts.filter((c) => !lastReviewMap.has(c._id));
  const reviewed = concepts.filter((c) => lastReviewMap.has(c._id));

  let picked: (typeof concepts)[0];

  if (neverReviewed.length > 0) {
    const idx = hashString(todayKey + "nr") % neverReviewed.length;
    picked = neverReviewed[idx];
  } else {
    reviewed.sort((a, b) => {
      const aDate = lastReviewMap.get(a._id)!.getTime();
      const bDate = lastReviewMap.get(b._id)!.getTime();
      if (aDate !== bDate) return aDate - bDate;
      return hashString(todayKey + a._id) - hashString(todayKey + b._id);
    });
    picked = reviewed[0];
  }

  const lastReview = lastReviewMap.get(picked._id);
  if (lastReview && toDayKey(lastReview) === todayKey) {
    reviewedToday = true;
  }

  const daysSinceLastReview =
    lastReview != null
      ? Math.floor((Date.now() - lastReview.getTime()) / 86_400_000)
      : null;

  return {
    concept: {
      conceptId: picked._id,
      title: picked.title,
      summary: picked.summary,
      enrichmentPrompt: picked.enrichmentPrompt,
    },
    reviewedToday,
    daysSinceLastReview,
    totalReviews,
  };
}

async function buildResponse(userId: string) {
  const [concepts, reviews] = await Promise.all([
    getCustomConcepts(userId),
    getConceptReviews(userId, { sinceDaysAgo: 90, limit: 500 }),
  ]);

  const todayKey = toDayKey(new Date());
  const result = pickTodayConcept(concepts, reviews, todayKey);

  if (!result) {
    return { concept: null, reviewedToday: false, daysSinceLastReview: null, totalReviews: 0, streak: 0 };
  }

  const streak = computeStreak(reviews);

  return {
    ...result.concept,
    reviewedToday: result.reviewedToday,
    daysSinceLastReview: result.daysSinceLastReview,
    totalReviews: result.totalReviews,
    streak,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rlGet = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rlGet.allowed) return tooManyRequestsResponse(rlGet.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const data = await buildResponse(userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Thought of the day GET failed:", err);
    return NextResponse.json({ error: "Failed to load thought of the day" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const conceptId = typeof body.conceptId === "string" ? body.conceptId.trim() : "";
    if (!conceptId) {
      return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
    }
    await addConceptReview(userId, conceptId);
    const data = await buildResponse(userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Thought of the day POST failed:", err);
    return NextResponse.json({ error: "Failed to mark as reviewed" }, { status: 500 });
  }
}
