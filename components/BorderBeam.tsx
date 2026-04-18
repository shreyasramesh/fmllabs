"use client";

import React from "react";

interface BorderBeamProps {
  /** Animation duration in seconds. */
  duration?: number;
  /** Border width in pixels. */
  borderWidth?: number;
  /** Additional CSS class on the outer wrapper. */
  className?: string;
}

/**
 * Animated multi-color border beam with diffused glow, inspired by Apple Intelligence.
 * Two layers: a sharp masked border ring + a blurred halo underneath.
 * Parent must have `position: relative` and a `border-radius`.
 */
export const BorderBeam = React.memo(function BorderBeam({
  duration = 8,
  borderWidth = 2,
  className = "",
}: BorderBeamProps) {
  const gradient =
    "conic-gradient(from 0deg, #f97316 0%, #ec4899 14%, #a855f7 28%, #6366f1 42%, transparent 50%, transparent 65%, #3b82f6 72%, #a855f7 80%, #ec4899 88%, #f97316 100%)";

  return (
    <>
      {/* Diffused glow layer — sits behind the sharp border */}
      <div
        className={`pointer-events-none absolute z-[1] rounded-[inherit] ${className}`.trim()}
        aria-hidden
        style={{
          inset: -4,
          overflow: "hidden",
          filter: "blur(10px)",
          opacity: 0.5,
        }}
      >
        <div
          className="absolute inset-[-100%] animate-border-beam"
          style={{ background: gradient, animationDuration: `${duration}s` }}
        />
      </div>

      {/* Sharp border ring — masked to show only the edge */}
      <div
        className={`pointer-events-none absolute inset-0 z-[1] rounded-[inherit]`}
        aria-hidden
        style={{
          padding: borderWidth,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          overflow: "hidden",
        }}
      >
        <div
          className="absolute inset-[-100%] animate-border-beam"
          style={{ background: gradient, animationDuration: `${duration}s` }}
        />
      </div>
    </>
  );
});
