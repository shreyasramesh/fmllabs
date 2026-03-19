import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

type BreakdownItem = { name: string; count: number };

function isAdmin(userId: string): boolean {
  const ids = process.env.ADMIN_USER_IDS?.trim();
  if (!ids) return false;
  const allowed = ids.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(userId);
}

function periodKey(d: Date, granularity: "daily" | "weekly" | "monthly"): string {
  if (granularity === "daily") return d.toISOString().slice(0, 10);
  if (granularity === "weekly") {
    const day = d.getUTCDay() || 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 7);
}

function topBreakdown(map: Map<string, number>, limit = 12): BreakdownItem[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const granularityParam = searchParams.get("granularity");
  const granularity =
    granularityParam === "daily" || granularityParam === "weekly" || granularityParam === "monthly"
      ? granularityParam
      : "monthly";

  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const events = await db
      .collection("web_analytics_events")
      .find({
        eventType: "page_view",
        timestamp: { $gte: from, $lte: to },
      })
      .project({
        timestamp: 1,
        visitorId: 1,
        sessionId: 1,
        path: 1,
        pathname: 1,
        referrer: 1,
        country: 1,
        region: 1,
        city: 1,
        browser: 1,
        os: 1,
        device: 1,
      })
      .sort({ timestamp: 1 })
      .toArray();

    const uniqueVisitors = new Set<string>();
    const pageCount = new Map<string, number>();
    const countryCount = new Map<string, number>();
    const regionCount = new Map<string, number>();
    const cityCount = new Map<string, number>();
    const browserCount = new Map<string, number>();
    const osCount = new Map<string, number>();
    const deviceCount = new Map<string, number>();
    const trendCount = new Map<string, number>();
    const sessions = new Map<string, { paths: string[] }>();

    for (const e of events) {
      const visitorId = typeof e.visitorId === "string" ? e.visitorId : "";
      if (visitorId) uniqueVisitors.add(visitorId);

      const path =
        typeof e.pathname === "string" && e.pathname.length > 0
          ? e.pathname
          : typeof e.path === "string"
            ? e.path.split("?")[0]
            : "/";
      pageCount.set(path, (pageCount.get(path) ?? 0) + 1);

      const country = typeof e.country === "string" && e.country ? e.country : "Unknown";
      const region = typeof e.region === "string" && e.region ? e.region : "Unknown";
      const city = typeof e.city === "string" && e.city ? e.city : "Unknown";
      countryCount.set(country, (countryCount.get(country) ?? 0) + 1);
      regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
      cityCount.set(city, (cityCount.get(city) ?? 0) + 1);

      const browser = typeof e.browser === "string" && e.browser ? e.browser : "Unknown";
      const os = typeof e.os === "string" && e.os ? e.os : "Unknown";
      const device = typeof e.device === "string" && e.device ? e.device : "Unknown";
      browserCount.set(browser, (browserCount.get(browser) ?? 0) + 1);
      osCount.set(os, (osCount.get(os) ?? 0) + 1);
      deviceCount.set(device, (deviceCount.get(device) ?? 0) + 1);

      const ts = e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp as string);
      const key = periodKey(ts, granularity);
      trendCount.set(key, (trendCount.get(key) ?? 0) + 1);

      const sessionId = typeof e.sessionId === "string" && e.sessionId ? e.sessionId : "";
      if (sessionId) {
        const existing = sessions.get(sessionId) ?? { paths: [] };
        existing.paths.push(path);
        sessions.set(sessionId, existing);
      }
    }

    const sessionsArr = Array.from(sessions.values());
    const funnel = [
      { name: "Session started", count: sessionsArr.length },
      { name: "Visited 2+ pages", count: sessionsArr.filter((s) => s.paths.length >= 2).length },
      { name: "Visited 3+ pages", count: sessionsArr.filter((s) => s.paths.length >= 3).length },
      { name: "Visited 5+ pages", count: sessionsArr.filter((s) => s.paths.length >= 5).length },
    ];

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      visitors: uniqueVisitors.size,
      pageViews: events.length,
      pages: topBreakdown(pageCount, 20),
      geo: {
        countries: topBreakdown(countryCount, 12),
        regions: topBreakdown(regionCount, 12),
        cities: topBreakdown(cityCount, 12),
      },
      tech: {
        browsers: topBreakdown(browserCount, 12),
        os: topBreakdown(osCount, 12),
        devices: topBreakdown(deviceCount, 12),
      },
      trend: Array.from(trendCount.entries())
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      funnel,
    });
  } catch (error) {
    console.error("Web analytics failed:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
