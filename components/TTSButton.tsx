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
  layout = "horizontal",
  ariaLabel = "Listen",
  onTtsProgress,
  onTtsEnd,
}: {
  text: string;
  plainText?: string;
  className?: string;
  showOnHover?: boolean;
  layout?: "horizontal" | "vertical";
  ariaLabel?: string;
  /** Called with charEnd during playback for word highlighting. When provided, uses timestamp API. */
  onTtsProgress?: (charEnd: number) => void;
  /** Called when playback ends. */
  onTtsEnd?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const { speed } = useTtsSpeed();
  const { language } = useLanguage();
  const onTtsProgressRef = useRef(onTtsProgress);
  const onTtsEndRef = useRef(onTtsEnd);
  onTtsProgressRef.current = onTtsProgress;
  onTtsEndRef.current = onTtsEnd;

  const content = (plainText ?? stripMarkdown(text)).trim();
  const disabled = !content || loading;
  const useTimestamps = !!onTtsProgress;

  const resetAudio = useCallback((shouldClearHighlight: boolean) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (shouldClearHighlight) onTtsEndRef.current?.();
    setPlaying(false);
    setPaused(false);
  }, []);

  useEffect(() => {
    return () => {
      resetAudio(true);
    };
  }, [resetAudio]);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    if (audioRef.current && paused) {
      playSelectionChime();
      try {
        await audioRef.current.play();
        setPaused(false);
        setPlaying(true);
      } catch {
        resetAudio(true);
      }
      return;
    }
    if (playing) {
      playStopChime();
      audioRef.current?.pause();
      setPlaying(false);
      setPaused(true);
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
        audioUrlRef.current = url;
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
          resetAudio(true);
        };
        audio.onerror = () => {
          resetAudio(true);
        };
        await audio.play();
        setPlaying(true);
        setPaused(false);
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
        audioUrlRef.current = url;
        audioRef.current = audio;
        audio.onended = () => {
          resetAudio(false);
        };
        audio.onerror = () => {
          resetAudio(false);
        };
        await audio.play();
        setPlaying(true);
        setPaused(false);
      }
    } catch {
      resetAudio(true);
    } finally {
      setLoading(false);
    }
  }, [content, disabled, paused, playing, speed, useTimestamps, language, resetAudio]);

  const handleRestart = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || loading) return;

    playSelectionChime();
    try {
      audio.pause();
      audio.currentTime = 0;
      if (useTimestamps) onTtsProgressRef.current?.(-1);
      await audio.play();
      setPlaying(true);
      setPaused(false);
    } catch {
      resetAudio(true);
    }
  }, [loading, resetAudio, useTimestamps]);

  const currentAriaLabel = loading
    ? `${ariaLabel} loading`
    : playing
      ? "Pause audio"
      : paused
        ? "Resume audio"
        : ariaLabel;
  const showRestart = !!audioRef.current && !loading;
  const buttonVisibilityClass = showOnHover ? "opacity-0 group-hover/tts:opacity-100" : "";
  const buttonBaseClass =
    "p-1.5 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
  const containerLayoutClass = layout === "vertical"
    ? "inline-flex flex-col items-center gap-1"
    : "inline-flex items-center gap-1";
  const restartButton = showRestart && (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleRestart();
      }}
      aria-label="Restart audio"
      title="Restart audio"
      className={buttonBaseClass}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 5a7 7 0 1 1-6.32 10H3.75a.75.75 0 0 1-.53-1.28l2.5-2.5a.75.75 0 0 1 1.06 0l2.5 2.5A.75.75 0 0 1 8.75 15H7.23A5.5 5.5 0 1 0 12 6.5c-1.25 0-2.39.4-3.33 1.08a.75.75 0 0 1-.88-1.22A6.96 6.96 0 0 1 12 5z" />
      </svg>
    </button>
  );
  const mainButton = (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      disabled={disabled}
      aria-label={currentAriaLabel}
      title={currentAriaLabel}
      className={buttonBaseClass}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : playing ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
        </svg>
      ) : paused ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M4.5 3.75C4.5 2.714 5.618 2.066 6.518 2.58l12.75 7.25c.91.518.91 1.83 0 2.348l-12.75 7.25C5.618 19.934 4.5 19.286 4.5 18.25V3.75z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
          <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
        </svg>
      )}
    </button>
  );

  return (
    <span className={`${containerLayoutClass} ${buttonVisibilityClass} ${className}`}>
      {layout === "vertical" ? (
        <>
          {mainButton}
          {restartButton}
        </>
      ) : (
        <>
          {restartButton}
          {mainButton}
        </>
      )}
    </span>
  );
}
