"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { playSelectionChime, playStopChime } from "@/lib/selection-chime";
import { getLanguageCodeForTts } from "@/lib/tts-voices";
import type { LanguageCode } from "@/lib/languages";

const ELEVENLABS_WS_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const SCRIBE_MODEL = "scribe_v2_realtime";
const LONG_PRESS_MS = 1000;
const AUTO_STOP_MS = 60_000;
const AudioOrbVisual = dynamic(
  () => import("@/components/AudioOrbVisual").then((m) => m.AudioOrbVisual),
  { ssr: false }
);

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

type SttSession = {
  cleanup: () => void;
  requestCommit: () => Promise<void>;
};

async function startElevenLabsStt(
  language: LanguageCode,
  onCommittedTranscript: (text: string) => void,
  onError: (err: string) => void,
  onAudioLevel?: (level: number) => void,
  onPartialTranscript?: (text: string) => void,
  onOrbNodesChange?: (nodes: { input: GainNode; output: GainNode } | null) => void
): Promise<SttSession> {
  const tokenResPromise = fetch("/api/elevenlabs/stt-token", { method: "POST" });
  const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
  const tokenRes = await tokenResPromise;
  if (!tokenRes.ok) {
    const data = await tokenRes.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to get STT token");
  }
  const { token } = (await tokenRes.json()) as { token: string };
  if (!token) throw new Error("Invalid token response");

  const langCode = getLanguageCodeForTts(language);
  const stream = await streamPromise;
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const orbInput = ctx.createGain();
  source.connect(orbInput);
  onOrbNodesChange?.({ input: orbInput, output: orbInput });

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

  const sessionStartMs = Date.now();
  const ws = new WebSocket(`${ELEVENLABS_WS_URL}?${params}`);
  let resolveCommitWait: (() => void) | null = null;

  const cleanupFns: (() => void)[] = [];
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    const durationSeconds = (Date.now() - sessionStartMs) / 1000;
    if (durationSeconds > 0) {
      fetch("/api/me/usage/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      }).catch(() => {});
    }
    onOrbNodesChange?.(null);
    cleanupFns.forEach((fn) => fn());
    ws.close();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };

  ws.onerror = () => {
    onError("WebSocket error");
    if (resolveCommitWait) {
      resolveCommitWait();
      resolveCommitWait = null;
    }
    cleanup();
  };
  ws.onclose = () => {
    if (resolveCommitWait) {
      resolveCommitWait();
      resolveCommitWait = null;
    }
    cleanup();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        message_type?: string;
        text?: string;
        error?: string;
      };
      const mt = msg.message_type;
      if (mt === "committed_transcript" && typeof msg.text === "string" && msg.text.trim()) {
        onCommittedTranscript(msg.text.trim());
        if (resolveCommitWait) {
          resolveCommitWait();
          resolveCommitWait = null;
        }
      }
      if (mt === "committed_transcript_with_timestamps" && typeof msg.text === "string" && msg.text.trim()) {
        onCommittedTranscript(msg.text.trim());
        if (resolveCommitWait) {
          resolveCommitWait();
          resolveCommitWait = null;
        }
      }
      if (mt === "partial_transcript" && typeof msg.text === "string") {
        onPartialTranscript?.(msg.text.trim());
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

  const sendAudioPayload = (samples: Float32Array, commit: boolean) => {
    const pcm = float32ToPcm16(samples);
    const b64 = uint8ArrayToBase64(pcm);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: b64,
          commit,
          sample_rate: targetRate,
        })
      );
    }
  };

  const sendChunk = (samples: Float32Array) => {
    let toConvert = samples;
    if (downsample > 1) {
      const down: number[] = [];
      for (let i = 0; i < samples.length; i += downsample) {
        down.push(samples[i] ?? 0);
      }
      toConvert = new Float32Array(down);
    }
    if (toConvert.length > 0 && onAudioLevel) {
      let sum = 0;
      for (let i = 0; i < toConvert.length; i++) {
        const v = toConvert[i] ?? 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / toConvert.length);
      // Normalize and clamp to 0-1 for UI meter.
      onAudioLevel(Math.max(0, Math.min(1, rms * 12)));
    }
    buffer.push(...Array.from(toConvert));
    while (buffer.length >= chunkSamples) {
      const chunk = new Float32Array(buffer.splice(0, chunkSamples));
      sendAudioPayload(chunk, false);
    }
  };

  const requestCommit = async () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    // Flush any trailing audio and explicitly request a commit
    // so the final utterance isn't cut when the user taps finish.
    if (buffer.length > 0) {
      const finalChunk = new Float32Array(buffer.splice(0, buffer.length));
      sendAudioPayload(finalChunk, true);
    } else {
      const silence = new Float32Array(Math.max(160, Math.floor(targetRate * 0.01)));
      sendAudioPayload(silence, true);
    }
    // Wait for a committed transcript event after commit request, or timeout.
    await new Promise<void>((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (done) return;
        done = true;
        resolveCommitWait = null;
        resolve();
      }, 700);
      resolveCommitWait = () => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        resolve();
      };
    });
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

  return { cleanup, requestCommit };
}

