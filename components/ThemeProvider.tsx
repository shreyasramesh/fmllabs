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

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as Theme | null;
    const initial: Theme = stored ?? "light";
    setThemeState(initial);
  }, []);

  useEffect(() => {
    if (!mounted || !userId) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/me/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.theme === "light" || data?.theme === "dark") {
          setThemeState(data.theme);
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
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [mounted, theme]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      if (userId) {
        fetch("/api/me/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: t }),
        }).catch(() => {});
      }
    },
    [userId]
  );
  const toggleTheme = useCallback(
    () =>
      setThemeState((prev) => {
        const next = prev === "dark" ? "light" : "dark";
        if (userId) {
          fetch("/api/me/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme: next }),
          }).catch(() => {});
        }
        return next;
      }),
    [userId]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
