"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

interface BreakdownItem {
  name: string;
  count: number;
}

interface WebAnalyticsData {
  from: string;
  to: string;
  granularity: "daily" | "weekly" | "monthly";
  visitors: number;
  pageViews: number;
  pages: BreakdownItem[];
  geo: {
    countries: BreakdownItem[];
    regions: BreakdownItem[];
    cities: BreakdownItem[];
  };
  tech: {
    browsers: BreakdownItem[];
    os: BreakdownItem[];
    devices: BreakdownItem[];
  };
  trend: Array<{ period: string; count: number }>;
  funnel: Array<{ name: string; count: number }>;
}

function prettyDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
    </div>
  );
}

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

export default function AdminAnalyticsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<WebAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoTab, setGeoTab] = useState<"countries" | "regions" | "cities">("cities");
  const [techTab, setTechTab] = useState<"browsers" | "os" | "devices">("browsers");
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/web-analytics?from=${from}&to=${to}&granularity=${granularity}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 403) throw new Error("Access denied");
          throw new Error("Failed to load");
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, from, to, granularity]);

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Metric", "Dimension", "Value"];
    const lines = [
      headers.join(","),
      ["visitors", "total", data.visitors].join(","),
      ["page_views", "total", data.pageViews].join(","),
      "",
      "pages",
      ...data.pages.map((p) => ["page", p.name, p.count].join(",")),
      "",
      "countries",
      ...data.geo.countries.map((p) => ["country", p.name, p.count].join(",")),
      "",
      "browsers",
      ...data.tech.browsers.map((p) => ["browser", p.name, p.count].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-analytics-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const geoData = useMemo(
    () =>
      data
        ? (geoTab === "countries"
            ? data.geo.countries
            : geoTab === "regions"
              ? data.geo.regions
              : data.geo.cities)
        : [],
    [data, geoTab]
  );
  const techData = useMemo(
    () =>
      data
        ? (techTab === "browsers"
            ? data.tech.browsers
            : techTab === "os"
              ? data.tech.os
              : data.tech.devices)
        : [],
    [data, techTab]
  );

  const trendChartOptions = useMemo<Highcharts.Options>(() => {
    const base = chartBaseOptions();
    return {
      ...base,
      chart: { ...base.chart, type: "areaspline", height: 260 },
      title: { text: "Visitors Trend", align: "left", style: { color: "#111827", fontSize: "14px", fontWeight: "600" } },
      xAxis: {
        ...base.xAxis,
        categories: (data?.trend ?? []).map((p) =>
          granularity === "monthly" ? p.period : prettyDate(p.period)
        ),
      },
      yAxis: {
        ...base.yAxis,
        allowDecimals: false,
      },
      series: [
        {
          type: "areaspline",
          name: "Page views",
          data: (data?.trend ?? []).map((p) => p.count),
          color: "#60a5fa",
          fillOpacity: 0.18,
          lineWidth: 3,
          marker: { radius: 2, symbol: "circle" },
        },
      ],
    };
  }, [data, granularity]);
  const pagesChartOptions = useMemo<Highcharts.Options>(() => {
    const base = chartBaseOptions();
    return {
      ...base,
      chart: { ...base.chart, type: "bar", height: 340 },
      title: { text: "Pages Visited", align: "left", style: { color: "#111827", fontSize: "14px", fontWeight: "600" } },
      legend: { enabled: false },
      xAxis: { ...base.xAxis, categories: (data?.pages ?? []).slice(0, 10).map((p) => p.name) },
      yAxis: { ...base.yAxis, allowDecimals: false },
      series: [
        {
          type: "bar",
          name: "Page views",
          data: (data?.pages ?? []).slice(0, 10).map((p) => p.count),
          color: "#38bdf8",
          borderRadius: 6,
        },
      ],
    };
  }, [data]);

  const geoChartOptions = useMemo<Highcharts.Options>(() => {
    const base = chartBaseOptions();
    return {
      ...base,
      chart: { ...base.chart, type: "bar", height: 340 },
      title: {
        text: geoTab === "countries" ? "Countries" : geoTab === "regions" ? "Regions" : "Cities",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      legend: { enabled: false },
      xAxis: {
        ...base.xAxis,
        categories: geoData.map((g) => g.name),
      },
      yAxis: { ...base.yAxis, allowDecimals: false },
      series: [
        {
          type: "bar",
          name: "Visitors",
          data: geoData.map((g) => g.count),
          color: "#60a5fa",
          borderRadius: 6,
        },
      ],
    };
  }, [geoData, geoTab]);

  const techChartOptions = useMemo<Highcharts.Options>(() => {
    const base = chartBaseOptions();
    return {
      ...base,
      chart: { ...base.chart, type: "bar", height: 300 },
      title: {
        text: techTab === "browsers" ? "Browsers" : techTab === "os" ? "Operating Systems" : "Devices",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      legend: { enabled: false },
      xAxis: { ...base.xAxis, categories: techData.map((g) => g.name) },
      yAxis: { ...base.yAxis, allowDecimals: false },
      series: [
        {
          type: "bar",
          name: "Visitors",
          data: techData.map((g) => g.count),
          color: "#34d399",
          borderRadius: 6,
        },
      ],
    };
  }, [techData, techTab]);

  const funnelOptions = useMemo<Highcharts.Options>(() => {
    const base = chartBaseOptions();
    const funnel = data?.funnel ?? [];
    return {
      ...base,
      chart: { ...base.chart, type: "bar", inverted: true, height: 360 },
      title: {
        text: "Funnel: Understand behaviors & bottlenecks",
        align: "left",
        style: { color: "#111827", fontSize: "14px", fontWeight: "600" },
      },
      legend: { enabled: false },
      xAxis: { ...base.xAxis, allowDecimals: false },
      yAxis: {
        ...base.yAxis,
        categories: funnel.map((f) => f.name),
        reversed: true,
      },
      plotOptions: {
        bar: {
          dataLabels: { enabled: true },
          borderRadius: 6,
        },
      },
      series: [
        {
          type: "bar",
          name: "Sessions",
          data: funnel.map((f, i) => ({
            y: f.count,
            color: ["#38bdf8", "#60a5fa", "#818cf8", "#a78bfa"][i % 4],
          })),
        },
      ],
    };
  }, [data]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background p-8">
        <h1 className="text-2xl font-semibold text-foreground">Cost Analytics</h1>
        <p className="mt-4 text-neutral-500">Sign in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold text-foreground">Web Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">
          First-party analytics replacing Datafast.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-foreground dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-foreground dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">View</span>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as "daily" | "weekly" | "monthly")}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-foreground dark:border-neutral-600 dark:bg-neutral-800"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <button
            onClick={exportCsv}
            disabled={!data}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-6 text-neutral-500">Loading…</div>
        )}

        {data && !loading && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Visitors" value={`${data.visitors}`} />
              <MiniStat label="Page Views" value={`${data.pageViews}`} />
              <MiniStat label="Top Page" value={data.pages[0]?.name ?? "-"} sub={`${data.pages[0]?.count ?? 0} views`} />
              <MiniStat
                label="Top Browser"
                value={data.tech.browsers[0]?.name ?? "-"}
                sub={`${data.tech.browsers[0]?.count ?? 0} visitors`}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-neutral-200/70 bg-white/70 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                <HighchartsReact highcharts={Highcharts} options={trendChartOptions} />
              </div>
              <div className="rounded-2xl border border-neutral-200/70 bg-white/70 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                <HighchartsReact highcharts={Highcharts} options={pagesChartOptions} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="mr-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Geography
                  </h2>
                  {(["countries", "regions", "cities"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setGeoTab(tab)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        geoTab === tab
                          ? "bg-foreground text-background"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <HighchartsReact highcharts={Highcharts} options={geoChartOptions} />
              </div>

              <div className="rounded-2xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="mr-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    Technology
                  </h2>
                  {(["browsers", "os", "devices"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTechTab(tab)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        techTab === tab
                          ? "bg-foreground text-background"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <HighchartsReact highcharts={Highcharts} options={techChartOptions} />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200/70 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <HighchartsReact highcharts={Highcharts} options={funnelOptions} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
