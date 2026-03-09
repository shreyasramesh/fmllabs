/**
 * Plays a short, pleasant two-tone chime for selection feedback (similar to ElevenLabs onboarding).
 * Uses Web Audio API - no external audio files required.
 * Respects prefers-reduced-motion for accessibility.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Plays a subtle two-tone ascending chime (C5 → E5) for selection feedback.
 * Safe to call repeatedly; will not overlap or stack.
 */
export function playSelectionChime(): void {
  if (prefersReducedMotion()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    gain.connect(ctx.destination);

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playTone(523.25, ctx.currentTime, 0.08); // C5
    playTone(659.25, ctx.currentTime + 0.06, 0.1); // E5
  } catch {
    // Silently fail if autoplay policy blocks or any error
  }
}

/**
 * Plays a subtle two-tone descending chime (E5 → C5) - opposite of playSelectionChime.
 * Use for "stop" or "dismiss" feedback.
 */
export function playStopChime(): void {
  if (prefersReducedMotion()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    gain.connect(ctx.destination);

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playTone(659.25, ctx.currentTime, 0.08); // E5
    playTone(523.25, ctx.currentTime + 0.06, 0.1); // C5
  } catch {
    // Silently fail if autoplay policy blocks or any error
  }
}
