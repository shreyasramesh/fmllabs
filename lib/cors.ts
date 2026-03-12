/**
 * CORS headers for Chrome extension cross-origin requests.
 * Chrome extensions use chrome-extension://<id> as origin.
 */
export function getExtensionCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !origin.startsWith("chrome-extension://")) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
