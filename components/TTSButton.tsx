"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { stripMarkdown } from "@/lib/strip-markdown";
import { playSelectionChime, playStopChime } from "@/lib/selection-chime";
import { useTtsSpeed } from "@/components/TtsSpeedProvider";
import { useLanguage } from "@/components/LanguageProvider";

export function TTSButton({
  text,
  plainText,
  className = "",
  showOnHover = true,
  ariaLabel = "Listen",
  onTtsProgress,
  onTtsEnd,
}: {
  text: string;
  plainText?: string;
  className?: string;
  showOnHover?: boolean;
  ariaLabel?: string;
  /** Called with charEnd during playback for word highlighting. When provided, uses timestamp API. */
  onTtsProgress?: (charEnd: number) => void;
  /** Called when playback ends. */
  onTtsEnd?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { speed } = useTtsSpeed();
  const { language } = useLanguage();
  const onTtsProgressRef = useRef(onTtsProgress);
  const onTtsEndRef = useRef(onTtsEnd);
  onTtsProgressRef.current = onTtsProgress;
  onTtsEndRef.current = onTtsEnd;

  const content = (plainText ?? stripMarkdown(text)).trim();
  const disabled = !content || loading;
  const useTimestamps = !!onTtsProgress;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        onTtsEndRef.current?.();
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    if (playing) {
      playStopChime();
      audioRef.current?.pause();
      audioRef.current = null;
      onTtsEndRef.current?.();
      setPlaying(false);
      return;
    }
    playSelectionChime();
    setLoading(true);
    try {
      const apiSpeed = Math.max(0.7, Math.min(1.2, speed));
      const playbackRate = speed / apiSpeed;
      const textToSpeak = content.slice(0, 5000);

      if (useTimestamps) {
        const res = await fetch("/api/tts-with-timestamps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSpeak, speed: apiSpeed, language }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const data = await res.json();
        if (!data?.audio_base64) throw new Error("No audio");
        const alignment = data.alignment?.character_end_times_seconds ?? [];
        const binary = atob(data.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        const updateHighlight = () => {
          if (!onTtsProgressRef.current || alignment.length === 0) return;
          const t = audio.currentTime;
          let charEnd = -1;
          for (let i = 0; i < alignment.length; i++) {
            if (alignment[i] <= t) charEnd = i;
          }
          onTtsProgressRef.current(charEnd);
        };
        audio.ontimeupdate = updateHighlight;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onTtsEndRef.current?.();
          setPlaying(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onTtsEndRef.current?.();
          setPlaying(false);
        };
        await audio.play();
        setPlaying(true);
      } else {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSpeak, speed: apiSpeed, language }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setPlaying(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setPlaying(false);
        };
        await audio.play();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, [content, disabled, playing, speed, useTimestamps, language]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`p-1.5 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
        showOnHover ? "opacity-0 group-hover/tts:opacity-100" : ""
      } ${className}`}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : playing ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
          <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
        </svg>
      )}
    </button>
  );
}
