"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const HAPTIC_THROTTLE_MS = 70;

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-haptic='off']")) return false;

  return !!target.closest("button, a, [role='button'], input[type='checkbox'], input[type='radio']");
}

export function NativeHaptics() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastImpactAt = 0;

    const onClick = (event: Event) => {
      if (!isInteractiveElement(event.target)) return;

      const now = Date.now();
      if (now - lastImpactAt < HAPTIC_THROTTLE_MS) return;
      lastImpactAt = now;

      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Ignore plugin-level failures to keep UI interactions uninterrupted.
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
