"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

function extractPathFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    // Custom-scheme callback: ai.fmllabs.app://auth-callback?redirect=/chat/new
    if (url.protocol === "ai.fmllabs.app:") {
      const redirectParam = url.searchParams.get("redirect");
      if (redirectParam && redirectParam.startsWith("/")) return redirectParam;

      const candidate = `${url.pathname || ""}${url.search || ""}${url.hash || ""}`;
      if (candidate && candidate !== "/") return candidate;

      return "/chat/new";
    }

    // App links / hosted links: https://www.fmllabs.ai/chat/new
    if (
      url.hostname === "www.fmllabs.ai" ||
      url.hostname === "fmllabs.ai" ||
      url.hostname.endsWith(".fmllabs.ai")
    ) {
      const candidate = `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
      return candidate || "/chat/new";
    }

    return null;
  } catch {
    return null;
  }
}

export function NativeAppUrlHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = App.addListener("appUrlOpen", ({ url }) => {
      const path = extractPathFromUrl(url);
      if (!path) return;
      router.push(path);
    });

    return () => {
      void sub.then((listener) => listener.remove());
    };
  }, [router]);

  return null;
}

