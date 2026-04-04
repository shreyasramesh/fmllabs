"use client";

import React from "react";

import type {
  LandingNutritionGoals,
  LandingNutritionSummary,
} from "@/components/landing/types";

function clampPct(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function rawPct(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, (current / target) * 100);
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

const MACROS = [
  { key: "calories", color: "#9A8872", overColor: "#6B5A46", trackColor: "rgba(154,136,114,0.15)" },
  { key: "protein", color: "#5A9E8A", overColor: "#3B6E5E", trackColor: "rgba(90,158,138,0.15)" },
  { key: "carbs", color: "#D49A42", overColor: "#A0712A", trackColor: "rgba(212,154,66,0.15)" },
  { key: "fat", color: "#C4705E", overColor: "#8E4438", trackColor: "rgba(196,112,94,0.15)" },
] as const;

function MacroIcon({ macroKey, color }: { macroKey: string; color: string }) {
  switch (macroKey) {
    case "calories":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={color} className="w-4 h-4 shrink-0">
          <path d="M12 23c-3.866 0-7-3.358-7-7.5 0-3.072 2.456-6.727 4.535-9.067A1.5 1.5 0 0 1 12 6.5c0 1-.5 2-1.5 3 2-1.5 3.5-4 4-6.5a1 1 0 0 1 1.735-.5C18.538 5.262 19 8.986 19 11.5c0 2.073-.493 4.14-1.692 5.69C15.87 19.195 14.085 21 12 23Zm0-5a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1-3-2.5-4-1.5 1-2.5 2.5-2.5 4A2.5 2.5 0 0 0 12 18Z" />
        </svg>
      );
    case "protein":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M12 2c-3 0-5.5 4.5-5.5 9.5S8.5 22 12 22s5.5-5.5 5.5-10.5S15 2 12 2Z" />
        </svg>
      );
    case "carbs":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M2 22 16 8" />
          <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
          <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
          <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
          <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
        </svg>
      );
    case "fat":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15.5v.01" />
          <path d="M12 12v.01" />
          <path d="M11 17v.01" />
          <path d="M7 14v.01" />
        </svg>
      );
    default:
      return null;
  }
}

export function LandingFocusCanvas({
  eyebrow,
  title,
  subtitle,
  nutritionLabel: _nutritionLabel,
  carbsLabel,
  proteinLabel,
  foodLoggedLabel: _foodLoggedLabel,
  nutrition,
  nutritionGoals,
  onOpenNutrition,
}: LandingFocusCanvasProps) {
  const caloriesConsumed = nutrition.caloriesFood;

  function makebar(
    key: string, label: string, current: number, target: number, unit: string,
    macro: { color: string; overColor: string; trackColor: string },
  ) {
    const raw = rawPct(current, target);
    const over = raw > 100;
    const cappedRaw = Math.min(raw, 200);
    return {
      key, label, current, target, unit,
      color: macro.color,
      overColor: macro.overColor,
      trackColor: macro.trackColor,
      fillPct: over ? 100 : Math.min(raw, 100),
      targetMarkerPct: over ? (100 / cappedRaw) * 100 : 0,
      overflow: over,
    };
  }

  const bars: {
    key: string;
    label: string;
    current: number;
    target: number;
    unit: string;
    color: string;
    overColor: string;
    trackColor: string;
    fillPct: number;
    targetMarkerPct: number;
    overflow: boolean;
  }[] = [
    makebar("calories", "Calories", caloriesConsumed, nutritionGoals.caloriesTarget, "kcal", MACROS[0]),
    makebar("protein", proteinLabel, nutrition.proteinGrams, nutritionGoals.proteinGrams, "g", MACROS[1]),
    makebar("carbs", carbsLabel, nutrition.carbsGrams, nutritionGoals.carbsGrams, "g", MACROS[2]),
    makebar("fat", "Fat", nutrition.fatGrams, nutritionGoals.fatGrams, "g", MACROS[3]),
  ];

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

        <button
          type="button"
          onClick={onOpenNutrition}
          className="relative rounded-[2.2rem] border border-[#ECD9C8] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,247,238,0.96)_58%,rgba(255,244,236,0.92)_100%)] px-4 py-5 text-left transition-opacity hover:opacity-90 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800 sm:px-6"
        >
          <div className="mx-auto max-w-[32rem] space-y-4">
            {bars.map((bar) => (
              <div key={bar.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5">
                    <MacroIcon macroKey={bar.key} color={bar.color} />
                    <span className="text-xs font-semibold text-foreground">
                      {bar.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: bar.overflow ? bar.overColor : bar.color }}
                    >
                      {bar.current}
                    </span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      / {bar.target} {bar.unit}
                    </span>
                  </div>
                </div>

                <div
                  className="relative h-3 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: bar.trackColor }}
                >
                  {!bar.overflow ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${bar.fillPct}%`,
                        backgroundColor: bar.color,
                        boxShadow: bar.fillPct > 0 ? `0 0 8px ${bar.color}40` : undefined,
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${bar.targetMarkerPct}%`,
                          backgroundColor: bar.color,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 rounded-r-full transition-[width] duration-500 ease-out"
                        style={{
                          left: `${bar.targetMarkerPct}%`,
                          width: `${100 - bar.targetMarkerPct}%`,
                          backgroundColor: bar.overColor,
                          boxShadow: `0 0 8px ${bar.overColor}40`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 w-[2px] -translate-x-[1px]"
                        style={{
                          left: `${bar.targetMarkerPct}%`,
                          backgroundColor: "rgba(255,255,255,0.7)",
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </button>
      </div>
    </section>
  );
}
