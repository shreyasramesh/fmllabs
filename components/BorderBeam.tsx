"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

interface BorderBeamProps {
  duration?: number;
  className?: string;
}

interface Metrics {
  width: number;
  height: number;
  radius: number;
}

const MIN_BEAM = 84;
const MAX_BEAM = 176;
const INSET = 1.2;
const START = 0.18;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function readRadius(el: HTMLElement | null, w: number, h: number): number {
  if (!el) return 0;
  const r = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? clamp(r, 0, Math.min(w, h) / 2) : 0;
}

function rrect(w: number, h: number, rad: number, ins: number): string {
  const iw = Math.max(w - ins * 2, 0);
  const ih = Math.max(h - ins * 2, 0);
  const r = clamp(rad, 0, Math.min(iw, ih) / 2);
  const x = ins;
  const y = ins;
  return [
    `M${x + r},${y}`, `H${x + iw - r}`,
    `A${r},${r} 0 0 1 ${x + iw},${y + r}`, `V${y + ih - r}`,
    `A${r},${r} 0 0 1 ${x + iw - r},${y + ih}`, `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + ih - r}`, `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`, "Z",
  ].join(" ");
}

/**
 * Apple Intelligence–style glow segment that travels around a container's
 * border using SVG stroke-dashing so it curves naturally at corners.
 */
export const BorderBeam = React.memo(function BorderBeam({
  duration = 8.5,
  className = "",
}: BorderBeamProps) {
  const uid = useId().replace(/:/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const midRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const glowGradRef = useRef<SVGLinearGradientElement>(null);
  const midGradRef = useRef<SVGLinearGradientElement>(null);
  const coreGradRef = useRef<SVGLinearGradientElement>(null);
  const frameRef = useRef<number | null>(null);
  const [m, setM] = useState<Metrics>({ width: 0, height: 0, radius: 0 });
  const [noMotion, setNoMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cb = () => setNoMotion(mq.matches);
    cb();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    }
    mq.addListener(cb);
    return () => mq.removeListener(cb);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const parent = host?.parentElement;
    if (!host || !parent) return;
    const measure = () => {
      const { width, height } = host.getBoundingClientRect();
      const next: Metrics = { width, height, radius: readRadius(parent, width, height) };
      setM((cur) =>
        Math.abs(cur.width - next.width) < 0.5 &&
        Math.abs(cur.height - next.height) < 0.5 &&
        Math.abs(cur.radius - next.radius) < 0.5
          ? cur
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const pathD = useMemo(
    () => (m.width && m.height ? rrect(m.width, m.height, m.radius, INSET) : ""),
    [m.width, m.height, m.radius],
  );

  const beamLen = useMemo(() => {
    if (!m.width || !m.height) return MIN_BEAM;
    const perim = 2 * (m.width + m.height);
    return clamp(Math.round(m.width * 0.28), MIN_BEAM, Math.min(MAX_BEAM, perim * 0.2));
  }, [m.width, m.height]);

  useEffect(() => {
    const path = measureRef.current;
    const layers: (SVGPathElement | null)[] = [glowRef.current, midRef.current, coreRef.current];
    const grads: (SVGLinearGradientElement | null)[] = [
      glowGradRef.current,
      midGradRef.current,
      coreGradRef.current,
    ];
    if (!path || layers.some((l) => !l) || grads.some((g) => !g) || !pathD) return;

    const total = path.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return;

    const dash = `${beamLen} ${total - beamLen}`;
    for (const l of layers) l!.style.strokeDasharray = dash;

    const sample = Math.min(2, total / 16);

    const tick = (progress: number) => {
      const off = `${-(progress * total)}`;
      for (const l of layers) l!.style.strokeDashoffset = off;

      const mid = ((progress * total) + beamLen / 2) % total;
      const p0 = path.getPointAtLength(mid);
      const p1 = path.getPointAtLength((mid + sample) % total);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const half = beamLen * 0.6;
      const x1 = `${p0.x - (dx / len) * half}`;
      const y1 = `${p0.y - (dy / len) * half}`;
      const x2 = `${p0.x + (dx / len) * half}`;
      const y2 = `${p0.y + (dy / len) * half}`;
      for (const g of grads) {
        g!.setAttribute("x1", x1);
        g!.setAttribute("y1", y1);
        g!.setAttribute("x2", x2);
        g!.setAttribute("y2", y2);
      }
    };

    tick(START);
    if (noMotion) return;

    const step = (t: number) => {
      tick((START + t / (duration * 1000)) % 1);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [duration, pathD, beamLen, noMotion]);

  const gId = `bg${uid}`;
  const mId = `bm${uid}`;
  const cId = `bc${uid}`;
  const fgId = `fg${uid}`;
  const fmId = `fm${uid}`;

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 z-[1] rounded-[inherit] ${className}`.trim()}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      {pathD ? (
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          width={m.width}
          height={m.height}
          viewBox={`0 0 ${m.width} ${m.height}`}
          fill="none"
        >
          <defs>
            <filter id={fgId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.8" />
            </filter>
            <filter id={fmId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>

            <linearGradient ref={glowGradRef} id={gId} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(156,196,255,0)" />
              <stop offset="14%" stopColor="rgba(156,196,255,0.32)" />
              <stop offset="36%" stopColor="rgba(191,165,255,0.38)" />
              <stop offset="64%" stopColor="rgba(238,163,220,0.38)" />
              <stop offset="88%" stopColor="rgba(255,194,146,0.3)" />
              <stop offset="100%" stopColor="rgba(255,194,146,0)" />
            </linearGradient>
            <linearGradient ref={midGradRef} id={mId} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(178,210,255,0)" />
              <stop offset="14%" stopColor="rgba(178,210,255,0.52)" />
              <stop offset="38%" stopColor="rgba(200,178,255,0.6)" />
              <stop offset="66%" stopColor="rgba(242,178,222,0.6)" />
              <stop offset="90%" stopColor="rgba(255,200,160,0.5)" />
              <stop offset="100%" stopColor="rgba(255,200,160,0)" />
            </linearGradient>
            <linearGradient ref={coreGradRef} id={cId} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(190,218,255,0)" />
              <stop offset="12%" stopColor="rgba(190,218,255,0.88)" />
              <stop offset="38%" stopColor="rgba(210,190,255,0.92)" />
              <stop offset="66%" stopColor="rgba(248,188,228,0.92)" />
              <stop offset="90%" stopColor="rgba(255,210,178,0.88)" />
              <stop offset="100%" stopColor="rgba(255,210,178,0)" />
            </linearGradient>
          </defs>

          {/* Static faint border */}
          <path
            d={pathD}
            className="stroke-neutral-300/80 dark:stroke-neutral-700/80"
            strokeWidth={1.1}
            fill="none"
          />

          {/* Outer glow – tight, lightly blurred */}
          <path
            ref={glowRef}
            d={pathD}
            stroke={`url(#${gId})`}
            strokeWidth={5}
            fill="none"
            filter={`url(#${fgId})`}
            strokeLinecap="round"
            opacity={0.3}
          />

          {/* Mid glow */}
          <path
            ref={midRef}
            d={pathD}
            stroke={`url(#${mId})`}
            strokeWidth={2.5}
            fill="none"
            filter={`url(#${fmId})`}
            strokeLinecap="round"
            opacity={0.5}
          />

          {/* Core crisp line */}
          <path
            ref={coreRef}
            d={pathD}
            stroke={`url(#${cId})`}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            opacity={0.88}
          />

          {/* Hidden path for measurement */}
          <path ref={measureRef} d={pathD} stroke="none" fill="none" />
        </svg>
      ) : null}
    </div>
  );
});
