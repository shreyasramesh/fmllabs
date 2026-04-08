import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({}));
    const orderedIds = body.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.some((id: unknown) => typeof id !== "string")) {
      return NextResponse.json({ error: "orderedIds must be a string array" }, { status: 400 });
    }

    const database = await getDb();
    const { ObjectId } = await import("mongodb");
    const bulk = database.collection("habits").initializeUnorderedBulkOp();
    for (let i = 0; i < orderedIds.length; i++) {
      bulk.find({ _id: new ObjectId(orderedIds[i] as string), userId }).updateOne({
        $set: { heroHabitOrder: i },
      });
    }
    if (bulk.batches.length > 0) {
      await bulk.execute();
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to reorder habits:", err);
    return NextResponse.json({ error: "Failed to reorder habits" }, { status: 500 });
  }
}
