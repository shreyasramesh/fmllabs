"use client";

import React from "react";

interface BorderBeamProps {
  /** Animation duration in seconds. */
  duration?: number;
  /** Additional CSS class on the outer wrapper. */
  className?: string;
}

/**
 * A single animated multi-color beam that sweeps along the container border.
 * Parent must have `position: relative` and a `border-radius`.
 */
export const BorderBeam = React.memo(function BorderBeam({
  duration = 8,
  className = "",
}: BorderBeamProps) {
  const gradient =
    "conic-gradient(from 0deg, transparent 0%, transparent 70%, rgba(59,130,246,0.45) 75%, rgba(168,85,247,0.5) 80%, rgba(236,72,153,0.5) 85%, rgba(249,115,22,0.55) 90%, transparent 95%, transparent 100%)";

  return (
    <>
      {/* Soft glow halo */}
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
          opacity: 0.5,
        }}
      >
        <div
          className="absolute inset-[-100%] animate-border-beam"
          style={{ background: gradient, animationDuration: `${duration}s` }}
        />
      </div>

      {/* Thin crisp border */}
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
          opacity: 0.65,
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
