"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { playSelectionChime, playStopChime } from "@/lib/selection-chime";
import { getLanguageCodeForTts } from "@/lib/tts-voices";
import type { LanguageCode } from "@/lib/languages";

const ELEVENLABS_WS_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const SCRIBE_MODEL = "scribe_v2_realtime";
const LONG_PRESS_MS = 1000;

/** Map AudioContext sample rate to ElevenLabs audio_format. */
function getAudioFormat(sampleRate: number): string {
  if (sampleRate <= 8000) return "pcm_8000";
  if (sampleRate <= 16000) return "pcm_16000";
  if (sampleRate <= 22050) return "pcm_22050";
  if (sampleRate <= 24000) return "pcm_24000";
  if (sampleRate <= 44100) return "pcm_44100";
  return "pcm_48000";
}

/** Convert Float32 samples to Int16 PCM (little-endian). */
function float32ToPcm16(float32: Float32Array): Uint8Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(int16.buffer);
}

/** Encode binary to base64. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

type Cleanup = () => void;

async function startElevenLabsStt(
  language: LanguageCode,
  onTranscription: (text: string) => void,
  onError: (err: string) => void
): Promise<Cleanup> {
  const tokenRes = await fetch("/api/elevenlabs/stt-token", { method: "POST" });
  if (!tokenRes.ok) {
    const data = await tokenRes.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to get STT token");
  }
  const { token } = (await tokenRes.json()) as { token: string };
  if (!token) throw new Error("Invalid token response");

  const langCode = getLanguageCodeForTts(language);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);

  const sampleRate = ctx.sampleRate;
  const audioFormat = getAudioFormat(sampleRate);
  const targetRate =
    audioFormat === "pcm_44100" ? 44100 : audioFormat === "pcm_48000" ? 48000 : 16000;

  const params = new URLSearchParams({
    token,
    language_code: langCode,
    model_id: SCRIBE_MODEL,
    commit_strategy: "vad",
    audio_format: audioFormat,
  });

  const ws = new WebSocket(`${ELEVENLABS_WS_URL}?${params}`);

  const cleanupFns: (() => void)[] = [];
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupFns.forEach((fn) => fn());
    ws.close();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };

  ws.onerror = () => {
    onError("WebSocket error");
    cleanup();
  };
  ws.onclose = () => cleanup();

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        message_type?: string;
        text?: string;
        error?: string;
      };
      const mt = msg.message_type;
      if (mt === "committed_transcript" && typeof msg.text === "string" && msg.text.trim()) {
        onTranscription(msg.text.trim());
      }
      if (mt === "committed_transcript_with_timestamps" && typeof msg.text === "string" && msg.text.trim()) {
        onTranscription(msg.text.trim());
      }
      if (mt === "error" || mt === "auth_error" || mt === "quota_exceeded" || mt === "rate_limited") {
        onError(msg.error ?? "Transcription error");
        cleanup();
      }
    } catch {
      /* ignore parse errors */
    }
  };

  const downsample = sampleRate > targetRate ? Math.round(sampleRate / targetRate) : 1;

  let buffer: number[] = [];
  const chunkSamples = Math.floor((targetRate * 40) / 1000); // ~40ms chunks

  const sendChunk = (samples: Float32Array) => {
    let toConvert = samples;
    if (downsample > 1) {
      const down: number[] = [];
      for (let i = 0; i < samples.length; i += downsample) {
        down.push(samples[i] ?? 0);
      }
      toConvert = new Float32Array(down);
    }
    buffer.push(...Array.from(toConvert));
    while (buffer.length >= chunkSamples) {
      const chunk = new Float32Array(buffer.splice(0, chunkSamples));
      const pcm = float32ToPcm16(chunk);
      const b64 = uint8ArrayToBase64(pcm);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: b64,
            commit: false,
            sample_rate: targetRate,
          })
        );
      }
    }
  };

  const waitForOpen = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket failed to open"));
    });

  await waitForOpen();

  try {
    if (typeof ctx.audioWorklet?.addModule === "function") {
      await ctx.audioWorklet.addModule("/audio-worklet-pcm.js");
      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletNode.port.onmessage = (e: MessageEvent<{ samples: Float32Array }>) => {
        if (e.data?.samples) sendChunk(e.data.samples);
      };
      source.connect(workletNode);
      cleanupFns.push(() => workletNode.disconnect());
    } else {
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        sendChunk(input);
      };
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);
      cleanupFns.push(() => {
        processor.disconnect();
        source.disconnect();
      });
    }
  } catch (err) {
    cleanup();
    throw err;
  }

  return cleanup;
}

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
  const cleanupRef = useRef<Cleanup | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const didLongPressRef = useRef(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!window.WebSocket
    );
  }, []);

  const stopListening = useCallback(() => {
    const fn = cleanupRef.current;
    if (fn) {
      fn();
      cleanupRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (disabled || !supported) return;
    try {
      const cleanup = await startElevenLabsStt(
        language,
        onTranscription,
        (err) => {
          console.warn("ElevenLabs STT:", err);
          stopListening();
        }
      );
      cleanupRef.current = cleanup;
      setListening(true);
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
    }
  }, [language, disabled, supported, onTranscription, stopListening]);

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
      {onLongPress && !listening && !disabled && holdProgress === 0 && (
        <span
          className="absolute inset-0 rounded-2xl border-2 border-current pointer-events-none animate-voice-hold-hint"
          aria-hidden
        />
      )}
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
