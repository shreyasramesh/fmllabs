"use client";

/**
 * MathCurveLoader
 *
 * Picks one of 21 mathematical curve animations at random on mount and runs it
 * as a centered SVG particle-trail overlay (no captions; for use over skeleton UIs).
 *
 * Animation engine ported from https://github.com/Paidax01/math-curve-loaders
 */

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

// CurveCfg uses a string-index to allow per-curve numeric params (baseRadius, etc.)
// that the `point` function reads via the `cfg` argument.
interface CurveCfg {
  name: string;
  tag: string;
  description: string;
  formula: string;
  particleCount: number;
  trailSpan: number;
  durationMs: number;
  rotationDurationMs: number;
  pulseDurationMs: number;
  strokeWidth: number;
  rotate: boolean;
  point(progress: number, ds: number, cfg: CurveCfg): Pt;
  [k: string]: unknown;
}

// ─── Animation Helpers ────────────────────────────────────────────────────────

function normP(p: number) {
  return ((p % 1) + 1) % 1;
}

function getDs(time: number, c: CurveCfg, ph: number): number {
  const pp = ((time + ph * c.pulseDurationMs) % c.pulseDurationMs) / c.pulseDurationMs;
  return 0.52 + ((Math.sin(pp * Math.PI * 2 + 0.55) + 1) / 2) * 0.48;
}

function getRot(time: number, c: CurveCfg, ph: number): number {
  if (!c.rotate) return 0;
  return (((time + ph * c.rotationDurationMs) % c.rotationDurationMs) / c.rotationDurationMs) * 360;
}

function makePathD(c: CurveCfg, ds: number, steps = 360): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const { x, y } = c.point(i / steps, ds, c);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

// ─── All 21 Curve Definitions ─────────────────────────────────────────────────

