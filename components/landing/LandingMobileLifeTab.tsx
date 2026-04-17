"use client";

import React, { useState, useMemo, useCallback } from "react";
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

const LIFE_QUOTES = [
  { text: "The bad news is time flies. The good news is you're the pilot.", author: "Michael Altshuler" },
  { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca" },
  { text: "The cost of a thing is the amount of life you exchange for it.", author: "Henry David Thoreau" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius" },
  { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "The trouble is, you think you have time.", author: "Jack Kornfield" },
];

// ---------------------------------------------------------------------------
// Your Life in Years — dot grid (10 columns, ~8 rows for 80yr)
// ---------------------------------------------------------------------------

const LifeInYearsGrid = React.memo(function LifeInYearsGrid({
  lifeExpectancyYears,
  yearsLived,
}: {
  lifeExpectancyYears: number;
  yearsLived: number;
}) {
  const cols = 10;
  const currentYearIndex = Math.floor(yearsLived);
  const aheadYears = lifeExpectancyYears - currentYearIndex - 1;

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f] dark:text-[#87867f]">
        Your Life in Years
      </h3>
      <div
        className="grid justify-center gap-[6px]"
        style={{ gridTemplateColumns: `repeat(${cols}, 24px)` }}
      >
        {Array.from({ length: lifeExpectancyYears }, (_, i) => {
          const isLived = i < currentYearIndex;
          const isThisYear = i === currentYearIndex;
          return (
            <span
              key={i}
              className={`block h-6 w-6 rounded-full transition-colors ${
                isLived
                  ? "bg-[#c96442] dark:bg-[#d97757]"
                  : isThisYear
                    ? "bg-[#c96442]/70 ring-2 ring-[#c96442]/40 dark:bg-[#d97757]/70 dark:ring-[#d97757]/40"
                    : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
              }`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c96442] dark:bg-[#d97757]" />
          <span className="text-[#5e5d59] dark:text-[#87867f]">Years lived ({currentYearIndex})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c96442]/70 ring-1 ring-[#c96442]/40 dark:bg-[#d97757]/70 dark:ring-[#d97757]/40" />
          <span className="text-[#5e5d59] dark:text-[#87867f]">This year</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]" />
          <span className="text-[#5e5d59] dark:text-[#87867f]">Ahead ({Math.max(0, aheadYears)})</span>
        </span>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Your Life in Weeks — compact counter
// ---------------------------------------------------------------------------

function LifeInWeeksCounter({
  weeksLived,
  weeksTotal,
}: {
  weeksLived: number;
  weeksTotal: number;
}) {
  return (
    <div className="flex items-baseline justify-between rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f]">
        Your Life in Weeks
      </span>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
        Week {weeksLived.toLocaleString()} of {weeksTotal.toLocaleString()}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your Life in Numbers — large stat cards
// ---------------------------------------------------------------------------

function LifeInNumbers({
  weeksLived,
  percentLived,
  birthday,
  lifeExpectancyYears,
}: {
  weeksLived: number;
  percentLived: number;
  birthday: string;
  lifeExpectancyYears: number;
}) {
  const birthdayMs = new Date(birthday + "T00:00:00").getTime();
  const nowMs = Date.now();
  const daysLived = Math.floor((nowMs - birthdayMs) / (24 * 60 * 60 * 1000));
  const hoursExperienced = daysLived * 24;
  const totalDays = lifeExpectancyYears * 365.25;
  const daysRemaining = Math.max(0, Math.round(totalDays - daysLived));

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f]">
        Your Life in Numbers
      </h3>
      <div className="space-y-2">
        <BigStatRow value={daysLived.toLocaleString()} label="days lived" />
        <BigStatRow value={hoursExperienced.toLocaleString()} label="hours experienced" />
        <BigStatRow value={weeksLived.toLocaleString()} label="weeks behind you" />
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-4 dark:border-[#3d3d3a] dark:bg-[#30302e]">
          <span className="text-3xl font-black tabular-nums text-foreground">
            {percentLived.toFixed(0)}%
          </span>
          <span className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">
            of your life has passed
          </span>
          <div className="mt-1 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${Math.min(100, percentLived)}%` }}
            />
          </div>
          <span className="mt-1 font-mono text-[12px] tabular-nums text-[#87867f]">
            {daysRemaining.toLocaleString()} days remaining
          </span>
        </div>
      </div>
    </div>
  );
}

function BigStatRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <span className="text-2xl font-black tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[12px] text-[#5e5d59] dark:text-[#87867f]">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year Progress — toggleable hero, progress bar, weeks-of-year dot grid
// ---------------------------------------------------------------------------

const YearProgressSection = React.memo(function YearProgressSection({
  yearProgress,
}: {
  yearProgress: YearProgressData;
}) {
  const [showDaysRemaining, setShowDaysRemaining] = useState(false);
  const year = new Date().getFullYear();
  const daysRemaining = yearProgress.daysInYear - yearProgress.dayOfYear;
  const currentWeek = Math.ceil(yearProgress.dayOfYear / 7);
  const totalWeeks = Math.ceil(yearProgress.daysInYear / 7);
  const progressBarPct = (yearProgress.dayOfYear / yearProgress.daysInYear) * 100;

  const toggle = useCallback(() => setShowDaysRemaining((v) => !v), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[#e8e6dc] bg-[#faf9f5] px-3 py-1 text-[12px] font-semibold text-foreground dark:border-[#3d3d3a] dark:bg-[#30302e]">
          {year}
        </span>
        <button
          type="button"
          onClick={toggle}
          className="rounded-full border border-[#e8e6dc] p-1.5 text-[#5e5d59] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]"
          aria-label="Toggle view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Hero number */}
      <button
        type="button"
        onClick={toggle}
        className="flex w-full flex-col items-center gap-1 py-2"
      >
        <span className="text-6xl font-black tabular-nums tracking-tighter text-foreground">
          {showDaysRemaining ? daysRemaining : `${Math.round(yearProgress.percentElapsed)}%`}
        </span>
        <span className="text-[13px] text-[#5e5d59] dark:text-[#87867f]">
          {showDaysRemaining ? "days remaining" : "of the year complete"}
        </span>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-500"
          style={{ width: `${progressBarPct}%` }}
        />
      </div>

      {/* Weeks-of-year dot grid */}
      <div className="overflow-x-auto py-1">
        <div
          className="mx-auto grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${totalWeeks}, 8px)`,
            maxWidth: totalWeeks * 11 + "px",
          }}
        >
          {Array.from({ length: totalWeeks }, (_, i) => {
            const weekNum = i + 1;
            const isLived = weekNum < currentWeek;
            const isCurrent = weekNum === currentWeek;
            return (
              <span
                key={i}
                className={`block h-2 w-2 rounded-full transition-all ${
                  isCurrent
                    ? "bg-[#c96442] shadow-[0_0_6px_2px_rgba(201,100,66,0.5)] dark:bg-[#d97757] dark:shadow-[0_0_6px_2px_rgba(217,119,87,0.5)]"
                    : isLived
                      ? "bg-foreground/80"
                      : "bg-[#e8e6dc]/60 dark:bg-[#3d3d3a]/60"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Inspirational Quote Carousel
// ---------------------------------------------------------------------------

function QuoteCarousel() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LIFE_QUOTES.length));
  const quote = LIFE_QUOTES[index % LIFE_QUOTES.length]!;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5]/80 px-3 py-3 dark:border-[#3d3d3a] dark:bg-[#30302e]/80">
      <button
        type="button"
        onClick={() => setIndex((i) => (i - 1 + LIFE_QUOTES.length) % LIFE_QUOTES.length)}
        className="shrink-0 p-0.5 text-[#87867f] transition-colors hover:text-foreground"
        aria-label="Previous quote"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="line-clamp-2 text-[12px] italic leading-relaxed text-[#4d4c48] dark:text-[#b0aea5]">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="mt-0.5 text-[11px] text-[#87867f]">
          &mdash; {quote.author}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIndex((i) => (i + 1) % LIFE_QUOTES.length)}
        className="shrink-0 p-0.5 text-[#87867f] transition-colors hover:text-foreground"
        aria-label="Next quote"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

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
    <div className="flex items-center gap-3 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
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
    <div className="space-y-2 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] p-3 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Countdown name"
        maxLength={100}
        className="w-full rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#141413]"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-[13px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#141413]"
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
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f]">
        FIRE Tracker
      </h3>
      <div className="rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] p-4 dark:border-[#3d3d3a] dark:bg-[#30302e]">
        <div className="flex items-center gap-4">
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
          <StatTile label="Saved" value={formatCurrency(fire.savingsCurrent)} />
          <StatTile label="Target" value={formatCurrency(fire.targetAmount)} />
          <StatTile label="Monthly" value={formatCurrency(fire.monthlyContribution)} />
          <StatTile label="Return" value={`${fire.annualReturnPct}% / yr`} />
        </div>
        <button
          type="button"
          onClick={onOpenGoals}
          className="mt-3 w-full rounded-xl border border-[#e8e6dc] py-2 text-[12px] font-medium text-[#5e5d59] transition-colors hover:bg-[#f0eee6] dark:border-[#3d3d3a] dark:text-[#87867f] dark:hover:bg-[#3d3d3a]"
        >
          Edit FIRE settings
        </button>
      </div>
    </div>
  );
});

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e8e6dc] bg-[#faf9f5] px-2.5 py-2 dark:border-[#3d3d3a] dark:bg-[#141413]">
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-8 text-center dark:border-[#3d3d3a] dark:bg-[#30302e]">
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
        className="w-full max-w-[200px] rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2 text-center text-[14px] text-foreground outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/25 dark:border-[#3d3d3a] dark:bg-[#141413]"
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

  const yearsLived = useMemo(() => {
    if (!lifeCalendar.birthday) return 0;
    const bMs = new Date(lifeCalendar.birthday + "T00:00:00").getTime();
    return (Date.now() - bMs) / (365.25 * 24 * 60 * 60 * 1000);
  }, [lifeCalendar.birthday]);

  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      {/* Goal config pill */}
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

      {lifeCalendar.birthday ? (
        <>
          {/* 1. Year Progress — hero section */}
          <YearProgressSection yearProgress={yearProgress} />

          {/* 2. Your Life in Years — dot grid */}
          <LifeInYearsGrid
            lifeExpectancyYears={lifeCalendar.lifeExpectancyYears}
            yearsLived={yearsLived}
          />

          {/* 3. Your Life in Weeks — counter */}
          <LifeInWeeksCounter
            weeksLived={lifeCalendar.weeksLived}
            weeksTotal={lifeCalendar.weeksTotal}
          />

          {/* 4. Your Life in Numbers */}
          <LifeInNumbers
            weeksLived={lifeCalendar.weeksLived}
            percentLived={lifeCalendar.percentLived}
            birthday={lifeCalendar.birthday}
            lifeExpectancyYears={lifeCalendar.lifeExpectancyYears}
          />

          {/* 5. Inspirational Quote */}
          <QuoteCarousel />

          {/* CTA */}
          <button
            type="button"
            onClick={onOpenGoals}
            className="w-full rounded-2xl border-2 border-[#e8e6dc] bg-[#faf9f5] py-3.5 text-[15px] font-bold text-foreground transition-colors active:scale-[0.98] dark:border-[#3d3d3a] dark:bg-[#30302e]"
          >
            Let&apos;s Make Them Count
          </button>
        </>
      ) : (
        <BirthdayOnboarding onSetBirthday={onSetBirthday} />
      )}

      {/* Custom Countdowns */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f]">
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-6 text-center dark:border-[#3d3d3a] dark:bg-[#30302e]">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#87867f]">
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
