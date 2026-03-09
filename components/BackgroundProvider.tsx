"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@clerk/nextjs";

export type BackgroundElement = "default" | "air" | "water" | "earth" | "fire";

const BACKGROUND_STORAGE_KEY = "fmllabs-background";
const DEFAULT_BACKGROUND: BackgroundElement = "default";

const BackgroundContext = createContext<{
  background: BackgroundElement;
  setBackground: (b: BackgroundElement) => void;
} | null>(null);

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [background, setBackgroundState] = useState<BackgroundElement>(DEFAULT_BACKGROUND);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
      if (stored === "default" || stored === "air" || stored === "water" || stored === "earth" || stored === "fire") {
        setBackgroundState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mounted || !userId) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/me/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.background && (data.background === "default" || data.background === "air" || data.background === "water" || data.background === "earth" || data.background === "fire")) {
          setBackgroundState(data.background);
        }
      })
      .catch(() => {})
      .finally(() => {
        fetchedRef.current = false;
      });
  }, [mounted, userId]);

  useEffect(() => {
    if (!userId) fetchedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(BACKGROUND_STORAGE_KEY, background);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-background", background);
  }, [mounted, background]);

  const setBackground = useCallback(
    (b: BackgroundElement) => {
      setBackgroundState(b);
      if (userId) {
        fetch("/api/me/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ background: b }),
        }).catch(() => {});
      }
    },
    [userId]
  );

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  );
}
