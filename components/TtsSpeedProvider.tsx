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

const TTS_SPEED_STORAGE_KEY = "and-then-what-tts-speed";
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const DEFAULT_SPEED = 1;
const STEP = 0.5;

function clampSpeed(v: number): number {
  const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, v));
  return Math.round(clamped / STEP) * STEP;
}

const TtsSpeedContext = createContext<{
  speed: number;
  setSpeed: (speed: number) => void;
  clonedVoiceId: string | null;
  clonedVoiceName: string | null;
  refreshSettings: () => void;
} | null>(null);

export function useTtsSpeed() {
  const ctx = useContext(TtsSpeedContext);
  if (!ctx) throw new Error("useTtsSpeed must be used within TtsSpeedProvider");
  return ctx;
}

export function TtsSpeedProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [speed, setSpeedState] = useState(DEFAULT_SPEED);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  const fetchSettings = useCallback(() => {
    if (!userId) return;
    fetch("/api/me/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ttsSpeed != null) {
          const v = typeof data.ttsSpeed === "number" ? data.ttsSpeed : parseFloat(data.ttsSpeed);
          if (!Number.isNaN(v)) setSpeedState(clampSpeed(v));
        }
        setClonedVoiceId(data?.clonedVoiceId ?? null);
        setClonedVoiceName(data?.clonedVoiceName ?? null);
      })
      .catch(() => {})
      .finally(() => {
        fetchedRef.current = false;
      });
  }, [userId]);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(TTS_SPEED_STORAGE_KEY);
      if (stored !== null) {
        const v = parseFloat(stored);
        if (!Number.isNaN(v)) setSpeedState(clampSpeed(v));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mounted || !userId) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSettings();
  }, [mounted, userId, fetchSettings]);

  useEffect(() => {
    if (!userId) {
      fetchedRef.current = false;
      setClonedVoiceId(null);
      setClonedVoiceName(null);
    }
  }, [userId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(TTS_SPEED_STORAGE_KEY, String(speed));
    } catch {
      /* ignore */
    }
  }, [mounted, speed]);

  const setSpeed = useCallback(
    (v: number) => {
      const clamped = clampSpeed(v);
      setSpeedState(clamped);
      if (userId) {
        fetch("/api/me/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ttsSpeed: clamped }),
        }).catch(() => {});
      }
    },
    [userId]
  );

  const refreshSettings = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <TtsSpeedContext.Provider
      value={{
        speed,
        setSpeed,
        clonedVoiceId,
        clonedVoiceName,
        refreshSettings,
      }}
    >
      {children}
    </TtsSpeedContext.Provider>
  );
}