export function VoiceInputButton({
  onTranscription,
  onLongPress,
  language = "en",
  disabled = false,
  className = "",
  ariaLabel = "Voice input",
  compactStopWhileListening = false,
}: {
  onTranscription: (text: string) => void;
  onLongPress?: () => void;
  language?: LanguageCode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  compactStopWhileListening?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [supported, setSupported] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [orbNodes, setOrbNodes] = useState<{ input: GainNode; output: GainNode } | null>(null);
  const cleanupRef = useRef<SttSession | null>(null);
  const pendingTranscriptRef = useRef<string[]>([]);
  const partialTranscriptRef = useRef("");
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const didLongPressRef = useRef(false);
  const startAttemptRef = useRef(0);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!window.WebSocket
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const stopListening = useCallback(() => {
    startAttemptRef.current += 1;
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    const session = cleanupRef.current;
    if (session) {
      session.cleanup();
      cleanupRef.current = null;
    }
    setStarting(false);
    setListening(false);
    setAudioLevel(0);
    setOrbNodes(null);
  }, []);

  const startListening = useCallback(async () => {
    if (disabled || !supported || listening || starting) return;
    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;
    pendingTranscriptRef.current = [];
    partialTranscriptRef.current = "";
    setAudioLevel(0);
    setStarting(true);
    try {
      const session = await startElevenLabsStt(
        language,
        (text) => {
          pendingTranscriptRef.current.push(text);
          partialTranscriptRef.current = "";
        },
        (err) => {
          console.warn("ElevenLabs STT:", err);
          stopListening();
        },
        (level) => {
          setAudioLevel((prev) => Math.max(level, prev * 0.9));
        },
        (partialText) => {
          partialTranscriptRef.current = partialText;
        },
        (nodes) => setOrbNodes(nodes)
      );
      if (startAttemptRef.current !== attemptId) {
        session.cleanup();
        return;
      }
      cleanupRef.current = session;
      setStarting(false);
      setListening(true);
    } catch (err) {
      if (startAttemptRef.current === attemptId) {
        setStarting(false);
      }
      console.warn("Failed to start speech recognition:", err);
    }
  }, [language, disabled, listening, starting, supported, stopListening]);

  const cancelListening = useCallback(() => {
    pendingTranscriptRef.current = [];
    partialTranscriptRef.current = "";
    playStopChime();
    stopListening();
  }, [stopListening]);

  const finishAndPaste = useCallback(async () => {
    const session = cleanupRef.current;
    if (session) {
      try {
        await session.requestCommit();
      } catch {
        /* best effort */
      }
    }
    const text = [...pendingTranscriptRef.current, partialTranscriptRef.current]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pendingTranscriptRef.current = [];
    partialTranscriptRef.current = "";
    playStopChime();
    stopListening();
    if (text) onTranscription(text);
  }, [onTranscription, stopListening]);

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
    if (!listening && !starting) {
      playSelectionChime();
      void startListening();
    }
  }, [listening, starting, startListening]);

  useEffect(() => {
    if (!listening) return;
    const levelInterval = setInterval(() => {
      setAudioLevel((v) => Math.max(0, v * 0.95));
    }, 80);
    return () => clearInterval(levelInterval);
  }, [listening]);

  useEffect(() => {
    if (!listening) return;
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = setTimeout(() => {
      void finishAndPaste();
    }, AUTO_STOP_MS);
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };
  }, [listening, finishAndPaste]);

  useEffect(() => {
    return () => {
      stopListening();
      pendingTranscriptRef.current = [];
      partialTranscriptRef.current = "";
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (holdProgressIntervalRef.current) clearInterval(holdProgressIntervalRef.current);
    };
  }, [stopListening]);

  if (!supported) return null;

  if (listening || starting) {
    if (compactStopWhileListening) {
      return (
        <button
          type="button"
          onClick={() => void finishAndPaste()}
          aria-label="Stop voice input"
          className={`relative flex items-center justify-center min-w-[52px] min-h-[52px] rounded-2xl border border-red-500/80 text-white bg-red-500 hover:bg-red-600 transition-all duration-200 shrink-0 ${className}`}
        >
          {starting ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
          ) : (
            <span className="w-3 h-3 bg-white rounded-[2px]" aria-hidden />
          )}
        </button>
      );
    }
    return (
      <div
        className={`relative flex items-center gap-1 rounded-xl px-1.5 py-1 min-h-[44px] bg-neutral-100/95 dark:bg-neutral-800/95 border border-neutral-300 dark:border-neutral-600 shrink-0 min-w-0 max-w-full ${className}`}
        aria-label="Voice capture controls"
      >
        <div className="relative group/cancel shrink-0">
          <button
            type="button"
            onClick={cancelListening}
            aria-label="Cancel voice capture"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 opacity-0 group-hover/cancel:opacity-100 group-focus-within/cancel:opacity-100 transition-opacity">
            Cancel
          </span>
        </div>

        <div
          className={`relative flex items-center justify-center shrink-0 ${isMobile ? "min-w-[4rem]" : "w-10 h-10"}`}
          aria-hidden
        >
          {isMobile ? (
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              All ears…
            </span>
          ) : orbNodes ? (
            <AudioOrbVisual
              inputNode={orbNodes.input}
              outputNode={orbNodes.output}
              transparentBackground
              disablePostprocessing
            />
          ) : (
            <span
              className="absolute w-3 h-3 rounded-full bg-white/30 blur-[1px] transition-transform duration-75"
              style={{ transform: `scale(${1 + audioLevel * 1.8})`, opacity: 0.25 + audioLevel * 0.45 }}
            />
          )}
        </div>

        <div className="relative group/finish shrink-0">
          <button
            type="button"
            onClick={() => void finishAndPaste()}
            aria-label="Finish and paste"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            <span className="w-2.5 h-2.5 bg-white rounded-[2px]" aria-hidden />
          </button>
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 opacity-0 group-hover/finish:opacity-100 group-focus-within/finish:opacity-100 transition-opacity">
            Finish and Paste
          </span>
        </div>
      </div>
    );
  }

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
      className={`relative flex items-center justify-center min-w-[52px] min-h-[52px] rounded-2xl border border-neutral-200/70 dark:border-neutral-700/80 text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 select-none touch-manipulation no-touch-callout [-webkit-tap-highlight-color:transparent] ${className}`}
    >
      {onLongPress && !disabled && holdProgress === 0 && (
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
      {holdProgress > 0 && holdProgress < 100 ? (
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
