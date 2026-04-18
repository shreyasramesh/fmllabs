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
 * Animated border beam inspired by Apple Intelligence glow.
 * Renders a thin light beam that travels along the container edge.
 * Parent must have `position: relative` and a `border-radius`.
 */
export const BorderBeam = React.memo(function BorderBeam({
  duration = 8,
  borderWidth = 2,
  className = "",
}: BorderBeamProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[1] rounded-[inherit] ${className}`.trim()}
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
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, transparent 60%, var(--accent) 70%, color-mix(in srgb, var(--accent) 80%, white) 73%, var(--accent) 76%, transparent 85%, transparent 100%)",
          animationDuration: `${duration}s`,
        }}
      />
    </div>
  );
});
