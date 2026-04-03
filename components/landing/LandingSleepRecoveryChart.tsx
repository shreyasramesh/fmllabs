"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import type { FocusDurationSuggestion, LandingSleepEntry } from "@/components/landing/types";

function recoveryLabel(sleepHours: number, hrvMs: number | null): { text: string; color: string } {
  if (sleepHours >= 7 && hrvMs != null && hrvMs >= 50)
    return { text: "Well recovered", color: "#16a34a" };
  if (sleepHours >= 7)
    return { text: "Good sleep", color: "#2563eb" };
  if (sleepHours >= 5)
    return { text: "Light sleep", color: "#d97706" };
  return { text: "Low recovery", color: "#dc2626" };
}

interface LandingSleepRecoveryChartProps {
  entries: LandingSleepEntry[];
  focusSuggestion: FocusDurationSuggestion | null;
}

export function LandingSleepRecoveryChart({
  entries,
  focusSuggestion,
}: LandingSleepRecoveryChartProps) {
  const last7 = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    return sorted.slice(-7);
  }, [entries]);

  const latestEntry = last7.length > 0 ? last7[last7.length - 1] : null;
  const recovery = latestEntry
    ? recoveryLabel(latestEntry.sleepHours, latestEntry.hrvMs)
    : null;

  const chartOptions = useMemo<Highcharts.Options>(() => {
    if (last7.length === 0) return {};

    const categories = last7.map((e) => {
      const parts = e.dayKey.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { weekday: "short" });
    });

    const sleepData = last7.map((e) => e.sleepHours);
    const hrvData = last7.map((e) => e.hrvMs);
    const hasHrv = hrvData.some((v) => v != null);

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayIdx = last7.findIndex((e) => e.dayKey === todayKey);
    const plotBands: Highcharts.XAxisPlotBandsOptions[] =
      todayIdx >= 0
        ? [
            {
              from: todayIdx - 0.5,
              to: todayIdx + 0.5,
              color: "rgba(180,100,20,0.08)",
              borderColor: "rgba(180,100,20,0.25)",
              borderWidth: 1,
            },
          ]
        : [];

    const yAxes: Highcharts.YAxisOptions[] = [
      {
        title: { text: undefined },
        labels: {
          format: "{value}h",
          style: { color: "#a3a3a3", fontSize: "10px" },
        },
        min: 0,
        max: 12,
        gridLineColor: "#f5f5f5",
      },
    ];

    if (hasHrv) {
      yAxes.push({
        title: { text: undefined },
        labels: {
          format: "{value} ms",
          style: { color: "#a3a3a3", fontSize: "10px" },
        },
        min: 0,
        opposite: true,
        gridLineWidth: 0,
      });
    }

    const series: Highcharts.SeriesOptionsType[] = [
      {
        type: "column",
        name: "Sleep",
        data: sleepData,
        color: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, "rgba(180,100,20,0.7)"],
            [1, "rgba(180,100,20,0.25)"],
          ],
        },
        borderRadius: 4,
        borderWidth: 0,
        yAxis: 0,
        tooltip: {
          valueSuffix: " h",
        },
      },
    ];

    if (hasHrv) {
      series.push({
        type: "spline",
        name: "HRV",
        data: hrvData,
        color: "#92400e",
        lineWidth: 2.5,
        marker: {
          enabled: true,
          symbol: "circle",
          radius: 4,
          fillColor: "#92400e",
          lineColor: "#fff",
          lineWidth: 2,
        },
        yAxis: 1,
        tooltip: {
          valueSuffix: " ms",
        },
        connectNulls: true,
      });
    }

    return {
      chart: {
        backgroundColor: "transparent",
        height: 200,
        style: { fontFamily: "Inter, system-ui, sans-serif" },
        spacing: [8, 4, 8, 4],
      },
      credits: { enabled: false },
      title: { text: undefined },
      legend: {
        enabled: hasHrv,
        align: "right",
        verticalAlign: "top",
        floating: true,
        itemStyle: { color: "#a3a3a3", fontSize: "10px", fontWeight: "500" },
      },
      xAxis: {
        categories,
        lineColor: "#e5e5e5",
        tickColor: "#e5e5e5",
        labels: { style: { color: "#a3a3a3", fontSize: "10px" } },
        plotBands,
      },
      yAxis: yAxes,
      tooltip: {
        backgroundColor: "#1c1917",
        borderColor: "#44403c",
        style: { color: "#fafaf9" },
        shared: true,
      },
      plotOptions: {
        column: {
          groupPadding: 0.15,
          pointPadding: 0.05,
        },
      },
      series,
      responsive: {
        rules: [
          {
            condition: { maxWidth: 420 },
            chartOptions: { chart: { height: 170 } },
          },
        ],
      },
    };
  }, [last7]);

  if (entries.length === 0) return null;

  return (
    <section className="w-full rounded-[2rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e] dark:text-[#D6A67E]">
            Sleep &amp; Recovery
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
            Sleep &amp; HRV Trends
          </h2>
        </div>
        {recovery && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${recovery.color}18`, color: recovery.color }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: recovery.color }}
            />
            {recovery.text}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-[#E8D8C7]/60 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(255,250,245,0.94)_100%)] p-2 dark:border-neutral-700 dark:bg-none dark:bg-neutral-800">
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      </div>

      {focusSuggestion && (
        <p className="mt-2 text-center text-[11px] text-[#92400e] dark:text-[#D6A67E]">
          ✦ Suggested focus session: {focusSuggestion.minutes} min — {focusSuggestion.reason}
        </p>
      )}
    </section>
  );
}
