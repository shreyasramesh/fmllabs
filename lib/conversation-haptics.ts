"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

let lastStartAt = 0;
let lastChunkAt = 0;

const START_THROTTLE_MS = 400;
const CHUNK_THROTTLE_MS = 700;

function canUseNativeHaptics(): boolean {
  return Capacitor.isNativePlatform();
}

export async function playLlmResponseStartHaptic(): Promise<void> {
  if (!canUseNativeHaptics()) return;
  const now = Date.now();
  if (now - lastStartAt < START_THROTTLE_MS) return;
  lastStartAt = now;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  }
}

export async function playLlmResponseVisibleHaptic(): Promise<void> {
  if (!canUseNativeHaptics()) return;
  const now = Date.now();
  if (now - lastChunkAt < CHUNK_THROTTLE_MS) return;
  lastChunkAt = now;

  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(18);
  }
}

