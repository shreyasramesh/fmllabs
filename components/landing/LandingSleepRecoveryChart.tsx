"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { ScoreRing } from "@/components/landing/ScoreRing";
import { useTheme } from "@/components/ThemeProvider";
import { computeSleepScore, computeSleepInsight, computeSleepBank } from "@/lib/sleep-score";
import type { LandingSleepEntry } from "@/components/landing/types";

function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

interface LandingSleepRecoveryChartProps {
  entries: LandingSleepEntry[];
  /** AI-generated habit recommendation for improving sleep. */
  habitInsight: string | null;
  habitInsightLoading?: boolean;
  /** Opens Gemini sleep insights (parent handles auth + API). */
  onViewSleepInsights?: () => void;
  chartsOnly?: boolean;
  targetHours?: number;
}

const SLEEP_PURPLE = "#7c5cbf";
const SLEEP_PURPLE_DIM = "#a78bfa";

export function LandingSleepRecoveryChart({
  entries,
  habitInsight,
  habitInsightLoading = false,
  onViewSleepInsights,
  chartsOnly = false,
  targetHours = 8,
}: LandingSleepRecoveryChartProps) {
  const { theme } = useTheme();
  const chartDark = theme === "dark";

  const last7 = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    return sorted.slice(-7);
  }, [entries]);

  const latestEntry = last7.length > 0 ? last7[last7.length - 1] : null;
  const sleepScore = latestEntry
    ? computeSleepScore(latestEntry.sleepHours, latestEntry.hrvMs, latestEntry.sleepScore)
    : null;
  const insight = useMemo(() => computeSleepInsight(entries), [entries]);
  const sleepBank = useMemo(() => computeSleepBank(entries, targetHours), [entries, targetHours]);

  const chartOptions = useMemo<Highcharts.Options>(() => {
    if (last7.length === 0) return {};

    const labelMuted = chartDark ? "rgba(255,255,255,0.45)" : "#737373";
    const gridLine = chartDark ? "rgba(255,255,255,0.06)" : "#e5e5e5";
    const axisLine = chartDark ? "rgba(255,255,255,0.08)" : "#d4d4d4";
    const hrvMarkerLine = chartDark ? "rgba(255,255,255,0.8)" : "#404040";

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
              color: chartDark ? "rgba(124,92,191,0.10)" : "rgba(124,92,191,0.12)",
              borderColor: chartDark ? "rgba(124,92,191,0.30)" : "rgba(124,92,191,0.35)",
              borderWidth: 1,
            },
          ]
        : [];

    const yAxes: Highcharts.YAxisOptions[] = [
      {
        title: { text: undefined },
        labels: {
          format: "{value}h",
          style: { color: labelMuted, fontSize: "10px" },
        },
        min: 0,
        max: 12,
        gridLineColor: gridLine,
      },
    ];

    if (hasHrv) {
      yAxes.push({
        title: { text: undefined },
        labels: {
          format: "{value} ms",
          style: { color: labelMuted, fontSize: "10px" },
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
            [0, "rgba(124,92,191,0.85)"],
            [1, "rgba(124,92,191,0.28)"],
          ],
        },
        borderRadius: 4,
        borderWidth: 0,
        yAxis: 0,
        tooltip: { valueSuffix: " h" },
      },
    ];

    if (hasHrv) {
      series.push({
        type: "spline",
        name: "HRV",
        data: hrvData,
        color: SLEEP_PURPLE_DIM,
        lineWidth: 2.5,
        marker: {
          enabled: true,
          symbol: "circle",
          radius: 4,
          fillColor: SLEEP_PURPLE_DIM,
          lineColor: hrvMarkerLine,
          lineWidth: 2,
        },
        yAxis: 1,
        tooltip: { valueSuffix: " ms" },
        connectNulls: true,
      });
    }

    return {
      chart: {
        backgroundColor: "transparent",
        height: 180,
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
        itemStyle: {
          color: chartDark ? "rgba(255,255,255,0.5)" : "#525252",
          fontSize: "10px",
          fontWeight: "500",
        },
      },
      xAxis: {
        categories,
        lineColor: axisLine,
        tickColor: axisLine,
        labels: { style: { color: labelMuted, fontSize: "10px" } },
        plotBands,
      },
      yAxis: yAxes,
      tooltip: chartDark
        ? {
            backgroundColor: "rgba(30,20,50,0.95)",
            borderColor: "rgba(124,92,191,0.4)",
            style: { color: "#e8e0f0" },
            shared: true,
          }
        : {
            backgroundColor: "rgba(255,255,255,0.96)",
            borderColor: "rgba(124,92,191,0.35)",
            style: { color: "#1f2937" },
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
            chartOptions: { chart: { height: 155 } },
          },
        ],
      },
    };
  }, [last7, chartDark]);

  if (entries.length === 0) return null;

  const bankColor =
    sleepBank.type === "surplus" ? "#34d399" : sleepBank.type === "deficit" ? "#f87171" : "#a78bfa";

  const innerCard = "module-nested px-5 py-3";
  const innerCardMuted = "module-nested-muted p-4";

  return (
    <section className="landing-module-glass w-full overflow-hidden rounded-[2rem] border p-4 sm:p-5">
      <div className="flex flex-col gap-5">
        {!chartsOnly ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B87B51] dark:text-[#D6A67E]">
              Sleep &amp; Recovery
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              Dial In Your Sleep
            </h2>
          </div>
        ) : null}

        {!chartsOnly && sleepScore && (
          <div className="flex justify-center">
            <ScoreRing
              score={sleepScore.score}
              label={sleepScore.label}
              size={148}
              strokeWidth={11}
              color={SLEEP_PURPLE}
              trackColor="rgba(124,92,191,0.15)"
            />
          </div>
        )}

        {!chartsOnly && latestEntry && (
          <div className="flex justify-center gap-4">
            <div className={`flex flex-col items-center ${innerCard}`}>
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Duration
              </span>
              <span className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                {formatHoursMinutes(latestEntry.sleepHours)}
              </span>
            </div>
            {latestEntry.hrvMs != null && (
              <div className={`flex flex-col items-center ${innerCard}`}>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  HRV
                </span>
                <span className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                  {latestEntry.hrvMs} ms
                </span>
              </div>
            )}
            {latestEntry.sleepScore != null && (
              <div className={`flex flex-col items-center ${innerCard}`}>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Score
                </span>
                <span className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                  {latestEntry.sleepScore}/100
                </span>
              </div>
            )}
          </div>
        )}

        {!chartsOnly && insight && (
          <div className={innerCardMuted}>
            <p className="text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-300">{insight.message}</p>
          </div>
        )}

        {onViewSleepInsights && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onViewSleepInsights}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/80 bg-violet-50/80 px-4 py-2 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100/90 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  clipRule="evenodd"
                />
              </svg>
              View Sleep Insights
            </button>
          </div>
        )}

        {latestEntry && (
          <div className="flex justify-center gap-4 text-center">
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Wind down
              </span>
              <span className="mt-0.5 text-sm font-bold text-foreground">11:00 PM</span>
            </div>
            <div className="w-px bg-neutral-200 dark:bg-neutral-600" />
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Target bedtime
              </span>
              <span className="mt-0.5 text-sm font-bold text-foreground">11:30 PM</span>
            </div>
          </div>
        )}

        <div className="module-chart-inset p-2">
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>

        {sleepBank.type !== "balanced" && (
          <div
            className={`flex items-center justify-center gap-2 ${innerCard} px-4 py-3`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={bankColor} className="h-4 w-4 shrink-0">
              <path d="M10.75 10.818a.75.75 0 01-1.5 0V6.29L7.836 7.704a.75.75 0 01-1.061-1.06l2.828-2.83a.749.749 0 011.061 0l2.829 2.83a.75.75 0 01-1.061 1.06L11 6.54v4.278z" style={sleepBank.type === "deficit" ? { transform: "rotate(180deg)", transformOrigin: "center" } : undefined} />
              <path d="M3.5 13.5a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75zM3.5 16.25a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75z" />
            </svg>
            <span className="text-center text-[12px] font-medium" style={{ color: bankColor }}>
              {sleepBank.label}
            </span>
          </div>
        )}

        {habitInsightLoading && (
          <p className="text-center text-[11px] text-neutral-400 dark:text-neutral-500 animate-pulse">
            ✦ Generating habit insight…
          </p>
        )}
        {!habitInsightLoading && habitInsight && (
          <p className="text-center text-[11px] text-violet-600/90 dark:text-violet-300/80">
            ✦ {habitInsight}
          </p>
        )}
      </div>
    </section>
  );
}
