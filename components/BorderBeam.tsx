"use client";

import React from "react";

interface BorderBeamProps {
  /** Animation duration in seconds. */
  duration?: number;
  /** Additional CSS class on the outer wrapper. */
  className?: string;
}

export const BorderBeam = React.memo(function BorderBeam({
  duration = 8,
  className = "",
}: BorderBeamProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit] ${className}`.trim()}
      aria-hidden
    >
      <div
        className="absolute inset-[-50%] animate-border-beam"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, transparent 70%, var(--accent) 76%, color-mix(in srgb, var(--accent) 60%, transparent) 78%, transparent 82%, transparent 100%)",
          animationDuration: `${duration}s`,
        }}
      />
    </div>
  );
});
