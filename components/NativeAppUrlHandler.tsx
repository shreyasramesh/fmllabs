"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

function appendQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function isAllowedHost(hostname: string): boolean {
  return (
    hostname === "www.fmllabs.ai" ||
    hostname === "fmllabs.ai" ||
    hostname.endsWith(".fmllabs.ai")
  );
}

function extractPathFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    // Custom-scheme callback: ai.fmllabs.app://auth-callback?redirect=/chat/new
    if (url.protocol === "ai.fmllabs.app:") {
      const passthrough = new URLSearchParams(url.searchParams);
      passthrough.delete("redirect");

      const redirectParam = url.searchParams.get("redirect");
      if (redirectParam) {
        if (redirectParam.startsWith("/")) {
          return appendQuery(redirectParam, passthrough);
        }
        try {
          const redirectUrl = new URL(redirectParam);
          if (isAllowedHost(redirectUrl.hostname)) {
            const redirectPath = `${redirectUrl.pathname || "/"}${redirectUrl.search || ""}${
              redirectUrl.hash || ""
            }`;
            return appendQuery(redirectPath, passthrough);
          }
        } catch {
          // Ignore invalid redirect URL and continue fallback handling.
        }
      }

      const candidate = `${url.pathname || ""}${url.search || ""}${url.hash || ""}`;
      if (candidate && candidate !== "/") return candidate;

      return "/chat/new";
    }

    // App links / hosted links: https://www.fmllabs.ai/chat/new
    if (isAllowedHost(url.hostname)) {
      const candidate = `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
      return candidate || "/chat/new";
    }

    return null;
  } catch {
    return null;
  }
}

export function NativeAppUrlHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = App.addListener("appUrlOpen", ({ url }) => {
      const path = extractPathFromUrl(url);
      if (!path) return;
      // Full navigation lets Clerk process callback params and establish session immediately.
      window.location.assign(path);
    });

    return () => {
      void sub.then((listener) => listener.remove());
    };
  }, []);

  return null;
}

