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
export const TTS_SPEEDS = [1, 1.5, 2] as const;
const DEFAULT_SPEED = 1;

function clampSpeed(v: number): number {
  const rounded = Math.round(v * 2) / 2;
  if (TTS_SPEEDS.includes(rounded as (typeof TTS_SPEEDS)[number])) return rounded;
  return TTS_SPEEDS.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  );
}

export function cycleTtsSpeed(current: number): number {
  const idx = TTS_SPEEDS.indexOf(current as (typeof TTS_SPEEDS)[number]);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % TTS_SPEEDS.length;
  return TTS_SPEEDS[nextIdx];
}

const TtsSpeedContext = createContext<{
  speed: number;
  setSpeed: (speed: number) => void;
  clonedVoices: Array<{ voiceId: string; name: string; language: string }>;
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
  const [clonedVoices, setClonedVoices] = useState<Array<{ voiceId: string; name: string; language: string }>>([]);
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
        const voices = Array.isArray(data?.clonedVoices)
          ? data.clonedVoices.filter((v: unknown) =>
              typeof v === "object" &&
              v !== null &&
              typeof (v as { voiceId?: unknown }).voiceId === "string" &&
              typeof (v as { name?: unknown }).name === "string" &&
              typeof (v as { language?: unknown }).language === "string"
            ) as Array<{ voiceId: string; name: string; language: string }>
          : [];
        setClonedVoices(voices);
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
      setClonedVoices([]);
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
        clonedVoices,
        refreshSettings,
      }}
    >
      {children}
    </TtsSpeedContext.Provider>
  );
}
