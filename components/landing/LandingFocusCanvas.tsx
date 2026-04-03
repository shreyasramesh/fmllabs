"use client";

import React, { useState, useCallback } from "react";

import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
} from "@/components/landing/types";

function clampRatio(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function circleCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

function degToRad(deg: number): number {
  return (deg - 90) * (Math.PI / 180);
}

function pointOnCircle(cx: number, cy: number, r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface LandingFocusCanvasProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  nutritionLabel: string;
  carbsLabel: string;
  proteinLabel: string;
  foodLoggedLabel: string;
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  onOpenNutrition: () => void;
}

export function LandingFocusCanvas({
  eyebrow,
  title,
  subtitle,
  nutritionLabel,
  carbsLabel,
  proteinLabel,
  foodLoggedLabel,
  nutrition,
  nutritionGoals,
  onOpenNutrition,
}: LandingFocusCanvasProps) {
  const caloriesRatio = clampRatio(
    nutritionGoals.caloriesTarget - nutrition.caloriesRemaining,
    nutritionGoals.caloriesTarget
  );
  const carbsRatio = clampRatio(nutrition.carbsGrams, nutritionGoals.carbsGrams);
  const proteinRatio = clampRatio(nutrition.proteinGrams, nutritionGoals.proteinGrams);
  const fatRatio = clampRatio(nutrition.fatGrams, nutritionGoals.fatGrams);
  const caloriesConsumed = Math.max(0, nutritionGoals.caloriesTarget - nutrition.caloriesRemaining);

  const carbsCalories = nutrition.carbsGrams * 4;
  const proteinCalories = nutrition.proteinGrams * 4;
  const fatCalories = nutrition.fatGrams * 9;
  const calTarget = Math.max(1, nutritionGoals.caloriesTarget);
  const rawSegments = [
    { key: "cal-carbs", cal: carbsCalories, gradientStart: "#D49A42", gradientEnd: "#F2D28A", glow: "rgba(212,154,66,0.35)" },
    { key: "cal-protein", cal: proteinCalories, gradientStart: "#5A9E8A", gradientEnd: "#A6D4C4", glow: "rgba(90,158,138,0.35)" },
    { key: "cal-fat", cal: fatCalories, gradientStart: "#C4705E", gradientEnd: "#E8AFA0", glow: "rgba(196,112,94,0.30)" },
  ];
  const rawTotal = rawSegments.reduce((s, seg) => s + seg.cal, 0);
  const scaleFactor = rawTotal > calTarget ? calTarget / rawTotal : 1;
  const calorieSegments = rawSegments.map((seg) => ({
    ...seg,
    ratio: Math.max(0, Math.min(1, (seg.cal / calTarget) * scaleFactor)),
  }));

  const CAL_RING_RADIUS = 140;
  const CAL_RING_STROKE = 20;
  const CAL_RING_TRACK = "rgba(220, 210, 198, 0.5)";

  const ringMetrics = [
    {
      key: "protein",
      radius: 112,
      strokeWidth: 16,
      ratio: proteinRatio,
      gradientStart: "#5A9E8A",
      gradientEnd: "#A6D4C4",
      glow: "rgba(90,158,138,0.35)",
      track: "rgba(228, 218, 206, 0.4)",
      rotation: -90,
      label: proteinLabel,
      displayValue: `${nutrition.proteinGrams}`,
      displayUnit: `/ ${nutritionGoals.proteinGrams}g`,
      labelAngle: 135,
      fontSize: 10,
    },
    {
      key: "carbs",
      radius: 86,
      strokeWidth: 14,
      ratio: carbsRatio,
      gradientStart: "#D49A42",
      gradientEnd: "#F2D28A",
      glow: "rgba(212,154,66,0.35)",
      track: "rgba(230, 220, 208, 0.38)",
      rotation: -90,
      label: carbsLabel,
      displayValue: `${nutrition.carbsGrams}`,
      displayUnit: `/ ${nutritionGoals.carbsGrams}g`,
      labelAngle: 225,
      fontSize: 9.5,
    },
    {
      key: "fat",
      radius: 62,
      strokeWidth: 12,
      ratio: fatRatio,
      gradientStart: "#C4705E",
      gradientEnd: "#E8AFA0",
      glow: "rgba(196,112,94,0.30)",
      track: "rgba(232, 222, 210, 0.35)",
      rotation: -90,
      label: "Fat",
      displayValue: `${nutrition.fatGrams}`,
      displayUnit: `/ ${nutritionGoals.fatGrams}g`,
      labelAngle: 315,
      fontSize: 9,
    },
  ] as const;

  const [activeRing, setActiveRing] = useState<string | null>(null);
  const handleRingClick = useCallback((key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveRing((prev) => (prev === key ? null : key));
  }, []);
  const handleBackgroundClick = useCallback(() => {
    setActiveRing(null);
  }, []);

  return (
    <section className="w-full overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/50 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04] sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="relative rounded-[2.2rem] border border-[#ECD9C8] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.96)_58%,rgba(255,244,236,0.92)_100%)] px-4 py-6 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800 sm:px-6">
          <div className="mx-auto flex max-w-[64rem] items-center justify-center">
            <div className="min-w-0 flex-1">
              <div className="mx-auto flex max-w-[30rem] flex-col items-center">
                <div className="relative flex aspect-square w-full max-w-[18rem] items-center justify-center overflow-hidden sm:max-w-[24rem]">
                  <svg
                    viewBox="0 0 320 320"
                    className="absolute inset-0 h-full w-full"
                    aria-hidden
                    onClick={handleBackgroundClick}
                  >
                    <rect x="0" y="0" width="320" height="320" fill="transparent" />
                    <defs>
                      {calorieSegments.map((seg) => (
                        <React.Fragment key={`defs-${seg.key}`}>
                          <linearGradient id={`grad-${seg.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={seg.gradientStart} />
                            <stop offset="100%" stopColor={seg.gradientEnd} />
                          </linearGradient>
                          <filter id={`glow-${seg.key}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                            <feFlood floodColor={seg.glow} result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="shadow" />
                            <feMerge>
                              <feMergeNode in="shadow" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </React.Fragment>
                      ))}
                      {ringMetrics.map((ring) => (
                        <React.Fragment key={`defs-${ring.key}`}>
                          <linearGradient id={`grad-${ring.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={ring.gradientStart} />
                            <stop offset="100%" stopColor={ring.gradientEnd} />
                          </linearGradient>
                          <filter id={`glow-${ring.key}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                            <feFlood floodColor={ring.glow} result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="shadow" />
                            <feMerge>
                              <feMergeNode in="shadow" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </React.Fragment>
                      ))}
                    </defs>

                    {/* Outer calories ring — stacked macro segments */}
                    <g style={{ cursor: "pointer" }} onClick={(e) => handleRingClick("calories", e)}>
                      <circle cx="160" cy="160" r={CAL_RING_RADIUS} fill="none" stroke="transparent" strokeWidth={CAL_RING_STROKE + 10} />
                      <circle
                        cx="160" cy="160" r={CAL_RING_RADIUS} fill="none"
                        stroke={CAL_RING_TRACK} strokeWidth={CAL_RING_STROKE}
                        opacity={activeRing && activeRing !== "calories" ? 0.35 : 1}
                      />
                      {(() => {
                        const circumference = circleCircumference(CAL_RING_RADIUS);
                        const isActive = activeRing === "calories";
                        let cumulativeAngle = -90;
                        return calorieSegments.map((seg) => {
                          const startAngle = cumulativeAngle;
                          cumulativeAngle += seg.ratio * 360;
                          if (seg.ratio <= 0) return null;
                          return (
                            <circle
                              key={seg.key}
                              cx="160" cy="160" r={CAL_RING_RADIUS} fill="none"
                              stroke={`url(#grad-${seg.key})`}
                              strokeWidth={isActive ? CAL_RING_STROKE + 4 : CAL_RING_STROKE}
                              strokeLinecap="butt"
                              strokeDasharray={circumference}
                              strokeDashoffset={circumference * (1 - seg.ratio)}
                              transform={`rotate(${startAngle} 160 160)`}
                              filter={`url(#glow-${seg.key})`}
                              opacity={activeRing && !isActive ? 0.4 : 1}
                              style={{ transition: "stroke-width 0.2s ease, opacity 0.2s ease" }}
                            />
                          );
                        });
                      })()}
                      {activeRing === "calories" && (() => {
                        const labelPos = pointOnCircle(160, 160, CAL_RING_RADIUS, 45);
                        return (
                          <g>
                            <rect x={labelPos.x - 42} y={labelPos.y - 22} width="84" height="44" rx="12" fill="white" fillOpacity="0.96" stroke="#C4A882" strokeWidth="1.2" strokeOpacity="0.5" />
                            <text x={labelPos.x} y={labelPos.y - 4} textAnchor="middle" dominantBaseline="auto" fill="#6B5640" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">
                              {caloriesConsumed}
                            </text>
                            <text x={labelPos.x} y={labelPos.y + 14} textAnchor="middle" dominantBaseline="auto" fill="rgba(120,100,80,0.7)" fontSize="10" fontWeight="500" fontFamily="system-ui, sans-serif">
                              / {nutritionGoals.caloriesTarget} kcal
                            </text>
                          </g>
                        );
                      })()}
                    </g>

                    {/* Inner rings — protein, carbs, fat grams */}
                    {ringMetrics.map((ring) => {
                      const circumference = circleCircumference(ring.radius);
                      const isActive = activeRing === ring.key;
                      const labelPos = pointOnCircle(160, 160, ring.radius, ring.labelAngle);
                      return (
                        <g key={ring.key} style={{ cursor: "pointer" }} onClick={(e) => handleRingClick(ring.key, e)}>
                          <circle cx="160" cy="160" r={ring.radius} fill="none" stroke="transparent" strokeWidth={ring.strokeWidth + 10} />
                          <circle
                            cx="160" cy="160" r={ring.radius} fill="none"
                            stroke={ring.track} strokeWidth={ring.strokeWidth}
                            opacity={activeRing && !isActive ? 0.35 : 1}
                          />
                          <circle
                            cx="160" cy="160" r={ring.radius} fill="none"
                            stroke={`url(#grad-${ring.key})`}
                            strokeWidth={isActive ? ring.strokeWidth + 4 : ring.strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - ring.ratio)}
                            transform={`rotate(${ring.rotation} 160 160)`}
                            filter={`url(#glow-${ring.key})`}
                            opacity={activeRing && !isActive ? 0.4 : 1}
                            style={{ transition: "stroke-width 0.2s ease, opacity 0.2s ease" }}
                          />
                          {isActive && (
                            <g>
                              <rect x={labelPos.x - 42} y={labelPos.y - 22} width="84" height="44" rx="12" fill="white" fillOpacity="0.96" stroke={ring.gradientStart} strokeWidth="1.2" strokeOpacity="0.5" />
                              <text x={labelPos.x} y={labelPos.y - 4} textAnchor="middle" dominantBaseline="auto" fill={ring.gradientStart} fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif">
                                {ring.displayValue}
                              </text>
                              <text x={labelPos.x} y={labelPos.y + 13} textAnchor="middle" dominantBaseline="auto" fill="rgba(120,100,80,0.7)" fontSize="10" fontWeight="500" fontFamily="system-ui, sans-serif">
                                {ring.label} {ring.displayUnit}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Center legend inside innermost ring */}
                    {[
                      { label: "Calories", color: "#9A8872" },
                      { label: proteinLabel, color: "#5A9E8A" },
                      { label: carbsLabel, color: "#D49A42" },
                      { label: "Fat", color: "#C4705E" },
                    ].map((item, i) => {
                      const rowY = 138 + i * 15;
                      return (
                        <g key={item.label}>
                          <circle cx="139" cy={rowY} r="3.5" fill={item.color} />
                          <text x="147" y={rowY} dominantBaseline="central" fill={item.color} fontSize="9.5" fontWeight="600" fontFamily="system-ui, sans-serif" opacity="0.85">
                            {item.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <button
                  type="button"
                  onClick={onOpenNutrition}
                  className="mt-4 flex flex-col items-center gap-1.5 text-center transition-opacity hover:opacity-80"
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{caloriesConsumed}</span>
                    <span className="text-sm text-neutral-400 dark:text-neutral-500">/ {nutritionGoals.caloriesTarget}</span>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">kcal</span>

                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#5A9E8A" }} />
                      <span className="text-[11px] font-semibold text-foreground">{nutrition.proteinGrams}g</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">P</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#D49A42" }} />
                      <span className="text-[11px] font-semibold text-foreground">{nutrition.carbsGrams}g</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">C</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#C4705E" }} />
                      <span className="text-[11px] font-semibold text-foreground">{nutrition.fatGrams}g</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">F</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
