"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { ScoreRing } from "@/components/landing/ScoreRing";
import { computeSleepScore, computeSleepInsight, computeSleepBank } from "@/lib/sleep-score";
import type { FocusDurationSuggestion, LandingSleepEntry } from "@/components/landing/types";

function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

interface LandingSleepRecoveryChartProps {
  entries: LandingSleepEntry[];
  focusSuggestion: FocusDurationSuggestion | null;
}

const SLEEP_PURPLE = "#7c5cbf";
const SLEEP_PURPLE_DIM = "#a78bfa";

export function LandingSleepRecoveryChart({
  entries,
  focusSuggestion,
}: LandingSleepRecoveryChartProps) {
  const last7 = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    return sorted.slice(-7);
  }, [entries]);

  const latestEntry = last7.length > 0 ? last7[last7.length - 1] : null;
  const sleepScore = latestEntry
    ? computeSleepScore(latestEntry.sleepHours, latestEntry.hrvMs)
    : null;
  const insight = useMemo(() => computeSleepInsight(entries), [entries]);
  const sleepBank = useMemo(() => computeSleepBank(entries), [entries]);

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
              color: "rgba(124,92,191,0.10)",
              borderColor: "rgba(124,92,191,0.30)",
              borderWidth: 1,
            },
          ]
        : [];

    const yAxes: Highcharts.YAxisOptions[] = [
      {
        title: { text: undefined },
        labels: {
          format: "{value}h",
          style: { color: "rgba(255,255,255,0.45)", fontSize: "10px" },
        },
        min: 0,
        max: 12,
        gridLineColor: "rgba(255,255,255,0.06)",
      },
    ];

    if (hasHrv) {
      yAxes.push({
        title: { text: undefined },
        labels: {
          format: "{value} ms",
          style: { color: "rgba(255,255,255,0.45)", fontSize: "10px" },
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
            [0, "rgba(124,92,191,0.8)"],
            [1, "rgba(124,92,191,0.25)"],
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
          lineColor: "rgba(255,255,255,0.8)",
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
        itemStyle: { color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "500" },
      },
      xAxis: {
        categories,
        lineColor: "rgba(255,255,255,0.08)",
        tickColor: "rgba(255,255,255,0.08)",
        labels: { style: { color: "rgba(255,255,255,0.45)", fontSize: "10px" } },
        plotBands,
      },
      yAxis: yAxes,
      tooltip: {
        backgroundColor: "rgba(30,20,50,0.95)",
        borderColor: "rgba(124,92,191,0.4)",
        style: { color: "#e8e0f0" },
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
  }, [last7]);

  if (entries.length === 0) return null;

  const bankColor =
    sleepBank.type === "surplus" ? "#34d399" : sleepBank.type === "deficit" ? "#f87171" : "#a78bfa";

  return (
    <section className="sleep-section-dark w-full overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        {/* header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a78bfa]">
            Sleep &amp; Recovery
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
            Dial In Your Sleep
          </h2>
        </div>

        {/* score ring */}
        {sleepScore && (
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

        {/* time metrics */}
        {latestEntry && (
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                Time in bed
              </span>
              <span className="mt-0.5 text-lg font-bold tabular-nums text-white/80">
                {formatHoursMinutes(latestEntry.sleepHours)}
              </span>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                Time asleep
              </span>
              <span className="mt-0.5 text-lg font-bold tabular-nums text-white/80">
                {formatHoursMinutes(latestEntry.sleepHours)}
              </span>
            </div>
          </div>
        )}

        {/* AI insight card */}
        {insight && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="text-[12px] leading-relaxed text-white/70">
              {insight.message}
            </p>
            <button
              type="button"
              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#a78bfa] transition-colors hover:text-[#c4b5fd]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
              </svg>
              View Sleep Insights
            </button>
          </div>
        )}

        {/* bedtime suggestion */}
        {latestEntry && (
          <div className="flex justify-center gap-4 text-center">
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-white/40">
                Wind down
              </span>
              <span className="mt-0.5 text-sm font-bold text-white/70">11:00 PM</span>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-white/40">
                Target bedtime
              </span>
              <span className="mt-0.5 text-sm font-bold text-white/70">11:30 PM</span>
            </div>
          </div>
        )}

        {/* 7-day chart */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2">
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </div>

        {/* sleep bank */}
        {sleepBank.type !== "balanced" && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={bankColor} className="h-4 w-4 shrink-0">
              <path d="M10.75 10.818a.75.75 0 01-1.5 0V6.29L7.836 7.704a.75.75 0 01-1.061-1.06l2.828-2.83a.749.749 0 011.061 0l2.829 2.83a.75.75 0 01-1.061 1.06L11 6.54v4.278z" style={sleepBank.type === "deficit" ? { transform: "rotate(180deg)", transformOrigin: "center" } : undefined} />
              <path d="M3.5 13.5a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75zM3.5 16.25a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75z" />
            </svg>
            <span className="text-[11px] font-medium text-white/50">Sleep Bank</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: bankColor }}>
              {sleepBank.label}
            </span>
          </div>
        )}

        {/* focus suggestion */}
        {focusSuggestion && (
          <p className="text-center text-[11px] text-[#a78bfa]/70">
            ✦ Suggested focus session: {focusSuggestion.minutes} min — {focusSuggestion.reason}
          </p>
        )}
      </div>
    </section>
  );
}