const CURVES: CurveCfg[] = [
  // 1 ── Original Thinking  (7-petal custom rose)
  {
    name: "Original Thinking", tag: "Custom Rose Trail",
    description: "The base circle is carved by a sevenfold cosine term, so the trail blooms into a rotating seven-petal ring.",
    formula: "x(t) = 50 + (7 cos t − 3s cos 7t) × 3.9\ny(t) = 50 + (7 sin t − 3s sin 7t) × 3.9\ns = pulse(time)",
    baseRadius: 7, detailAmplitude: 3, petalCount: 7, curveScale: 3.9,
    rotate: true, particleCount: 64, trailSpan: 0.38,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 5.5,
    point(p, s, c: any) {
      const t = p * Math.PI * 2; const k = Math.round(c.petalCount);
      return {
        x: 50 + (c.baseRadius * Math.cos(t) - c.detailAmplitude * s * Math.cos(k * t)) * c.curveScale,
        y: 50 + (c.baseRadius * Math.sin(t) - c.detailAmplitude * s * Math.sin(k * t)) * c.curveScale,
      };
    },
  },
  // 2 ── Thinking Five  (5-petal custom rose)
  {
    name: "Thinking Five", tag: "Custom Rose Trail",
    description: "Replacing the sevenfold term with a fivefold term reduces inner loops, giving the curve a cleaner five-petal rhythm.",
    formula: "x(t) = 50 + (7 cos t − 3s cos 5t) × 3.9\ny(t) = 50 + (7 sin t − 3s sin 5t) × 3.9",
    baseRadius: 7, detailAmplitude: 3, petalCount: 5, curveScale: 3.9,
    rotate: true, particleCount: 62, trailSpan: 0.38,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 5.5,
    point(p, s, c: any) {
      const t = p * Math.PI * 2; const k = Math.round(c.petalCount);
      return {
        x: 50 + (c.baseRadius * Math.cos(t) - c.detailAmplitude * s * Math.cos(k * t)) * c.curveScale,
        y: 50 + (c.baseRadius * Math.sin(t) - c.detailAmplitude * s * Math.sin(k * t)) * c.curveScale,
      };
    },
  },
  // 3 ── Thinking Nine  (9-petal custom rose)
  {
    name: "Thinking Nine", tag: "Custom Rose Trail",
    description: "A ninefold term packs more inner turns into the same orbit, so the floral ring feels denser and more finely braided.",
    formula: "x(t) = 50 + (7 cos t − 3s cos 9t) × 3.9\ny(t) = 50 + (7 sin t − 3s sin 9t) × 3.9",
    baseRadius: 7, detailAmplitude: 3, petalCount: 9, curveScale: 3.9,
    rotate: true, particleCount: 68, trailSpan: 0.39,
    durationMs: 4700, rotationDurationMs: 30000, pulseDurationMs: 4200, strokeWidth: 5.5,
    point(p, s, c: any) {
      const t = p * Math.PI * 2; const k = Math.round(c.petalCount);
      return {
        x: 50 + (c.baseRadius * Math.cos(t) - c.detailAmplitude * s * Math.cos(k * t)) * c.curveScale,
        y: 50 + (c.baseRadius * Math.sin(t) - c.detailAmplitude * s * Math.sin(k * t)) * c.curveScale,
      };
    },
  },
  // 4 ── Rose Orbit  (r = cos(kθ))
  {
    name: "Rose Orbit", tag: "r = cos(kθ)",
    description: "The radius expands and contracts with cos(7t), so the orbit breathes into repeated petals while staying anchored to a circle.",
    formula: "r(t) = 7 − 2.7s cos(7t)\nx(t) = 50 + cos t · r(t) · 3.9\ny(t) = 50 + sin t · r(t) · 3.9",
    orbitRadius: 7, detailAmplitude: 2.7, petalCount: 7, curveScale: 3.9,
    rotate: true, particleCount: 72, trailSpan: 0.42,
    durationMs: 5200, rotationDurationMs: 28000, pulseDurationMs: 4600, strokeWidth: 5.2,
    point(p, s, c: any) {
      const t = p * Math.PI * 2; const k = Math.round(c.petalCount);
      const r = c.orbitRadius - c.detailAmplitude * s * Math.cos(k * t);
      return { x: 50 + Math.cos(t) * r * c.curveScale, y: 50 + Math.sin(t) * r * c.curveScale };
    },
  },
  // 5 ── Rose Curve  (r = a cos(5θ))
  {
    name: "Rose Curve", tag: "r = a cos(kθ)",
    description: "Using r = a cos(5t) creates five evenly spaced lobes, and the breathing multiplier gently swells each petal in and out.",
    formula: "r(t) = (9.2 + 0.6s)(0.72 + 0.28s) cos(5t)\nx(t) = 50 + cos t · r(t) · 3.25\ny(t) = 50 + sin t · r(t) · 3.25",
    roseA: 9.2, roseABoost: 0.6, roseBreathBase: 0.72, roseBreathBoost: 0.28, roseK: 5, roseScale: 3.25,
    rotate: true, particleCount: 78, trailSpan: 0.32,
    durationMs: 5400, rotationDurationMs: 28000, pulseDurationMs: 4600, strokeWidth: 4.5,
    point(p, s, c: any) {
      const t = p * Math.PI * 2; const k = Math.round(c.roseK);
      const a = c.roseA + s * c.roseABoost;
      const r = a * (c.roseBreathBase + s * c.roseBreathBoost) * Math.cos(k * t);
      return { x: 50 + Math.cos(t) * r * c.roseScale, y: 50 + Math.sin(t) * r * c.roseScale };
    },
  },
  // 6 ── Rose Two  (r = a cos(2θ))
  {
    name: "Rose Two", tag: "r = a cos(2θ)",
    description: "With k = 2, the cosine radius forms broad opposing petals, and the breathing factor makes the center pulse like the original.",
    formula: "r(t) = (9.2 + 0.6s)(0.72 + 0.28s) cos(2t)\nx(t) = 50 + cos t · r(t) · 3.25",
    roseA: 9.2, roseABoost: 0.6, roseBreathBase: 0.72, roseBreathBoost: 0.28, roseScale: 3.25,
    rotate: true, particleCount: 74, trailSpan: 0.30,
    durationMs: 5200, rotationDurationMs: 28000, pulseDurationMs: 4300, strokeWidth: 4.6,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const a = c.roseA + s * c.roseABoost;
      const r = a * (c.roseBreathBase + s * c.roseBreathBoost) * Math.cos(2 * t);
      return { x: 50 + Math.cos(t) * r * c.roseScale, y: 50 + Math.sin(t) * r * c.roseScale };
    },
  },
  // 7 ── Rose Three  (r = a cos(3θ))
  {
    name: "Rose Three", tag: "r = a cos(3θ)",
    description: "With k = 3, the curve resolves into three rotating petals, and the inner breathing keeps the motion from feeling mathematically rigid.",
    formula: "r(t) = (9.2 + 0.6s)(0.72 + 0.28s) cos(3t)\nx(t) = 50 + cos t · r(t) · 3.25",
    roseA: 9.2, roseABoost: 0.6, roseBreathBase: 0.72, roseBreathBoost: 0.28, roseScale: 3.25,
    rotate: true, particleCount: 76, trailSpan: 0.31,
    durationMs: 5300, rotationDurationMs: 28000, pulseDurationMs: 4400, strokeWidth: 4.6,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const a = c.roseA + s * c.roseABoost;
      const r = a * (c.roseBreathBase + s * c.roseBreathBoost) * Math.cos(3 * t);
      return { x: 50 + Math.cos(t) * r * c.roseScale, y: 50 + Math.sin(t) * r * c.roseScale };
    },
  },
  // 8 ── Rose Four  (r = a cos(4θ))
  {
    name: "Rose Four", tag: "r = a cos(4θ)",
    description: "With k = 4, the petals settle into a balanced cross-like rose, and the breathing core adds the same soft pulse as the original loader.",
    formula: "r(t) = (9.2 + 0.6s)(0.72 + 0.28s) cos(4t)\nx(t) = 50 + cos t · r(t) · 3.25",
    roseA: 9.2, roseABoost: 0.6, roseBreathBase: 0.72, roseBreathBoost: 0.28, roseScale: 3.25,
    rotate: true, particleCount: 78, trailSpan: 0.32,
    durationMs: 5400, rotationDurationMs: 28000, pulseDurationMs: 4500, strokeWidth: 4.6,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const a = c.roseA + s * c.roseABoost;
      const r = a * (c.roseBreathBase + s * c.roseBreathBoost) * Math.cos(4 * t);
      return { x: 50 + Math.cos(t) * r * c.roseScale, y: 50 + Math.sin(t) * r * c.roseScale };
    },
  },
  // 9 ── Lissajous Drift
  {
    name: "Lissajous Drift", tag: "x = sin(at), y = sin(bt)",
    description: "Different sine frequencies on x and y make the path cross itself repeatedly, producing the woven feel of an oscilloscope trace.",
    formula: "A = 24 + 6s\nx(t) = 50 + sin(3t + 1.57) · A\ny(t) = 50 + sin(4t) · 0.92A",
    lissajousAmp: 24, lissajousAmpBoost: 6, lissajousAX: 3, lissajousBY: 4,
    lissajousPhase: 1.57, lissajousYScale: 0.92,
    rotate: false, particleCount: 68, trailSpan: 0.34,
    durationMs: 6000, rotationDurationMs: 36000, pulseDurationMs: 5400, strokeWidth: 4.7,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const amp = c.lissajousAmp + s * c.lissajousAmpBoost;
      return {
        x: 50 + Math.sin(Math.round(c.lissajousAX) * t + c.lissajousPhase) * amp,
        y: 50 + Math.sin(Math.round(c.lissajousBY) * t) * (amp * c.lissajousYScale),
      };
    },
  },
  // 10 ── Lemniscate Bloom  (Bernoulli ∞)
  {
    name: "Lemniscate Bloom", tag: "Bernoulli Lemniscate",
    description: "The 1 + sin²t denominator pinches the center while preserving two lobes, so the curve naturally reads as a breathing infinity sign.",
    formula: "a = 20 + 7s\nx(t) = 50 + a cos t / (1 + sin² t)\ny(t) = 50 + a sin t cos t / (1 + sin² t)",
    lemniscateA: 20, lemniscateBoost: 7,
    rotate: false, particleCount: 70, trailSpan: 0.40,
    durationMs: 5600, rotationDurationMs: 34000, pulseDurationMs: 5000, strokeWidth: 4.8,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const scale = c.lemniscateA + s * c.lemniscateBoost;
      const denom = 1 + Math.sin(t) ** 2;
      return { x: 50 + (scale * Math.cos(t)) / denom, y: 50 + (scale * Math.sin(t) * Math.cos(t)) / denom };
    },
  },
  // 11 ── Hypotrochoid Loop  (inner spirograph)
  {
    name: "Hypotrochoid Loop", tag: "Inner Spirograph",
    description: "The rolling-circle terms create nested turns and offsets, so the path feels like a compact spirograph traced by a machine.",
    formula: "x(t) = 50 + ((R−r) cos t + d cos((R−r)t/r)) · 3.05\ny(t) = 50 + ((R−r) sin t − d sin((R−r)t/r)) · 3.05\nR=8.2, r=2.7+0.45s, d=4.8+1.2s",
    spiroR: 8.2, spiror: 2.7, spirorBoost: 0.45, spirod: 4.8, spirodBoost: 1.2, spiroScale: 3.05,
    rotate: false, particleCount: 82, trailSpan: 0.46,
    durationMs: 7600, rotationDurationMs: 42000, pulseDurationMs: 6200, strokeWidth: 4.6,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const r = c.spiror + s * c.spirorBoost;
      const d = c.spirod + s * c.spirodBoost;
      const x = (c.spiroR - r) * Math.cos(t) + d * Math.cos(((c.spiroR - r) / r) * t);
      const y = (c.spiroR - r) * Math.sin(t) - d * Math.sin(((c.spiroR - r) / r) * t);
      return { x: 50 + x * c.spiroScale, y: 50 + y * c.spiroScale };
    },
  },
  // 12 ── Three-Petal Spiral  (R=3, r=1, d=3)
  {
    name: "Three-Petal Spiral", tag: "R = 3, r = 1, d = 3",
    description: "This rolling-circle setup resolves into three large looping petals, all breathing together like a compact spiral flower.",
    formula: "u(t) = ((R−r) cos t + d cos((R−r)t/r), …)\nm(t) = 2.2 + 0.45s\n(x, y) = 50 + u(t) · m(t)  R=3, r=1, d=3",
    spiralR: 3, spiralr: 1, spirald: 3, spiralScale: 2.2, spiralBreath: 0.45,
    rotate: true, particleCount: 82, trailSpan: 0.34,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 4.4,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const d = c.spirald + s * 0.25;
      const bx = (c.spiralR - c.spiralr) * Math.cos(t) + d * Math.cos(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const by = (c.spiralR - c.spiralr) * Math.sin(t) - d * Math.sin(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const sc = c.spiralScale + s * c.spiralBreath;
      return { x: 50 + bx * sc, y: 50 + by * sc };
    },
  },
  // 13 ── Four-Petal Spiral  (R=4)
  {
    name: "Four-Petal Spiral", tag: "R = 4, r = 1, d = 3",
    description: "With R = 4, the rolling-circle path settles into four looping petals, rotating and breathing as one ring.",
    formula: "u(t) = ((R−r) cos t + d cos((R−r)t/r), …)\nm(t) = 2.2 + 0.45s  R=4, r=1, d=3",
    spiralR: 4, spiralr: 1, spirald: 3, spiralScale: 2.2, spiralBreath: 0.45,
    rotate: true, particleCount: 84, trailSpan: 0.34,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 4.4,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const d = c.spirald + s * 0.25;
      const bx = (c.spiralR - c.spiralr) * Math.cos(t) + d * Math.cos(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const by = (c.spiralR - c.spiralr) * Math.sin(t) - d * Math.sin(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const sc = c.spiralScale + s * c.spiralBreath;
      return { x: 50 + bx * sc, y: 50 + by * sc };
    },
  },
  // 14 ── Five-Petal Spiral  (R=5)
  {
    name: "Five-Petal Spiral", tag: "R = 5, r = 1, d = 3",
    description: "With R = 5, the loop count increases to five petals, giving the spiral flower a denser and more ornate rhythm.",
    formula: "u(t) = ((R−r) cos t + d cos((R−r)t/r), …)\nm(t) = 2.2 + 0.45s  R=5, r=1, d=3",
    spiralR: 5, spiralr: 1, spirald: 3, spiralScale: 2.2, spiralBreath: 0.45,
    rotate: true, particleCount: 85, trailSpan: 0.34,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 4.4,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const d = c.spirald + s * 0.25;
      const bx = (c.spiralR - c.spiralr) * Math.cos(t) + d * Math.cos(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const by = (c.spiralR - c.spiralr) * Math.sin(t) - d * Math.sin(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const sc = c.spiralScale + s * c.spiralBreath;
      return { x: 50 + bx * sc, y: 50 + by * sc };
    },
  },
  // 15 ── Six-Petal Spiral  (R=6)
  {
    name: "Six-Petal Spiral", tag: "R = 6, r = 1, d = 3",
    description: "The rolling-circle path splits into six petals, and the whole ring breathes in one unified pulse like the original loader.",
    formula: "u(t) = ((R−r) cos t + d cos((R−r)t/r), …)\nm(t) = 2.2 + 0.45s  R=6, r=1, d=3",
    spiralR: 6, spiralr: 1, spirald: 3, spiralScale: 2.2, spiralBreath: 0.45,
    rotate: true, particleCount: 86, trailSpan: 0.34,
    durationMs: 4600, rotationDurationMs: 28000, pulseDurationMs: 4200, strokeWidth: 4.4,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const d = c.spirald + s * 0.25;
      const bx = (c.spiralR - c.spiralr) * Math.cos(t) + d * Math.cos(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const by = (c.spiralR - c.spiralr) * Math.sin(t) - d * Math.sin(((c.spiralR - c.spiralr) / c.spiralr) * t);
      const sc = c.spiralScale + s * c.spiralBreath;
      return { x: 50 + bx * sc, y: 50 + by * sc };
    },
  },
  // 16 ── Butterfly Phase
  {
    name: "Butterfly Phase", tag: "Butterfly Curve",
    description: "Exponential and high-frequency cosine terms stretch the wings unevenly, giving the path its unmistakably fluttering butterfly shape.",
    formula: "u = 12t\nB(u) = eᶜᵒˢ ᵘ − 2 cos 4u − sin⁵(u/12)\nx(t) = 50 + sin u · B(u) · (4.6 + 0.45s)",
    butterflyTurns: 12, butterflyScale: 4.6, butterflyPulse: 0.45,
    butterflyCosWeight: 2, butterflyPower: 5,
    rotate: false, particleCount: 88, trailSpan: 0.32,
    durationMs: 9000, rotationDurationMs: 50000, pulseDurationMs: 7000, strokeWidth: 4.4,
    point(p, s, c: any) {
      const t = p * Math.PI * c.butterflyTurns;
      const B = Math.exp(Math.cos(t)) - c.butterflyCosWeight * Math.cos(4 * t) - Math.sin(t / 12) ** Math.round(c.butterflyPower);
      const sc = c.butterflyScale + s * c.butterflyPulse;
      return { x: 50 + Math.sin(t) * B * sc, y: 50 + Math.cos(t) * B * sc };
    },
  },
  // 17 ── Cardioid Glow  (r = a(1 − cos t))
  {
    name: "Cardioid Glow", tag: "Cardioid",
    description: "Because r = a(1 − cos t) collapses to zero at one side and swells on the other, the curve reads like a soft pulsing heart wave.",
    formula: "a = 8.4 + 0.8s\nr(t) = a(1 − cos t)\nx(t) = 50 + cos t · r(t) · 2.15",
    cardioidA: 8.4, cardioidPulse: 0.8, cardioidScale: 2.15,
    rotate: false, particleCount: 72, trailSpan: 0.36,
    durationMs: 6200, rotationDurationMs: 36000, pulseDurationMs: 5200, strokeWidth: 4.9,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const a = c.cardioidA + s * c.cardioidPulse;
      const r = a * (1 - Math.cos(t));
      return { x: 50 + Math.cos(t) * r * c.cardioidScale, y: 50 + Math.sin(t) * r * c.cardioidScale };
    },
  },
  // 18 ── Cardioid Heart  (r = a(1 + cos t))
  {
    name: "Cardioid Heart", tag: "r = a(1 + cosθ)",
    description: "Starting from r = a(1 + cos t) and rotating the coordinates turns the textbook cardioid into a more legible upright heart.",
    formula: "a = 8.8 + 0.8s\nr(t) = a(1 + cos t)\nx′(t) = −sin t · r(t)\ny′(t) = −cos t · r(t)",
    cardioidA: 8.8, cardioidPulse: 0.8, cardioidScale: 2.15,
    rotate: false, particleCount: 74, trailSpan: 0.36,
    durationMs: 6200, rotationDurationMs: 36000, pulseDurationMs: 5200, strokeWidth: 4.9,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const a = c.cardioidA + s * c.cardioidPulse;
      const r = a * (1 + Math.cos(t));
      return { x: 50 - Math.sin(t) * r * c.cardioidScale, y: 50 - Math.cos(t) * r * c.cardioidScale };
    },
  },
  // 19 ── Heart Wave  (f(x) algebraic heart)
  {
    name: "Heart Wave", tag: "f(x) Heart Wave",
    description: "The x^(2/3) envelope supplies the heart outline, while sin(bπx) fills its interior with adjustable horizontal ripples.",
    formula: "f(x) = |x|^(2/3) + 0.9√(3.3 − x²) sin(6.4πx)\nscreenY = 18 + (1.75 − f(x))(24.5 + 1.5s)",
    heartWaveB: 6.4, heartWaveRoot: 3.3, heartWaveAmp: 0.9,
    heartWaveScaleX: 23.2, heartWaveScaleY: 24.5,
    rotate: false, particleCount: 104, trailSpan: 0.18,
    durationMs: 8400, rotationDurationMs: 22000, pulseDurationMs: 5600, strokeWidth: 3.9,
    point(p, s, c: any) {
      const xLimit = Math.sqrt(c.heartWaveRoot);
      const x = -xLimit + p * xLimit * 2;
      const safeRoot = Math.max(0, c.heartWaveRoot - x * x);
      const wave = c.heartWaveAmp * Math.sqrt(safeRoot) * Math.sin(c.heartWaveB * Math.PI * x);
      const y = Math.pow(Math.abs(x), 2 / 3) + wave;
      return { x: 50 + x * c.heartWaveScaleX, y: 18 + (1.75 - y) * (c.heartWaveScaleY + s * 1.5) };
    },
  },
  // 20 ── Spiral Search  (Archimedean spiral)
  {
    name: "Spiral Search", tag: "Archimedean Spiral",
    description: "A fast-growing angle combined with a cosine-modulated radius creates a spiral that opens out and closes cleanly back into itself.",
    formula: "θ(t) = 4t\nr(t) = 8 + (1 − cos t)(8.5 + 2.4s)\nx(t) = 50 + cos θ · r(t)",
    searchTurns: 4, searchBaseRadius: 8, searchRadiusAmp: 8.5, searchPulse: 2.4, searchScale: 1,
    rotate: false, particleCount: 86, trailSpan: 0.28,
    durationMs: 7800, rotationDurationMs: 44000, pulseDurationMs: 6800, strokeWidth: 4.3,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const angle = t * c.searchTurns;
      const radius = c.searchBaseRadius + (1 - Math.cos(t)) * (c.searchRadiusAmp + s * c.searchPulse);
      return { x: 50 + Math.cos(angle) * radius * c.searchScale, y: 50 + Math.sin(angle) * radius * c.searchScale };
    },
  },
  // 21 ── Fourier Flow
  {
    name: "Fourier Flow", tag: "Fourier Curve",
    description: "Several sine and cosine components interfere with one another, so the shape keeps mutating like a living waveform.",
    formula: "x(t) = 50 + 17 cos t + 7.5 cos(3t + 0.6m) + 3.2 sin(5t − 0.4)\ny(t) = 50 + 15 sin t + 8.2 sin(2t + 0.25) − 4.2 cos(4t − 0.5m)\nm = 1 + 0.16s",
    fourierX1: 17, fourierX3: 7.5, fourierX5: 3.2,
    fourierY1: 15, fourierY2: 8.2, fourierY4: 4.2,
    fourierMixBase: 1, fourierMixPulse: 0.16,
    rotate: false, particleCount: 92, trailSpan: 0.31,
    durationMs: 8400, rotationDurationMs: 44000, pulseDurationMs: 6800, strokeWidth: 4.2,
    point(p, s, c: any) {
      const t = p * Math.PI * 2;
      const mix = c.fourierMixBase + s * c.fourierMixPulse;
      const x = c.fourierX1 * Math.cos(t) + c.fourierX3 * Math.cos(3 * t + 0.6 * mix) + c.fourierX5 * Math.sin(5 * t - 0.4);
      const y = c.fourierY1 * Math.sin(t) + c.fourierY2 * Math.sin(2 * t + 0.25) - c.fourierY4 * Math.cos(4 * t - 0.5 * mix);
      return { x: 50 + x, y: 50 + y };
    },
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a randomly-chosen mathematical curve animation while content is loading.
 * Pass `visible={isLoading}` and mount as a sibling overlay (e.g. over boneyard Skeleton).
 * Visual: curve only, centered. Positioning: fixed, above the mobile tab bar.
 */
export function MathCurveLoader({ visible }: { visible: boolean }) {
  // Random curve only after mount — avoids SSR/client hydration text mismatch
  const [curveIdx, setCurveIdx] = useState<number | null>(null);
  const curve = curveIdx !== null ? CURVES[curveIdx]! : null;

  useEffect(() => {
    if (!visible) {
      setCurveIdx(null);
      return;
    }
    setCurveIdx(Math.floor(Math.random() * CURVES.length));
  }, [visible]);

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const circlesRef = useRef<SVGCircleElement[]>([]);
  const rafRef = useRef<number>(0);

  // Create circles imperatively (avoids re-render on every frame)
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !curve) return;

    const NS = "http://www.w3.org/2000/svg";

    // Remove old circles
    circlesRef.current.forEach((el) => el.remove());
    circlesRef.current = [];

    for (let i = 0; i < curve.particleCount; i++) {
      const c = document.createElementNS(NS, "circle");
      /* App accent (terracotta light / warm orange dark) from globals.css */
      c.setAttribute("fill", "var(--accent)");
      group.appendChild(c);
      circlesRef.current.push(c);
    }

    return () => {
      circlesRef.current.forEach((el) => el.remove());
      circlesRef.current = [];
    };
  }, [curve]);

  // Animation loop — only runs while visible
  useEffect(() => {
    if (!visible || !curve) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const phase = Math.random();
    const start = performance.now();

    const frame = (now: number) => {
      const time = now - start;
      const ds = getDs(time, curve, phase);
      const rot = getRot(time, curve, phase);
      const progress = (time % curve.durationMs) / curve.durationMs;

      if (pathRef.current) {
        pathRef.current.setAttribute("d", makePathD(curve, ds));
      }
      if (groupRef.current && curve.rotate) {
        groupRef.current.setAttribute("transform", `rotate(${rot.toFixed(2)}, 50, 50)`);
      }

      const circles = circlesRef.current;
      for (let i = 0; i < curve.particleCount; i++) {
        const el = circles[i];
        if (!el) continue;
        const tailOffset = i / (curve.particleCount - 1);
        const pt = curve.point(normP(progress - tailOffset * curve.trailSpan), ds, curve);
        const fade = Math.pow(1 - tailOffset, 0.56);
        el.setAttribute("cx", pt.x.toFixed(2));
        el.setAttribute("cy", pt.y.toFixed(2));
        el.setAttribute("r", (0.9 + fade * 2.7).toFixed(2));
        el.setAttribute("opacity", (0.04 + fade * 0.96).toFixed(3));
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, curve]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[34] flex flex-col items-center justify-center backdrop-blur-[3px]"
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
        /* Follows :root / :root.dark from globals.css (same as html class from ThemeProvider + layout script). */
        backgroundColor: "color-mix(in srgb, var(--background) 92%, transparent)",
      }}
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
      {curve ? (
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="h-32 w-32 overflow-visible"
          fill="none"
          aria-hidden="true"
        >
          <g ref={groupRef}>
            <path
              ref={pathRef}
              stroke="var(--accent)"
              strokeWidth={curve.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.14}
            />
          </g>
        </svg>
      ) : (
        <div className="h-32 w-32 shrink-0" aria-hidden />
      )}
    </div>
  );
}
