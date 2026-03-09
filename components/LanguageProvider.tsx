"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { isValidLanguageCode, type LanguageCode } from "@/lib/languages";

const LANGUAGE_STORAGE_KEY = "and-then-what-language";

const LanguageContext = createContext<{
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  showLanguageChangeBanner: boolean;
  dismissLanguageChangeBanner: () => void;
} | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [showLanguageChangeBanner, setShowLanguageChangeBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && isValidLanguageCode(stored)) {
        setLanguageState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
  }, [mounted, language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState((prev) => {
      if (prev !== lang) setShowLanguageChangeBanner(true);
      return lang;
    });
  }, []);

  const dismissLanguageChangeBanner = useCallback(() => setShowLanguageChangeBanner(false), []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, showLanguageChangeBanner, dismissLanguageChangeBanner }}>
      {children}
    </LanguageContext.Provider>
  );
}
