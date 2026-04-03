"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type { CaffeineFocusWindow, CaffeineIntake } from "@/components/landing/types";

const HALF_LIFE_MINUTES = 300;

function caffeineAtMinute(intakes: readonly CaffeineIntake[], minute: number): number {
  let total = 0;
  for (const intake of intakes) {
    const elapsed = minute - intake.minuteOfDay;
    if (elapsed < 0) continue;
    total += intake.mg * Math.pow(0.5, elapsed / HALF_LIFE_MINUTES);
  }
  return total;
}

function formatTime(minuteOfDay: number): string {
  const h24 = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

interface LandingCaffeineChartProps {
  intakes: CaffeineIntake[];
  focusWindow: CaffeineFocusWindow | null;
}

export function LandingCaffeineChart({ intakes, focusWindow }: LandingCaffeineChartProps) {
  const chartOptions = useMemo<Highcharts.Options>(() => {
    if (intakes.length === 0) return {};

    const earliest = Math.min(...intakes.map((i) => i.minuteOfDay));
    const latest = Math.min(1440, Math.max(...intakes.map((i) => i.minuteOfDay)) + 720);
    const startMinute = Math.max(0, earliest - 30);
    const endMinute = Math.min(1440, latest);

    const curveData: [number, number][] = [];
    for (let m = startMinute; m <= endMinute; m += 5) {
      curveData.push([m, Math.round(caffeineAtMinute(intakes, m) * 10) / 10]);
    }

    const intakeMarkers: Highcharts.PointOptionsObject[] = intakes.map((intake) => ({
      x: intake.minuteOfDay,
      y: Math.round(caffeineAtMinute(intakes, intake.minuteOfDay) * 10) / 10,
      marker: {
        enabled: true,
        symbol: "circle",
        radius: 6,
        fillColor: "#92400e",
        lineColor: "#fff",
        lineWidth: 2,
      },
    }));

    const plotBands: Highcharts.XAxisPlotBandsOptions[] = [];
    if (focusWindow) {
      plotBands.push({
        from: focusWindow.startMinute,
        to: focusWindow.endMinute,
        color: "rgba(34,197,94,0.12)",
        label: {
          text: `Peak focus ${formatTime(focusWindow.startMinute)}–${formatTime(focusWindow.endMinute)}`,
          style: { color: "#16a34a", fontSize: "10px", fontWeight: "600" },
          y: 14,
        },
        borderColor: "rgba(34,197,94,0.4)",
        borderWidth: 1,
      });
    }

    return {
      chart: {
        type: "areaspline",
        backgroundColor: "transparent",
        height: 200,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [8, 4, 8, 4],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { enabled: false },
      xAxis: {
        type: "linear",
        min: startMinute,
        max: endMinute,
        tickInterval: 60,
        labels: {
          formatter() {
            const val = typeof this.value === "number" ? this.value : 0;
            const h = Math.floor(val / 60) % 24;
            const suffix = h >= 12 ? "p" : "a";
            const h12 = h % 12 || 12;
            return `${h12}${suffix}`;
          },
          style: { color: "#a3a3a3", fontSize: "10px" },
        },
        lineColor: "#e5e5e5",
        tickColor: "#e5e5e5",
        plotBands,
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: "#f5f5f5",
        labels: {
          format: "{value} mg",
          style: { color: "#a3a3a3", fontSize: "10px" },
        },
        min: 0,
      },
      tooltip: {
        backgroundColor: "#1c1917",
        borderColor: "#44403c",
        style: { color: "#fafaf9" },
        formatter() {
          const min = typeof this.x === "number" ? this.x : 0;
          return `<b>${formatTime(min)}</b><br/>Caffeine: <b>${this.y?.toFixed(0)} mg</b>`;
        },
      },
      plotOptions: {
        areaspline: {
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, "rgba(180,100,20,0.35)"],
              [1, "rgba(180,100,20,0.04)"],
            ],
          },
          lineColor: "#92400e",
          lineWidth: 2.5,
          marker: { enabled: false },
          threshold: 0,
        },
      },
      series: [
        {
          type: "areaspline" as const,
          name: "Caffeine",
          data: curveData,
        },
        {
          type: "scatter" as const,
          name: "Intakes",
          data: intakeMarkers,
          tooltip: {
            pointFormatter() {
              const intake = intakes.find((i) => i.minuteOfDay === this.x);
              return `☕ <b>+${intake?.mg ?? 0} mg</b> intake`;
            },
          },
        },
      ],
      responsive: {
        rules: [
          {
            condition: { maxWidth: 420 },
            chartOptions: {
              chart: { height: 170 },
            },
          },
        ],
      },
    };
  }, [intakes, focusWindow]);

  if (intakes.length === 0) return null;

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e] dark:text-[#D6A67E]">
            Caffeine
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
            Caffeine Decay Curve
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {intakes.map((intake, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-sm">☕</span>
              {formatTime(intake.minuteOfDay)} · {intake.mg} mg
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-[#E8D8C7]/60 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,250,245,0.94)_100%)] p-2 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>
      {focusWindow && (
        <p className="mt-2 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
          ✦ Peak focus window: {formatTime(focusWindow.startMinute)}–{formatTime(focusWindow.endMinute)}
        </p>
      )}
    </section>
  );
}
