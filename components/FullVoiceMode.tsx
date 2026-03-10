"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { parseAssistantMessage } from "@/lib/chat-utils";

const AudioOrbVisual = dynamic(
  () => import("@/components/AudioOrbVisual").then((m) => m.AudioOrbVisual),
  { ssr: false }
);
import { stripMarkdown } from "@/lib/strip-markdown";
import type { LanguageCode } from "@/lib/languages";

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
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; length: number; [i: number]: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function FullVoiceMode({
  onClose,
  onSendMessage,
  messages,
  isLoading,
  language = "en",
  embed = false,
  onTtsProgress,
  onTtsEnd,
  speed = 1,
}: {
  onClose: () => void;
  onSendMessage: (text: string) => void;
  messages: { role: string; content: string }[];
  isLoading: boolean;
  language?: LanguageCode;
  embed?: boolean;
  /** Called with (messageIndex, charEnd) during TTS playback for word highlighting. charEnd is the last character index spoken so far. */
  onTtsProgress?: (messageIndex: number, charEnd: number) => void;
  /** Called when TTS playback ends (to clear highlight) */
  onTtsEnd?: () => void;
  /** Playback speed 0.7–1.2 (ElevenLabs) */
  speed?: number;
}) {
  const [listening, setListening] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [supported, setSupported] = useState(false);
  const [audioNodes, setAudioNodes] = useState<{
    input: GainNode;
    output: GainNode;
  } | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const lastTtsIndexRef = useRef(-1);
  const prevLoadingRef = useRef(isLoading);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioNodesRef = useRef<{ input: GainNode; output: GainNode } | null>(null);
  const onTtsProgressRef = useRef(onTtsProgress);
  const onTtsEndRef = useRef(onTtsEnd);
  onTtsProgressRef.current = onTtsProgress;
  onTtsEndRef.current = onTtsEnd;

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  // Create AudioContext and GainNodes for the 3D orb visual
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();
    outputGain.connect(ctx.destination);
    const nodes = { input: inputGain, output: outputGain };
    audioNodesRef.current = nodes;
    setAudioNodes(nodes);
    return () => {
      ctx.close();
      audioNodesRef.current = null;
    };
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
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI || isLoading) return;
    const isMobileBrowser =
      typeof navigator !== "undefined" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

    const recognition = new SpeechRecognitionAPI();
    // Mobile Chrome is flaky with continuous mode; single-utterance is more reliable.
    recognition.continuous = !isMobileBrowser;
    recognition.interimResults = true;
    recognition.lang = LANG_TO_SPEECH[language] ?? "en-US";
    recognition.maxAlternatives = 1;

    // On mobile Chrome, isFinal often never becomes true - send on onend as fallback
    let lastTranscript = "";
    let sentThisSession = false;

    recognition.onresult = (event: { results: ArrayLike<{ isFinal: boolean; length: number; [i: number]: { transcript: string } }> }) => {
      const results = event.results;
      const last = results[results.length - 1];
      const transcript = (last && last[0]?.transcript) ?? "";
      if (transcript) lastTranscript = transcript;
      if (last.isFinal && transcript.trim()) {
        sentThisSession = true;
        onSendMessage(transcript.trim());
        stopListening();
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
      // Mobile fallback: isFinal may never be true, send last transcript when recognition ends
      if (!sentThisSession && lastTranscript.trim()) {
        onSendMessage(lastTranscript.trim());
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
      return;
    }

    // Start orb mic visualization only after recognition starts.
    // On mobile, delay slightly so recognition can lock in first.
    if (isMobileBrowser) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const nodes = audioNodesRef.current;
    if (nodes) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const ctx = nodes.input.context as AudioContext;
        if (ctx.state === "suspended") await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        source.connect(nodes.input);
        mediaStreamSourceRef.current = source;
      } catch {
        /* mic access denied, orb will show silence */
      }
    }
  }, [language, isLoading, onSendMessage, stopListening]);

  const handleOrbClick = useCallback(() => {
    if (listening) {
      stopListening();
    } else if (supported && !isLoading && !ttsPlaying) {
      // Start listening on tap - recognition.start() requires a user gesture
      startListening();
    }
  }, [listening, supported, isLoading, ttsPlaying, stopListening, startListening]);

  // Note: recognition.start() requires a user gesture. We use tap-to-start via handleOrbClick
  // instead of auto-start, which would fail when the gesture from opening voice mode has expired.

  // TTS when assistant response completes (only when loading just finished)
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (!messages.length || isLoading || ttsPlaying) return;
    if (!wasLoading) return; // Only TTS when we transition from loading to done
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last?.role !== "assistant" || lastIdx <= lastTtsIndexRef.current) return;

    const { text, options } = parseAssistantMessage(last.content);
    const optionsSuffix =
      options.length > 0
        ? ` Follow-up options: ${options.join(". ")}`
        : "";
    const plainText = (stripMarkdown(text).trim() + optionsSuffix).trim();
    if (!plainText) return;

    lastTtsIndexRef.current = lastIdx;
    setTtsPlaying(true);
    onTtsProgressRef.current?.(lastIdx, -1);

    const textToSpeak = plainText.slice(0, 5000);
    const apiSpeed = Math.max(0.7, Math.min(1.2, speed));
    const playbackRate = speed / apiSpeed;
    fetch("/api/tts-with-timestamps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textToSpeak, speed: apiSpeed, language }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("TTS failed");
        return res.json();
      })
      .then(async (data: { audio_base64?: string; alignment?: { character_end_times_seconds?: number[] } }) => {
        if (!data?.audio_base64) throw new Error("No audio");
        const b64 = data.audio_base64;
        const alignment = data.alignment?.character_end_times_seconds;

        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;

        const nodes = audioNodesRef.current;
        if (nodes) {
          const ctx = nodes.output.context as AudioContext;
          if (ctx.state === "suspended") await ctx.resume();
          const source = ctx.createMediaElementSource(audio);
          source.connect(nodes.output);
          mediaElementSourceRef.current = source;
        }

        const endTimes = alignment ?? [];
        const updateHighlight = () => {
          if (!onTtsProgressRef.current || endTimes.length === 0) return;
          const t = audio.currentTime;
          let charEnd = -1;
          for (let i = 0; i < endTimes.length; i++) {
            if (endTimes[i] <= t) charEnd = i;
          }
          onTtsProgressRef.current(lastIdx, charEnd);
        };

        audio.ontimeupdate = updateHighlight;
        audio.onended = () => {
          mediaElementSourceRef.current?.disconnect();
          mediaElementSourceRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onTtsEndRef.current?.();
          setTtsPlaying(false);
        };
        audio.onerror = () => {
          mediaElementSourceRef.current?.disconnect();
          mediaElementSourceRef.current = null;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onTtsEndRef.current?.();
          setTtsPlaying(false);
        };
        await audio.play();
      })
      .catch(() => {
        fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSpeak, speed: apiSpeed }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("TTS failed");
            return res.blob();
          })
          .then(async (blob) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.playbackRate = playbackRate;
            audioRef.current = audio;
            const nodes = audioNodesRef.current;
            if (nodes) {
              const ctx = nodes.output.context as AudioContext;
              if (ctx.state === "suspended") await ctx.resume();
              const source = ctx.createMediaElementSource(audio);
              source.connect(nodes.output);
              mediaElementSourceRef.current = source;
            }
            audio.onended = () => {
              mediaElementSourceRef.current?.disconnect();
              mediaElementSourceRef.current = null;
              URL.revokeObjectURL(url);
              audioRef.current = null;
              onTtsEndRef.current?.();
              setTtsPlaying(false);
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              onTtsEndRef.current?.();
              setTtsPlaying(false);
            };
            await audio.play();
          })
          .catch(() => {
            onTtsEndRef.current?.();
            setTtsPlaying(false);
          });
      });
  }, [messages, isLoading, ttsPlaying, language, speed]);

  useEffect(() => {
    return () => {
      stopListening();
      audioRef.current?.pause();
    };
  }, [stopListening]);

  const isActive = listening || ttsPlaying || isLoading;
  const canTap = !isLoading;

  const orbContent = embed ? (
    <div className="flex items-center justify-center gap-2 w-full min-h-[62px]">
      {!supported ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-center text-xs">
          Voice mode not supported. Try Chrome or Edge.
        </p>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (canTap) handleOrbClick();
            }}
            disabled={!canTap}
            className="relative flex items-center justify-center shrink-0 w-[62px] h-[62px] rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 p-0 touch-manipulation"
            aria-label={listening ? "Stop listening" : "Voice active"}
          >
            {audioNodes ? (
              <AudioOrbVisual
                inputNode={audioNodes.input}
                outputNode={audioNodes.output}
                breathingMode={isLoading}
                className={`w-full h-full ${isActive ? "animate-voice-breathe" : ""}`}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-indigo-950" />
            )}
          </button>
          {(listening || !isActive) && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[120px] sm:max-w-[160px]">
              {listening ? "Tap to stop" : "Tap to speak"}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0"
            aria-label="Exit voice mode"
          >
            Exit
          </button>
        </>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center p-6 min-h-0">
      {!supported ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-center text-sm">
          Voice mode is not supported in this browser. Try Chrome or Edge.
        </p>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (canTap) handleOrbClick();
            }}
            disabled={!canTap}
            className="relative flex items-center justify-center transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 p-0 touch-manipulation"
            style={{
              width: isActive ? "clamp(192px, 36vw, 288px)" : "clamp(144px, 26.4vw, 216px)",
              height: isActive ? "clamp(192px, 36vw, 288px)" : "clamp(144px, 26.4vw, 216px)",
            }}
            aria-label={listening ? "Stop listening" : "Voice active"}
          >
            {audioNodes ? (
              <AudioOrbVisual
                inputNode={audioNodes.input}
                outputNode={audioNodes.output}
                breathingMode={isLoading}
                className={`w-full h-full ${isActive ? "animate-voice-breathe" : ""}`}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-indigo-950" />
            )}
          </button>
          {(listening || !isActive) && (
            <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-xs">
              {listening ? "Tap orb to stop" : "Tap orb to speak"}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            aria-label="Exit voice mode"
          >
            Exit voice mode
          </button>
        </>
      )}
    </div>
  );

  if (embed) {
    return orbContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <h1 className="font-semibold text-lg">Full Voice</h1>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Exit voice mode"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        {orbContent}
      </div>
    </div>
  );
}
