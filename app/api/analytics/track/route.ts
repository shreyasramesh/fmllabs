import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

const VISITOR_COOKIE = "fmllabs_vid";
const SESSION_COOKIE = "fmllabs_sid";
const SESSION_MAX_AGE_SECONDS = 30 * 60;
const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const lower = ua.toLowerCase();

  let browser = "Unknown";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/")) browser = "Safari";

  let os = "Unknown";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  let device = "Desktop";
  if (lower.includes("ipad") || lower.includes("tablet")) device = "Tablet";
  else if (
    lower.includes("mobi") ||
    lower.includes("iphone") ||
    lower.includes("android")
  ) {
    device = "Mobile";
  }

  return { browser, os, device };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pathname?: unknown;
      search?: unknown;
      referrer?: unknown;
    };
    const pathname = typeof body.pathname === "string" ? body.pathname : "";
    if (!pathname || !pathname.startsWith("/")) {
      return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
    }

    const search = typeof body.search === "string" && body.search.length > 0 ? `?${body.search}` : "";
    const referrer = typeof body.referrer === "string" ? body.referrer : "";

    const userAgent = request.headers.get("user-agent") ?? "";
    const { browser, os, device } = parseUserAgent(userAgent);
    const country = request.headers.get("x-vercel-ip-country") ?? "";
    const region = request.headers.get("x-vercel-ip-country-region") ?? "";
    const city = request.headers.get("x-vercel-ip-city") ?? "";

    const visitorId =
      request.headers.get("x-fmllabs-visitor-id") ??
      request.headers.get("x-visitor-id") ??
      request.headers.get("x-request-id") ??
      request.headers.get("x-vercel-id") ??
      crypto.randomUUID();

    const sidFromCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.split("=")[1];
    const vidFromCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${VISITOR_COOKIE}=`))
      ?.split("=")[1];

    const sessionId = sidFromCookie || crypto.randomUUID();
    const resolvedVisitorId = vidFromCookie || visitorId;
    const { userId } = await auth();
    const db = await getDb();
    await db.collection("web_analytics_events").insertOne({
      timestamp: new Date(),
      eventType: "page_view",
      userId: userId ?? null,
      visitorId: resolvedVisitorId,
      sessionId,
      path: `${pathname}${search}`,
      pathname,
      referrer,
      country,
      region,
      city,
      browser,
      os,
      device,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(VISITOR_COOKIE, resolvedVisitorId, {
      maxAge: VISITOR_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Analytics track failed:", error);
    return NextResponse.json({ error: "Track failed" }, { status: 500 });
  }
}
