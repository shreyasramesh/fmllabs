"use client";

import { useEffect, useState, useMemo } from "react";

/** Approximate moon phase (0–1): 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter */
function getMoonPhase(date: Date): number {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const lunarCycle = 29.53058867 * 24 * 60 * 60 * 1000;
  const elapsed = date.getTime() - knownNewMoon;
  return (elapsed % lunarCycle) / lunarCycle;
}

function MoonPhaseSvg({ phase }: { phase: number }) {
  const r = 12;
  const cx = 24;
  const cy = 24;
  const dark = "#0a0a0a";
  const light = "#f5f5dc";

  if (phase < 0.02 || phase > 0.98) {
    return <circle cx={cx} cy={cy} r={r} fill={dark} stroke={light} strokeWidth="0.5" opacity="0.8" />;
  }
  if (phase > 0.48 && phase < 0.52) {
    return <circle cx={cx} cy={cy} r={r} fill={light} opacity="0.9" />;
  }

  const clipId = `moon-clip-${(phase * 100).toFixed(0)}`;
  const isWaxing = phase < 0.5;
  const shadowX = isWaxing ? -r * 2 * (phase / 0.5) : r * 2 * ((phase - 0.5) / 0.5);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={light} opacity="0.9" />
      <circle
        cx={cx + shadowX}
        cy={cy}
        r={r}
        fill={dark}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}

export function DarkSkyOverlay() {
  const [shootingStar, setShootingStar] = useState<{ id: number; x: number; y: number } | null>(null);
  const [moonPhase, setMoonPhase] = useState(0);

  const stars = useMemo(() => {
    const s: { x: number; y: number; size: number; shimmer: boolean }[] = [];
    for (let i = 0; i < 80; i++) {
      s.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.5 + 0.5,
        shimmer: Math.random() < 0.3,
      });
    }
    return s;
  }, []);

  useEffect(() => {
    setMoonPhase(getMoonPhase(new Date()));
    const moonInterval = setInterval(() => {
      setMoonPhase(getMoonPhase(new Date()));
    }, 60 * 60 * 1000);
    return () => clearInterval(moonInterval);
  }, []);

  useEffect(() => {
    const triggerShootingStar = () => {
      setShootingStar({
        id: Date.now(),
        x: 80 + Math.random() * 20,
        y: Math.random() * 30,
      });
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 8000 + Math.random() * 4000;
      timeoutId = setTimeout(() => {
        triggerShootingStar();
        schedule();
      }, delay);
    };
    schedule();

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden dark:opacity-100 opacity-0 transition-opacity duration-500"
      aria-hidden
    >
      {stars.map((star, i) => (
        <div
          key={i}
          className={`absolute rounded-full bg-white ${star.shimmer ? "star-shimmer" : ""}`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
        />
      ))}

      {shootingStar && (
        <div
          key={shootingStar.id}
          className="absolute w-24 h-0.5 bg-gradient-to-r from-white to-transparent animate-shooting-star origin-left"
          style={{
            left: `${shootingStar.x}%`,
            top: `${shootingStar.y}%`,
          }}
        />
      )}

      <div className="absolute top-6 right-8 w-12 h-12 opacity-90">
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <MoonPhaseSvg phase={moonPhase} />
        </svg>
      </div>
    </div>
  );
}
