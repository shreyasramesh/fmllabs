"use client";

import React from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useTheme } from "@/components/ThemeProvider";
import { GoalConfigPill } from "@/components/landing/GoalConfigPill";
import type { LandingWeightPoint } from "@/components/landing/types";

interface LandingMobileWeightTabProps {
  weightCurrentKg: number | null;
  weightTargetKg: number | null;
  weightEntryCount: number;
  weightWeekPoints: LandingWeightPoint[];
  weightTitle: string;
  weightDescription: string;
  currentWeightLabel: string;
  targetWeightLabel: string;
  noTargetYetLabel: string;
  openLabel: string;
  onOpenWeight: () => void;
  onOpenGoals: () => void;
}

const WeightChart = React.memo(function WeightChart({
  points,
  targetKg,
}: {
  points: LandingWeightPoint[];
  targetKg: number | null;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const options = React.useMemo<Highcharts.Options>(() => {
    if (points.length < 2) return {};
    const weights = points.map((p) => p.weightKg);
    const categories = points.map((p) => p.dateLabel);
    const first = weights[0]!;
    const last = weights[weights.length - 1]!;
    const lineColor = last < first ? "#16a34a" : last > first ? "#dc2626" : "#2563eb";

    const yMin = Math.min(...weights, ...(targetKg != null ? [targetKg] : []));
    const yMax = Math.max(...weights, ...(targetKg != null ? [targetKg] : []));
    const padding = Math.max(0.5, (yMax - yMin) * 0.15);

    const muted = isDark ? "#9ca3af" : "#a3a3a3";
    const grid = isDark ? "rgba(255,255,255,0.12)" : "#f0f0f0";
    const axisLine = isDark ? "#4b5563" : "#e5e5e5";
    const dataLabelOutline = isDark ? "1px rgba(0,0,0,0.75)" : "none";
    const markerRing = isDark ? "rgba(255,255,255,0.92)" : "#fff";

    const plotLines: Highcharts.YAxisPlotLinesOptions[] =
      targetKg != null
        ? [
            {
              value: targetKg,
              color: "#16a34a",
              width: 2,
              dashStyle: "Dash",
              zIndex: 3,
              label: {
                text: `Target: ${targetKg} kg`,
                align: "left",
                verticalAlign: "bottom",
                style: { color: "#4ade80", fontSize: "9px", fontWeight: "600" },
                x: 2,
                y: -3,
              },
            },
          ]
        : [];

    return {
      chart: {
        backgroundColor: "transparent",
        height: 180,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [8, 8, 4, 8],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { enabled: false },
      xAxis: {
        categories,
        lineColor: axisLine,
        tickColor: "transparent",
        labels: { style: { color: muted, fontSize: "10px" } },
      },
      yAxis: {
        title: { text: "kg", style: { color: muted, fontSize: "10px" } },
        labels: { style: { color: muted, fontSize: "10px" } },
        min: yMin - padding,
        max: yMax + padding,
        gridLineColor: grid,
        plotLines,
      },
      tooltip: { enabled: false },
      plotOptions: {
        spline: {
          lineWidth: 2.5,
          states: { hover: { lineWidthPlus: 1 } },
        },
      },
      series: [
        {
          type: "spline",
          name: "Weight",
          data: weights,
          color: lineColor,
          marker: {
            enabled: true,
            symbol: "circle",
            radius: 4.5,
            fillColor: lineColor,
            lineColor: markerRing,
            lineWidth: isDark ? 1.5 : 2,
          },
          dataLabels: {
            enabled: true,
            format: "{y:.1f}",
            style: {
              color: isDark ? "#e5e7eb" : lineColor,
              fontSize: "10px",
              fontWeight: "600",
              textOutline: dataLabelOutline,
            },
            y: -8,
          },
        },
      ],
    };
  }, [points, targetKg, isDark]);

  if (points.length < 2) return null;
  return <HighchartsReact highcharts={Highcharts} options={options} />;
});

export function LandingMobileWeightTab({
  weightCurrentKg,
  weightTargetKg,
  weightEntryCount,
  weightWeekPoints,
  weightTitle,
  weightDescription,
  currentWeightLabel,
  targetWeightLabel,
  noTargetYetLabel,
  openLabel,
  onOpenWeight,
  onOpenGoals,
}: LandingMobileWeightTabProps) {
  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex justify-center">
          <GoalConfigPill
            label={weightTargetKg != null ? `Goal: ${weightTargetKg.toFixed(1)} kg` : "Set weight goal"}
            onClick={onOpenGoals}
          />
        </div>
        <h2 className="text-xl font-bold text-foreground">{weightTitle}</h2>
        {weightDescription && (
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {weightDescription}
          </p>
        )}
      </div>

      {/* Chart */}
      {weightWeekPoints.length >= 2 ? (
        <div className="landing-module-glass w-full overflow-hidden rounded-2xl border p-2">
          <WeightChart points={weightWeekPoints} targetKg={weightTargetKg} />
        </div>
      ) : (
        <div className="landing-module-glass rounded-2xl border px-4 py-8 text-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            {weightWeekPoints.length === 1
              ? "Log one more entry to see your trend."
              : "No entries this week."}
          </p>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="landing-module-glass rounded-2xl border px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)}`}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{currentWeightLabel}</p>
        </div>
        <div className="landing-module-glass rounded-2xl border px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {weightTargetKg == null ? "--" : `${weightTargetKg.toFixed(1)}`}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{targetWeightLabel}</p>
        </div>
      </div>

      {/* Distance + entries */}
      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        {distanceToTarget == null ? noTargetYetLabel : `${distanceToTarget} kg to target`}
        {" · "}
        {weightEntryCount} entr{weightEntryCount === 1 ? "y" : "ies"}
      </p>

      {/* CTA */}
      <button
        type="button"
        onClick={onOpenWeight}
        className="w-full rounded-2xl border border-[#c96442] bg-[#f5f4ed] py-3.5 text-[15px] font-semibold text-[#4d4c48] transition-colors active:scale-[0.98] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5]"
      >
        {openLabel}
      </button>
    </div>
  );
}
