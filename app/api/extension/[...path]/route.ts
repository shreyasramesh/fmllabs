import { NextRequest } from "next/server";
import { getExtensionCorsHeaders } from "@/lib/cors";

/**
 * Proxy for Chrome extension: forwards requests to the real API and adds CORS headers.
 * Extension calls /api/extension/me/nuggets → proxies to /api/me/nuggets
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = getExtensionCorsHeaders(origin);
  return new Response(null, { status: 204, headers });
}

async function proxy(
  request: NextRequest,
  pathSegments: string[]
): Promise<Response> {
  const origin = request.headers.get("origin");
  const corsHeaders = getExtensionCorsHeaders(origin);

  const path = pathSegments.join("/");
  const base = request.nextUrl.origin;
  const url = new URL(`/api/${path}`, base);
  url.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("origin");
  headers.delete("referer");

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      // no body
    }
  }

  const res = await fetch(url.toString(), {
    method: request.method,
    headers,
    body: body || undefined,
  });

  const resHeaders = new Headers(res.headers);
  // These middleware control headers are not valid to emit from app routes.
  resHeaders.delete("x-middleware-rewrite");
  resHeaders.delete("x-middleware-next");
  resHeaders.delete("x-middleware-override-headers");
  resHeaders.delete("x-middleware-request-headers");
  Object.entries(corsHeaders).forEach(([k, v]) => resHeaders.set(k, v));

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}
