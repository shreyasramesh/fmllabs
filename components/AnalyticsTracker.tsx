"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString() ?? "";
    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (fullPath === lastTrackedRef.current) return;
    lastTrackedRef.current = fullPath;

    const payload = {
      pathname,
      search,
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
    };

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
