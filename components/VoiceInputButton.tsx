"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { playSelectionChime, playStopChime } from "@/lib/selection-chime";
import type { LanguageCode } from "@/lib/languages";

// Map app language codes to Web Speech API BCP 47 tags
const LANG_TO_SPEECH: Partial<Record<LanguageCode, string>> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  ja: "ja-JP",
  zh: "zh-CN",
  ar: "ar-SA",
  hi: "hi-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  bn: "bn-IN",
  pt: "pt-BR",
  ru: "ru-RU",
  ur: "ur-PK",
};

type SpeechRecognitionCtor = new () => {
  start: () => void;
  stop: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: {
    resultIndex?: number;
    results: ArrayLike<{
      isFinal: boolean;
      length: number;
      [i: number]: { transcript: string };
    }>;
  }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LONG_PRESS_MS = 1000;

export function VoiceInputButton({
  onTranscription,
  onLongPress,
  language = "en",
  disabled = false,
  className = "",
  ariaLabel = "Voice input",
}: {
  onTranscription: (text: string) => void;
  onLongPress?: () => void;
  language?: LanguageCode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const didLongPressRef = useRef(false);
  const lastFinalAggregateRef = useRef("");

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI || disabled) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_TO_SPEECH[language] ?? "en-US";
    recognition.maxAlternatives = 1;
    lastFinalAggregateRef.current = "";

    recognition.onresult = (event: {
      resultIndex?: number;
      results: ArrayLike<{
        isFinal: boolean;
        length: number;
        [i: number]: { transcript: string };
      }>;
    }) => {
      const results = event.results;
      // Mobile engines may repeatedly emit cumulative finals. Emit only the new delta.
      let finalAggregate = "";
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result?.isFinal) continue;
        finalAggregate += (result[0]?.transcript ?? "") + " ";
      }
      finalAggregate = finalAggregate.trim();
      if (!finalAggregate) return;

      const prev = lastFinalAggregateRef.current.trim();
      let delta = "";
      if (!prev) {
        delta = finalAggregate;
      } else if (finalAggregate.startsWith(prev)) {
        delta = finalAggregate.slice(prev.length).trim();
      } else {
        // If engine rewrites earlier words, avoid replaying full history.
        const prevWords = prev.split(/\s+/);
        const nextWords = finalAggregate.split(/\s+/);
        let overlap = 0;
        const maxOverlap = Math.min(prevWords.length, nextWords.length);
        for (let len = maxOverlap; len > 0; len--) {
          const prevTail = prevWords.slice(prevWords.length - len).join(" ");
          const nextHead = nextWords.slice(0, len).join(" ");
          if (prevTail === nextHead) {
            overlap = len;
            break;
          }
        }
        delta = nextWords.slice(overlap).join(" ").trim();
      }

      lastFinalAggregateRef.current = finalAggregate;
      if (delta) {
        onTranscription(delta);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      stopListening();
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        setListening(false);
        recognitionRef.current = null;
      }
      lastFinalAggregateRef.current = "";
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
    }
  }, [language, disabled, onTranscription, stopListening]);

  const clearHoldProgress = useCallback(() => {
    if (holdProgressIntervalRef.current) {
      clearInterval(holdProgressIntervalRef.current);
      holdProgressIntervalRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  const handlePointerDown = useCallback(() => {
    if (disabled || !onLongPress) return;
    didLongPressRef.current = false;
    holdStartRef.current = Date.now();
    setHoldProgress(0);
    holdProgressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min(100, (elapsed / LONG_PRESS_MS) * 100);
      setHoldProgress(pct);
      if (pct >= 100 && holdProgressIntervalRef.current) {
        clearInterval(holdProgressIntervalRef.current);
        holdProgressIntervalRef.current = null;
      }
    }, 50);
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      didLongPressRef.current = true;
      clearHoldProgress();
      stopListening();
      playSelectionChime();
      onLongPress();
    }, LONG_PRESS_MS);
  }, [disabled, onLongPress, stopListening, clearHoldProgress]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    clearHoldProgress();
  }, [clearHoldProgress]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    clearHoldProgress();
  }, [clearHoldProgress]);

  const handleClick = useCallback(() => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (listening) {
      playStopChime();
      stopListening();
    } else {
      playSelectionChime();
      startListening();
    }
  }, [listening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (holdProgressIntervalRef.current) clearInterval(holdProgressIntervalRef.current);
    };
  }, [stopListening]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`relative flex items-center justify-center min-w-[52px] min-h-[52px] rounded-2xl text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 select-none touch-manipulation no-touch-callout [-webkit-tap-highlight-color:transparent] ${className}`}
    >
      {/* Idle hint: subtle pulse when onLongPress available and not listening */}
      {onLongPress && !listening && !disabled && holdProgress === 0 && (
        <span
          className="absolute inset-0 rounded-2xl border-2 border-current pointer-events-none animate-voice-hold-hint"
          aria-hidden
        />
      )}
      {/* Hold progress ring */}
      {holdProgress > 0 && holdProgress < 100 && (
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 52 52"
          aria-hidden
        >
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.2"
          />
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - holdProgress / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>
      )}
      {listening ? (
        <span className="relative flex h-6 w-6">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500" />
        </span>
      ) : holdProgress > 0 && holdProgress < 100 ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin relative z-10" aria-hidden />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 relative z-10">
          <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
          <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
        </svg>
      )}
    </button>
  );
}
