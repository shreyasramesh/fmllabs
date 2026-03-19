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

function fallbackUserName(userId: string): string {
  return `User ${userId.slice(0, 8)}`;
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
    const dailyTotals: Record<string, { costUsd: number; count: number }> = {};
    const totalsByAudience: Record<"users" | "anonymous", { costUsd: number; count: number }> = {
      users: { costUsd: 0, count: 0 },
      anonymous: { costUsd: 0, count: 0 },
    };

    const addDaily = (dateKey: string, costUsd: number, count: number) => {
      if (!dailyTotals[dateKey]) dailyTotals[dateKey] = { costUsd: 0, count: 0 };
      dailyTotals[dateKey].costUsd += costUsd;
      dailyTotals[dateKey].count += count;
    };
    const addAudience = (userKey: string, costUsd: number, count: number) => {
      const bucket = userKey === "anonymous" ? "anonymous" : "users";
      totalsByAudience[bucket].costUsd += costUsd;
      totalsByAudience[bucket].count += count;
    };

    const mongoEventsByHour: Record<string, { userId: string | null; count: number }[]> = {};

    for (const e of events) {
      const userKey = e.userId ?? "anonymous";
      const dateKey = new Date(e.timestamp).toISOString().slice(0, 10);
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
      addDaily(dateKey, e.costUsd, 1);
      addAudience(userKey, e.costUsd, 1);
    }

    for (const [hourKey, userCounts] of Object.entries(mongoEventsByHour)) {
      const total = userCounts.reduce((s, u) => s + u.count, 0);
      if (total === 0) continue;
      const dateKey = `${hourKey.slice(0, 10)}`;
      const costPerRequest = hourlyMongoRate / total;
      for (const { userId: uid, count } of userCounts) {
        const userKey = uid ?? "anonymous";
        if (!byUserService[userKey]) byUserService[userKey] = {};
        if (!byUserService[userKey].mongodb) {
          byUserService[userKey].mongodb = { costUsd: 0, count: 0 };
        }
        byUserService[userKey].mongodb.costUsd += costPerRequest * count;
        byUserService[userKey].mongodb.count += count;
        addDaily(dateKey, costPerRequest * count, count);
        addAudience(userKey, costPerRequest * count, count);
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

    const userIds = Array.from(
      new Set(rows.map((r) => r.userId).filter((id) => id !== "anonymous"))
    );
    const userNames: Record<string, string> = { anonymous: "Anonymous" };
    if (userIds.length > 0) {
      const progressDocs = await db
        .collection("user_progress")
        .find({ userId: { $in: userIds } })
        .project({ userId: 1, displayName: 1 })
        .toArray();
      const byUserId = new Map(
        progressDocs.map((d) => {
          const doc = d as { userId?: string; displayName?: string };
          return [doc.userId ?? "", (doc.displayName ?? "").trim()];
        })
      );
      for (const id of userIds) {
        const name = byUserId.get(id);
        userNames[id] = name && name.length > 0 ? name : fallbackUserName(id);
      }
    }

    const daily = Object.entries(dailyTotals)
      .map(([date, d]) => ({
        date,
        costUsd: Math.round(d.costUsd * 1e6) / 1e6,
        count: d.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
      totalsByService,
      userNames,
      totalsByAudience: {
        users: {
          costUsd: Math.round(totalsByAudience.users.costUsd * 1e6) / 1e6,
          count: totalsByAudience.users.count,
        },
        anonymous: {
          costUsd: Math.round(totalsByAudience.anonymous.costUsd * 1e6) / 1e6,
          count: totalsByAudience.anonymous.count,
        },
      },
      daily,
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
