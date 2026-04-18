"use client";

import React from "react";

interface BorderBeamProps {
  /** Animation duration in seconds. */
  duration?: number;
  /** Additional CSS class on the outer wrapper. */
  className?: string;
}

/**
 * Subtle animated multi-color border glow inspired by Apple Intelligence.
 * A soft pastel spectrum sweeps along the container edge.
 * Parent must have `position: relative` and a `border-radius`.
 */
export const BorderBeam = React.memo(function BorderBeam({
  duration = 8,
  className = "",
}: BorderBeamProps) {
  const gradient =
    "conic-gradient(from 0deg, rgba(249,115,22,0.6) 0%, rgba(236,72,153,0.5) 14%, rgba(168,85,247,0.5) 28%, rgba(99,102,241,0.4) 42%, transparent 50%, transparent 65%, rgba(59,130,246,0.4) 72%, rgba(168,85,247,0.5) 80%, rgba(236,72,153,0.5) 88%, rgba(249,115,22,0.6) 100%)";

  return (
    <>
      {/* Soft outer glow */}
      <div
        className={`pointer-events-none absolute z-[1] rounded-[inherit] ${className}`.trim()}
        aria-hidden
        style={{
          inset: -3,
          overflow: "hidden",
          padding: 10,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          filter: "blur(4px)",
          opacity: 0.55,
        }}
      >
        <div
          className="absolute inset-[-100%] animate-border-beam"
          style={{ background: gradient, animationDuration: `${duration}s` }}
        />
      </div>

      {/* Thin crisp border line */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit]"
        aria-hidden
        style={{
          padding: 1,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          overflow: "hidden",
          opacity: 0.7,
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
