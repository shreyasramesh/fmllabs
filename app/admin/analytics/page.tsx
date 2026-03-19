"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";

const CostTrendChart = dynamic(
  () => import("@/components/AnalyticsCharts").then((m) => m.CostTrendChart),
  { ssr: false }
);
const CostByServiceChart = dynamic(
  () => import("@/components/AnalyticsCharts").then((m) => m.CostByServiceChart),
  { ssr: false }
);
const RequestCountByServiceChart = dynamic(
  () =>
    import("@/components/AnalyticsCharts").then(
      (m) => m.RequestCountByServiceChart
    ),
  { ssr: false }
);

interface AnalyticsRow {
  userId: string;
  service: string;
  costUsd: number;
  count: number;
}

interface DailyTrendItem {
  date: string;
  costUsd: number;
}

interface PerUserData {
  dailyTrend: DailyTrendItem[];
  totalsByService: Record<string, { costUsd: number; count: number }>;
}

interface AnalyticsData {
  from: string;
  to: string;
  rows: AnalyticsRow[];
  totalsByService: Record<string, { costUsd: number; count: number }>;
  totalCost: number;
  dailyTrend?: DailyTrendItem[];
  userNames?: Record<string, string>;
  perUser?: Record<string, PerUserData>;
}

export default function AdminAnalyticsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState<string>("all");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics?from=${from}&to=${to}`)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 403) throw new Error("Access denied");
          throw new Error("Failed to load");
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (
          selectedUser !== "all" &&
          d.perUser &&
          !d.perUser[selectedUser]
        ) {
          setSelectedUser("all");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, from, to]);

  const exportCsv = () => {
    if (!data) return;
    const headers = ["User ID", "Service", "Cost (USD)", "Count"];
    const lines = [
      headers.join(","),
      ...data.rows.map((r) =>
        [r.userId, r.service, r.costUsd.toFixed(6), r.count].join(",")
      ),
      "",
      "Totals by service",
      ...Object.entries(data.totalsByService).map(([svc, t]) =>
        [svc, t.costUsd.toFixed(6), t.count].join(",")
      ),
      "",
      `Total Cost,${data.totalCost.toFixed(6)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background p-8">
        <h1 className="text-2xl font-semibold text-foreground">Cost Analytics</h1>
        <p className="mt-4 text-neutral-500">Sign in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-foreground">Per-User Cost Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Request-level cost breakdown for Transcribr, MongoDB, Gemini, and ElevenLabs.
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
          {data?.perUser && Object.keys(data.perUser).length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">View</span>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-foreground dark:border-neutral-600 dark:bg-neutral-800"
              >
                <option value="all">All users</option>
                {Object.entries(data.userNames ?? {})
                  .filter(([id]) => data.perUser?.[id])
                  .map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          )}
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
            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              {(() => {
                const displayTotal =
                  selectedUser === "all"
                    ? data.totalCost
                    : data.rows
                        .filter((r) => r.userId === selectedUser)
                        .reduce((s, r) => s + r.costUsd, 0);
                const displayTotalsByService =
                  selectedUser === "all"
                    ? data.totalsByService
                    : data.perUser?.[selectedUser]?.totalsByService ?? {};
                const displayLabel =
                  selectedUser === "all"
                    ? "All users"
                    : data.userNames?.[selectedUser] ?? selectedUser;
                return (
                  <>
                    <div className="text-lg font-medium text-foreground">
                      Total cost ({displayLabel}): ${displayTotal.toFixed(4)} USD
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-500">
                      {Object.entries(displayTotalsByService).map(([svc, t]) => (
                        <span key={svc}>
                          {svc}: ${t.costUsd.toFixed(4)} ({t.count} requests)
                        </span>
                      ))}
                    </div>
                    {selectedUser === "all" && data.rows.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-6 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
                        <span className="text-foreground">
                          <strong>Users:</strong> $
                          {data.rows
                            .filter((r) => r.userId !== "anonymous")
                            .reduce((s, r) => s + r.costUsd, 0)
                            .toFixed(4)}
                        </span>
                        <span className="text-neutral-500">
                          <strong>Anonymous:</strong> $
                          {data.rows
                            .filter((r) => r.userId === "anonymous")
                            .reduce((s, r) => s + r.costUsd, 0)
                            .toFixed(4)}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {(() => {
              const chartData =
                selectedUser !== "all" && data.perUser?.[selectedUser]
                  ? data.perUser[selectedUser]
                  : {
                      dailyTrend: data.dailyTrend ?? [],
                      totalsByService: data.totalsByService,
                    };
              const chartLabel =
                selectedUser !== "all"
                  ? data.userNames?.[selectedUser] ?? selectedUser
                  : "All users";
              return (
                <>
                  {selectedUser !== "all" && (
                    <h2 className="mt-6 text-lg font-semibold text-foreground">
                      {chartLabel}
                    </h2>
                  )}
                  {chartData.dailyTrend.length > 0 && (
                    <div className="mt-6">
                      <CostTrendChart dailyTrend={chartData.dailyTrend} />
                    </div>
                  )}
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    {Object.keys(chartData.totalsByService).length > 0 && (
                      <CostByServiceChart
                        totalsByService={chartData.totalsByService}
                      />
                    )}
                    {Object.keys(chartData.totalsByService).length > 0 && (
                      <RequestCountByServiceChart
                        totalsByService={chartData.totalsByService}
                      />
                    )}
                  </div>
                </>
              );
            })()}

            <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
                    {selectedUser === "all" && (
                      <th className="px-4 py-3 font-medium text-foreground">User</th>
                    )}
                    <th className="px-4 py-3 font-medium text-foreground">Service</th>
                    <th className="px-4 py-3 font-medium text-foreground">Cost (USD)</th>
                    <th className="px-4 py-3 font-medium text-foreground">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredRows =
                      selectedUser === "all"
                        ? data.rows
                        : data.rows.filter((r) => r.userId === selectedUser);
                    return filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={selectedUser === "all" ? 4 : 3}
                          className="px-4 py-8 text-center text-neutral-500"
                        >
                          No usage in this period.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r, i) => (
                        <tr
                          key={`${r.userId}-${r.service}-${i}`}
                          className="border-b border-neutral-100 dark:border-neutral-800"
                        >
                          {selectedUser === "all" && (
                            <td className="px-4 py-2 text-foreground">
                              <span
                                className={
                                  r.userId === "anonymous"
                                    ? "text-neutral-500 italic"
                                    : ""
                                }
                              >
                                {data.userNames?.[r.userId] ?? r.userId}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2 text-foreground">{r.service}</td>
                        <td className="px-4 py-2 text-foreground">
                          ${r.costUsd.toFixed(6)}
                        </td>
                          <td className="px-4 py-2 text-neutral-500">{r.count}</td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
