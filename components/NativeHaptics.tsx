"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const HAPTIC_THROTTLE_MS = 120;

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-haptic='off']")) return false;

  return !!target.closest(
    "[data-haptic='on'], button, a, [role='button'], input, select, textarea, summary"
  );
}

export function NativeHaptics() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastImpactAt = 0;

    const pulse = async () => {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(18);
        }
      }
    };

    const onClick = (event: Event) => {
      if (!isInteractiveElement(event.target)) return;

      const now = Date.now();
      if (now - lastImpactAt < HAPTIC_THROTTLE_MS) return;
      lastImpactAt = now;

      void pulse();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
