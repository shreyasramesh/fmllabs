"use client";

import React, { useState, useMemo } from "react";
import { GoalConfigPill } from "@/components/landing/GoalConfigPill";
import type {
  LifeCalendarData,
  YearProgressData,
  LifeCountdown,
  FireTrackerData,
} from "@/components/landing/types";

interface LandingMobileLifeTabProps {
  lifeCalendar: LifeCalendarData;
  yearProgress: YearProgressData;
  countdowns: LifeCountdown[];
  fireTracker: FireTrackerData | null;
  onOpenGoals: () => void;
  onAddCountdown: (label: string, targetDate: string) => void;
  onDeleteCountdown: (id: string) => void;
  onSetBirthday: (birthday: string) => void;
}

// ---------------------------------------------------------------------------
// Life Calendar Dot Grid
// ---------------------------------------------------------------------------

const GRID_COLS = 52;

const LifeCalendarGrid = React.memo(function LifeCalendarGrid({
  weeksLived,
  weeksTotal,
  percentLived,
}: {
  weeksLived: number;
  weeksTotal: number;
  percentLived: number;
}) {
  const rows = Math.ceil(weeksTotal / GRID_COLS);
  const dotSize = weeksTotal > 4160 ? 3 : 4;
  const gap = weeksTotal > 4160 ? 1 : 1.5;

  return (
    <div className="landing-module-glass rounded-2xl border p-3">
      <div
        className="mx-auto overflow-x-auto"
        style={{ maxWidth: (dotSize + gap) * GRID_COLS + "px" }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, ${dotSize}px)`,
            gap: `${gap}px`,
          }}
        >
          {Array.from({ length: rows * GRID_COLS }, (_, i) => {
            if (i >= weeksTotal) return <span key={i} />;
            const lived = i < weeksLived;
            return (
              <span
                key={i}
                className={`block rounded-full ${
                  lived
                    ? "bg-[#c96442] dark:bg-[#d97757]"
                    : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
                }`}
                style={{ width: dotSize, height: dotSize }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#5e5d59] dark:text-[#87867f]">
        <span>{weeksLived.toLocaleString()} weeks lived</span>
        <span>{(weeksTotal - weeksLived).toLocaleString()} remaining</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
        <div
          className="h-full rounded-full bg-[#c96442] transition-all dark:bg-[#d97757]"
          style={{ width: `${Math.min(100, percentLived)}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[11px] font-medium text-[#4d4c48] dark:text-[#b0aea5]">
        {percentLived.toFixed(1)}% lived
      </p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Year Progress Ring
// ---------------------------------------------------------------------------

const YearProgressRing = React.memo(function YearProgressRing({
  yearProgress,
}: {
  yearProgress: YearProgressData;
}) {
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const offset = circumference * (1 - yearProgress.percentElapsed / 100);
  const year = new Date().getFullYear();

  return (
    <div className="landing-module-glass flex flex-col items-center rounded-2xl border p-4">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-[#e8e6dc] dark:text-[#3d3d3a]"
        />
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-[#c96442] transition-all duration-500 dark:text-[#d97757]"
        />
      </svg>
      <div className="-mt-[76px] mb-[20px] flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {yearProgress.percentElapsed.toFixed(1)}%
        </span>
        <span className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
          {year} Progress
        </span>
      </div>
      <div className="mt-1 flex w-full justify-between text-[11px] text-[#5e5d59] dark:text-[#87867f]">
        <span>Day {yearProgress.dayOfYear}</span>
        <span>{yearProgress.daysInYear - yearProgress.dayOfYear} days left</span>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Custom Countdowns
// ---------------------------------------------------------------------------

function CountdownCard({
  countdown,
  onDelete,
}: {
  countdown: LifeCountdown;
  onDelete: () => void;
}) {
  const absRemaining = Math.abs(countdown.daysRemaining);
  return (
    <div className="landing-module-glass flex items-center gap-3 rounded-2xl border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {countdown.label}
        </p>
        <p className="text-[11px] text-[#5e5d59] dark:text-[#87867f]">
          {countdown.isPast
            ? `${absRemaining} day${absRemaining !== 1 ? "s" : ""} ago`
            : `${absRemaining} day${absRemaining !== 1 ? "s" : ""} left`}
          {" · "}
          {countdown.targetDate}
        </p>
      </div>
      {countdown.isPast && (
        <span className="shrink-0 rounded-full bg-[#e8e6dc] px-2 py-0.5 text-[10px] font-medium text-[#5e5d59] dark:bg-[#3d3d3a] dark:text-[#87867f]">
          Past
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        aria-label={`Delete ${countdown.label}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

function AddCountdownForm({
  onAdd,
  disabled,
}: {
  onAdd: (label: string, targetDate: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");

  function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed || !date) return;
    onAdd(trimmed, date);
    setLabel("");
    setDate("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full rounded-2xl border border-dashed border-[#d1cfc5] py-3 text-[13px] font-medium text-[#5e5d59] transition-colors hover:border-[#c96442] hover:text-[#c96442] disabled:opacity-40 dark:border-[#4d4c48] dark:text-[#87867f] dark:hover:border-[#d97757] dark:hover:text-[#d97757]"
      >
        + Add countdown
      </button>
    );
  }

  return (
    <div className="landing-module-glass space-y-2 rounded-2xl border p-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Countdown name"
        maxLength={100}
        className="w-full rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!label.trim() || !date}
          className="flex-1 rounded-xl border border-[#c96442] bg-[#f5f4ed] py-2 text-[13px] font-semibold text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] disabled:opacity-40 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-[#e8e6dc] py-2 text-[13px] font-medium text-[#5e5d59] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FIRE Tracker
// ---------------------------------------------------------------------------

const FIRE_STAGE_LABELS: Record<FireTrackerData["stage"], string> = {
  building: "Building the foundation",
  growing: "Growing steadily",
  accelerating: "Accelerating",
  approaching: "Freedom is within reach",
  reached: "Financial freedom reached",
};

const FireTrackerSection = React.memo(function FireTrackerSection({
  fire,
  onOpenGoals,
}: {
  fire: FireTrackerData;
  onOpenGoals: () => void;
}) {
  const radius = 50;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const offset = circumference * (1 - Math.min(1, fire.percentComplete / 100));

  return (
    <div className="landing-module-glass rounded-2xl border p-4">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">
        FIRE Tracker
      </h3>
      <div className="mt-3 flex items-center gap-4">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90 shrink-0">
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-[#e8e6dc] dark:text-[#3d3d3a]"
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-emerald-500 transition-all duration-500 dark:text-emerald-400"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {fire.percentComplete.toFixed(1)}%
          </p>
          <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            {FIRE_STAGE_LABELS[fire.stage]}
          </p>
          {fire.projectedYearsToTarget != null && (
            <p className="mt-0.5 text-[11px] text-[#5e5d59] dark:text-[#87867f]">
              ~{fire.projectedYearsToTarget.toFixed(1)} years to target
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatTile
          label="Saved"
          value={formatCurrency(fire.savingsCurrent)}
        />
        <StatTile
          label="Target"
          value={formatCurrency(fire.targetAmount)}
        />
        <StatTile
          label="Monthly"
          value={formatCurrency(fire.monthlyContribution)}
        />
        <StatTile
          label="Return"
          value={`${fire.annualReturnPct}% / yr`}
        />
      </div>
      <button
        type="button"
        onClick={onOpenGoals}
        className="mt-3 w-full rounded-xl border border-[#e8e6dc] py-2 text-[12px] font-medium text-[#5e5d59] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]"
      >
        Edit FIRE settings
      </button>
    </div>
  );
});

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-2.5 py-2 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-[#5e5d59] dark:text-[#87867f]">{label}</p>
    </div>
  );
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Birthday Onboarding
// ---------------------------------------------------------------------------

function BirthdayOnboarding({
  onSetBirthday,
}: {
  onSetBirthday: (birthday: string) => void;
}) {
  const [dateInput, setDateInput] = useState("");

  function handleSave() {
    if (!dateInput) return;
    const d = new Date(dateInput + "T00:00:00Z");
    if (isNaN(d.getTime()) || d >= new Date()) return;
    onSetBirthday(dateInput);
  }

  return (
    <div className="landing-module-glass flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-[#c96442] dark:text-[#d97757]">
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
      <h3 className="font-serif text-lg font-medium text-foreground">
        See your life in weeks
      </h3>
      <p className="max-w-xs text-[12px] leading-relaxed text-[#5e5d59] dark:text-[#87867f]">
        Enter your date of birth to visualize your life as a grid of weeks.
        This data stays private and is only used for the calendar.
      </p>
      <input
        type="date"
        value={dateInput}
        onChange={(e) => setDateInput(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="w-full max-w-[200px] rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-center text-[14px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#30302e]"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!dateInput}
        className="w-full max-w-[200px] rounded-xl border border-[#c96442] bg-[#f5f4ed] py-2.5 text-[14px] font-semibold text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] disabled:opacity-40 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
      >
        Save birthday
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tab Component
// ---------------------------------------------------------------------------

export function LandingMobileLifeTab({
  lifeCalendar,
  yearProgress,
  countdowns,
  fireTracker,
  onOpenGoals,
  onAddCountdown,
  onDeleteCountdown,
  onSetBirthday,
}: LandingMobileLifeTabProps) {
  const sortedCountdowns = useMemo(
    () =>
      [...countdowns].sort((a, b) => {
        if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
        return a.daysRemaining - b.daysRemaining;
      }),
    [countdowns],
  );

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex justify-center">
          <GoalConfigPill
            label={
              lifeCalendar.birthday
                ? `Life expectancy: ${lifeCalendar.lifeExpectancyYears} yr`
                : "Set birthday"
            }
            onClick={onOpenGoals}
          />
        </div>
        <h2 className="text-xl font-bold text-foreground">Life Calendar</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Visualize your time. Make every week count.
        </p>
      </div>

      {/* Life Calendar Grid */}
      {lifeCalendar.birthday ? (
        <LifeCalendarGrid
          weeksLived={lifeCalendar.weeksLived}
          weeksTotal={lifeCalendar.weeksTotal}
          percentLived={lifeCalendar.percentLived}
        />
      ) : (
        <BirthdayOnboarding onSetBirthday={onSetBirthday} />
      )}

      {/* Year Progress */}
      <YearProgressRing yearProgress={yearProgress} />

      {/* Custom Countdowns */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">
          Countdowns
        </h3>
        {sortedCountdowns.map((cd) => (
          <CountdownCard
            key={cd.id}
            countdown={cd}
            onDelete={() => onDeleteCountdown(cd.id)}
          />
        ))}
        <AddCountdownForm
          onAdd={onAddCountdown}
          disabled={countdowns.length >= 5}
        />
      </div>

      {/* FIRE Tracker */}
      {fireTracker ? (
        <FireTrackerSection fire={fireTracker} onOpenGoals={onOpenGoals} />
      ) : (
        <div className="landing-module-glass flex flex-col items-center gap-2 rounded-2xl border px-4 py-6 text-center">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#87867f]">
            FIRE Tracker
          </h3>
          <p className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">
            Track your progress toward financial independence.
          </p>
          <button
            type="button"
            onClick={onOpenGoals}
            className="mt-1 rounded-xl border border-[#c96442] bg-[#f5f4ed] px-4 py-2 text-[13px] font-semibold text-[#4d4c48] transition-colors hover:bg-[#e8e6dc] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5] dark:hover:bg-[#3d3d3a]"
          >
            Set up FIRE goals
          </button>
        </div>
      )}
    </div>
  );
}
