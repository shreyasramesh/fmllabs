import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { MONGODB_M10_HOURLY } from "@/lib/cost-config";
import type { UsageEventDoc } from "@/lib/db";

function isAdmin(userId: string): boolean {
  const ids = process.env.ADMIN_USER_IDS?.trim();
  if (!ids) return false;
  const allowed = ids.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(userId);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();

  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const events = await db
      .collection<UsageEventDoc>("usage_events")
      .find({ timestamp: { $gte: from, $lte: to } })
      .toArray();

    const hourlyMongoRate = parseFloat(process.env.MONGODB_HOURLY_RATE || String(MONGODB_M10_HOURLY));

    const byUserService: Record<
      string,
      Record<string, { costUsd: number; count: number; metadata?: Record<string, unknown> }>
    > = {};

    const mongoEventsByHour: Record<string, { userId: string | null; count: number }[]> = {};

    for (const e of events) {
      const userKey = e.userId ?? "anonymous";
      if (!byUserService[userKey]) byUserService[userKey] = {};

      if (e.service === "mongodb" && e.metadata?.proportional) {
        const hourKey = new Date(e.timestamp).toISOString().slice(0, 13);
        if (!mongoEventsByHour[hourKey]) mongoEventsByHour[hourKey] = [];
        const existing = mongoEventsByHour[hourKey].find(
          (x) => (x.userId ?? "anonymous") === userKey
        );
        if (existing) existing.count++;
        else mongoEventsByHour[hourKey].push({ userId: e.userId, count: 1 });
        continue;
      }

      const svc = e.service;
      if (!byUserService[userKey][svc]) {
        byUserService[userKey][svc] = { costUsd: 0, count: 0 };
      }
      byUserService[userKey][svc].costUsd += e.costUsd;
      byUserService[userKey][svc].count += 1;
    }

    for (const [hourKey, userCounts] of Object.entries(mongoEventsByHour)) {
      const total = userCounts.reduce((s, u) => s + u.count, 0);
      if (total === 0) continue;
      const costPerRequest = hourlyMongoRate / total;
      for (const { userId: uid, count } of userCounts) {
        const userKey = uid ?? "anonymous";
        if (!byUserService[userKey]) byUserService[userKey] = {};
        if (!byUserService[userKey].mongodb) {
          byUserService[userKey].mongodb = { costUsd: 0, count: 0 };
        }
        byUserService[userKey].mongodb.costUsd += costPerRequest * count;
        byUserService[userKey].mongodb.count += count;
      }
    }

    const rows: { userId: string; service: string; costUsd: number; count: number }[] = [];
    for (const [u, services] of Object.entries(byUserService)) {
      for (const [svc, data] of Object.entries(services)) {
        if (data.costUsd > 0 || data.count > 0) {
          rows.push({
            userId: u,
            service: svc,
            costUsd: Math.round(data.costUsd * 1e6) / 1e6,
            count: data.count,
          });
        }
      }
    }

    const totalsByService: Record<string, { costUsd: number; count: number }> = {};
    for (const r of rows) {
      if (!totalsByService[r.service]) totalsByService[r.service] = { costUsd: 0, count: 0 };
      totalsByService[r.service].costUsd += r.costUsd;
      totalsByService[r.service].count += r.count;
    }

    const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
      totalsByService,
      totalCost: Math.round(totalCost * 1e6) / 1e6,
    });
  } catch (err) {
    console.error("Admin analytics error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}
