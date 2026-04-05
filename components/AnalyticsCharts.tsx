"use client";

import { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

function chartBaseOptions(): Highcharts.Options {
  return {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "Inter, system-ui, sans-serif" },
    },
    credits: { enabled: false },
    legend: {
      itemStyle: { color: "#737373", fontSize: "12px" },
    },
    title: { text: undefined },
    xAxis: {
      labels: { style: { color: "#737373", fontSize: "11px" } },
      lineColor: "#e5e5e5",
      tickColor: "#e5e5e5",
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: "#e5e5e5",
      labels: { style: { color: "#737373", fontSize: "11px" } },
    },
    tooltip: {
      backgroundColor: "#111827",
      borderColor: "#1f2937",
      style: { color: "#f9fafb" },
    },
  };
}

function prettyDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CostTrendChart({
  dailyTrend,
}: {
  dailyTrend: Array<{ date: string; costUsd: number }>;
}) {
  const options = useMemo<Highcharts.Options>(
    () => ({
      ...chartBaseOptions(),
      chart: { ...chartBaseOptions().chart, type: "areaspline", height: 260 },
      title: {
        text: "Daily Cost (USD)",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      xAxis: {
        ...chartBaseOptions().xAxis,
        categories: dailyTrend.map((d) => prettyDate(d.date)),
      },
      yAxis: {
        ...chartBaseOptions().yAxis,
        allowDecimals: true,
      },
      series: [
        {
          type: "areaspline",
          name: "Cost (USD)",
          data: dailyTrend.map((d) => d.costUsd),
          color: "#60a5fa",
          fillOpacity: 0.18,
          lineWidth: 3,
          marker: { radius: 2, symbol: "circle" },
        },
      ],
    }),
    [dailyTrend]
  );
  return (
    <div className="app-inset-panel rounded-xl p-4 shadow-sm">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

export function CostByServiceChart({
  totalsByService,
}: {
  totalsByService: Record<string, { costUsd: number; count: number }>;
}) {
  const options = useMemo<Highcharts.Options>(
    () => ({
      ...chartBaseOptions(),
      chart: { ...chartBaseOptions().chart, type: "pie", height: 280 },
      title: {
        text: "Cost by Service",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      plotOptions: {
        pie: {
          dataLabels: {
            style: { fontSize: "11px" },
            format: "<b>{point.name}</b><br>{point.y:.4f} USD",
          },
        },
      },
      series: [
        {
          type: "pie",
          name: "Cost",
          data: Object.entries(totalsByService).map(([name, { costUsd }]) => ({
            name,
            y: costUsd,
          })),
          colors: ["#60a5fa", "#38bdf8", "#34d399", "#fbbf24", "#f472b6"],
        },
      ],
    }),
    [totalsByService]
  );
  return (
    <div className="app-inset-panel rounded-xl p-4 shadow-sm">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

export function RequestCountByServiceChart({
  totalsByService,
}: {
  totalsByService: Record<string, { costUsd: number; count: number }>;
}) {
  const entries = Object.entries(totalsByService).sort((a, b) => b[1].count - a[1].count);
  const options = useMemo<Highcharts.Options>(
    () => ({
      ...chartBaseOptions(),
      chart: { ...chartBaseOptions().chart, type: "bar", height: 260 },
      title: {
        text: "Request Count by Service",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      legend: { enabled: false },
      xAxis: {
        ...chartBaseOptions().xAxis,
        categories: entries.map(([name]) => name),
      },
      yAxis: {
        ...chartBaseOptions().yAxis,
        allowDecimals: false,
      },
      series: [
        {
          type: "bar",
          name: "Requests",
          data: entries.map(([, { count }]) => count),
          color: "#38bdf8",
          borderRadius: 6,
        },
      ],
    }),
    [entries]
  );
  return (
    <div className="app-inset-panel rounded-xl p-4 shadow-sm">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}
