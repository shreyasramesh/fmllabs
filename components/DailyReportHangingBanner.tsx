"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { getLandingTranslations } from "@/lib/landing-translations";

function toDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyReportHangingBanner() {
  const pathname = usePathname();
  const { userId } = useAuth();
  const { language } = useLanguage();
  const [minuteTick, setMinuteTick] = useState(() => Math.floor(Date.now() / 60000));
  const [visible, setVisible] = useState(false);
  const [dismissedDayKey, setDismissedDayKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMinuteTick(Math.floor(Date.now() / 60000));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem("daily-report-banner-dismissed-day");
      setDismissedDayKey(dismissed);
    } catch {
      setDismissedDayKey(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setVisible(false);
      return;
    }
    if (
      pathname?.startsWith("/sign-in") ||
      pathname?.startsWith("/sign-up") ||
      pathname?.startsWith("/privacy-policy") ||
      pathname?.startsWith("/terms-of-service")
    ) {
      setVisible(false);
      return;
    }
    const now = new Date();
    if (now.getHours() < 19) {
      setVisible(false);
      return;
    }
    const todayDayKey = toDayKey(now);
    if (dismissedDayKey === todayDayKey) {
      setVisible(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/me/daily-report?dayKey=${encodeURIComponent(todayDayKey)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (res.ok) {
          if (active) setVisible(true);
          return;
        }
        if (now.getHours() >= 21) {
          const createRes = await fetch("/api/me/daily-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayScope: "selected_day",
              selectedDayKey: todayDayKey,
            }),
          });
          if (active) setVisible(createRes.ok);
          return;
        }
        if (active) setVisible(false);
      } catch {
        if (active) setVisible(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dismissedDayKey, minuteTick, pathname, userId]);

  if (!visible) return null;

  const handleClose = () => {
    const todayDayKey = toDayKey(new Date());
    setVisible(false);
    setDismissedDayKey(todayDayKey);
    try {
      window.localStorage.setItem("daily-report-banner-dismissed-day", todayDayKey);
    } catch {
      // ignore storage failures
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+58px)] md:top-2 z-[45] pointer-events-none">
      <div className="daily-report-hanger" aria-hidden />
      <div className="pointer-events-auto daily-report-hanging-banner shimmer-button flex items-center rounded-2xl border px-2.5 sm:px-3 py-2 shadow-lg">
        <Link
          href="/chat/new?openDailyReport=1"
          className="flex-1 min-w-0 px-2 py-0.5 text-center text-sm sm:text-[15px] font-semibold"
        >
          {getLandingTranslations(language).dailyReportBannerCta}
        </Link>
        <button
          type="button"
          onClick={handleClose}
          className="daily-report-banner-close shrink-0 rounded-lg p-1.5"
          aria-label="Close daily report banner"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
