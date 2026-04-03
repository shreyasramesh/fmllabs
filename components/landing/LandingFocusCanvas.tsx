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

  const ringMetrics = [
    {
      key: "calories",
      radius: 140,
      strokeWidth: 20,
      ratio: caloriesRatio,
      gradientStart: "#5BA3D9",
      gradientEnd: "#A8D4F5",
      glow: "rgba(91,163,217,0.45)",
      track: "rgba(220, 210, 198, 0.5)",
      rotation: -90,
      label: nutritionLabel,
      displayValue: `${caloriesConsumed}`,
      displayUnit: `/ ${nutritionGoals.caloriesTarget}`,
      labelAngle: 45,
      fontSize: 11,
    },
    {
      key: "protein",
      radius: 112,
      strokeWidth: 16,
      ratio: proteinRatio,
      gradientStart: "#9B5FD6",
      gradientEnd: "#D4B0F5",
      glow: "rgba(155,95,214,0.38)",
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
      gradientStart: "#E5A030",
      gradientEnd: "#F5D78A",
      glow: "rgba(229,160,48,0.35)",
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
      gradientStart: "#D96050",
      gradientEnd: "#F5A898",
      glow: "rgba(217,96,80,0.32)",
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
  const handleRingClick = useCallback((key: string) => {
    setActiveRing((prev) => (prev === key ? null : key));
  }, []);

  return (
    <section className="w-full overflow-hidden rounded-[2.2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.09)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {title}
          </h2>
          <p className="max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
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
                  >
                    <defs>
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
                    {ringMetrics.map((ring) => {
                      const circumference = circleCircumference(ring.radius);
                      const isActive = activeRing === ring.key;
                      const labelPos = pointOnCircle(160, 160, ring.radius, ring.labelAngle);
                      return (
                        <g key={ring.key} style={{ cursor: "pointer" }} onClick={() => handleRingClick(ring.key)}>
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={ring.strokeWidth + 10}
                          />
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
                            stroke={ring.track}
                            strokeWidth={ring.strokeWidth}
                            opacity={activeRing && !isActive ? 0.35 : 1}
                          />
                          <circle
                            cx="160"
                            cy="160"
                            r={ring.radius}
                            fill="none"
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
                              <rect
                                x={labelPos.x - 28}
                                y={labelPos.y - 16}
                                width="56"
                                height="32"
                                rx="10"
                                fill="white"
                                fillOpacity="0.95"
                                stroke={ring.gradientStart}
                                strokeWidth="1.4"
                                strokeOpacity="0.55"
                              />
                              <text
                                x={labelPos.x}
                                y={labelPos.y - 3}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fill={ring.gradientStart}
                                fontSize={ring.fontSize + 1}
                                fontWeight="700"
                                fontFamily="system-ui, sans-serif"
                              >
                                {ring.displayValue}
                              </text>
                              <text
                                x={labelPos.x}
                                y={labelPos.y + ring.fontSize}
                                textAnchor="middle"
                                dominantBaseline="auto"
                                fill="rgba(120,110,100,0.75)"
                                fontSize={ring.fontSize * 0.72}
                                fontWeight="500"
                                fontFamily="system-ui, sans-serif"
                              >
                                {ring.label} {ring.displayUnit}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <div className="absolute inset-[30%] rounded-full border border-[#EADFD3]/60 bg-[radial-gradient(circle,rgba(255,250,240,0.97),rgba(255,245,228,0.94)_70%,rgba(255,240,218,0.88)_100%)] shadow-[inset_0_0_30px_rgba(255,230,190,0.3)] dark:border-neutral-700/50 dark:bg-none dark:bg-neutral-800 dark:shadow-none sm:inset-[35%]" />

                  <button
                    type="button"
                    onClick={onOpenNutrition}
                    className="relative z-10 flex flex-col items-center gap-1.5 text-center transition-opacity hover:opacity-80"
                  >
                    <div className="flex items-baseline gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#5BA3D9" className="h-3.5 w-3.5 self-center shrink-0" aria-hidden>
                        <path d="M12.556 3.252c-.155-.07-.326-.07-.48 0a12.764 12.764 0 0 0-4.1 3.26C6.32 8.39 5 10.76 5 13.5a5 5 0 0 0 10 0c0-2.74-1.32-5.11-2.976-6.988a12.764 12.764 0 0 0-1.468-1.26Zm-2.433 6.212a.75.75 0 0 1 1.354 0l.04.088c.427.93.713 1.636.713 2.448a1.98 1.98 0 1 1-3.96 0c0-.812.286-1.518.713-2.448l.04-.088a.755.755 0 0 1 1.1 0Z"/>
                      </svg>
                      <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{caloriesConsumed}</span>
                      <span className="text-sm text-neutral-400 dark:text-neutral-500">/ {nutritionGoals.caloriesTarget}</span>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">kcal</span>

                    <div className="mt-1 flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#9B5FD6" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.proteinGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">P</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#E5A030" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.carbsGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">C</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#D96050" }} />
                        <span className="text-[11px] font-semibold text-foreground">{nutrition.fatGrams}g</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">F</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Macro & calorie cards */}
                <div className="mt-4 flex w-full max-w-[34rem] flex-wrap justify-center gap-2">
                  {([
                    { label: "Calories", value: caloriesConsumed, target: nutritionGoals.caloriesTarget, unit: "", color: "#5BA3D9" },
                    { label: proteinLabel, value: nutrition.proteinGrams, target: nutritionGoals.proteinGrams, unit: "g", color: "#9B5FD6" },
                    { label: carbsLabel, value: nutrition.carbsGrams, target: nutritionGoals.carbsGrams, unit: "g", color: "#E5A030" },
                    { label: "Fat", value: nutrition.fatGrams, target: nutritionGoals.fatGrams, unit: "g", color: "#D96050" },
                    { label: "Exercise", value: nutrition.caloriesExercise, target: null, unit: "", color: "#4DA065" },
                    { label: foodLoggedLabel, value: nutrition.caloriesFood, target: null, unit: "", color: "#B87B51" },
                  ]).map((card) => (
                    <div
                      key={card.label}
                      className="flex min-w-[5.5rem] flex-1 flex-col items-center rounded-2xl border border-neutral-200/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <span className="mb-1 h-1.5 w-6 rounded-full" style={{ backgroundColor: card.color, opacity: 0.6 }} />
                      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {card.label}
                      </p>
                      <div className="mt-1 flex items-baseline gap-0.5">
                        <span className="text-xl font-bold text-foreground">{card.value}</span>
                        {card.target != null && (
                          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                            /{card.target}{card.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
