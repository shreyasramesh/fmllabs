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

const QUOTES = [
  { text: "The bad news is time flies. The good news is you\u2019re the pilot.", author: "Michael Altshuler" },
  { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius" },
  { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "The trouble is, you think you have time.", author: "Jack Kornfield" },
  { text: "The cost of a thing is the amount of life you exchange for it.", author: "Henry David Thoreau" },
];

const FIRE_STAGES: Record<string, string> = {
  building: "Building the foundation",
  growing: "Growing steadily",
  accelerating: "Accelerating",
  approaching: "Freedom is within reach",
  reached: "Financial freedom reached",
};

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════

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
  const hasBirthday = !!lifeCalendar.birthday;

  const yearsLived = useMemo(() => {
    if (!lifeCalendar.birthday) return 0;
    return (Date.now() - new Date(lifeCalendar.birthday + "T00:00:00").getTime()) / (365.25 * 24 * 3600_000);
  }, [lifeCalendar.birthday]);

  const stats = useMemo(() => {
    if (!lifeCalendar.birthday) return null;
    const bMs = new Date(lifeCalendar.birthday + "T00:00:00").getTime();
    const daysLived = Math.floor((Date.now() - bMs) / 86_400_000);
    const totalDays = Math.round(lifeCalendar.lifeExpectancyYears * 365.25);
    return { daysLived, hoursLived: daysLived * 24, daysRemaining: Math.max(0, totalDays - daysLived) };
  }, [lifeCalendar.birthday, lifeCalendar.lifeExpectancyYears]);

  const sorted = useMemo(
    () => [...countdowns].sort((a, b) => (a.isPast !== b.isPast ? (a.isPast ? 1 : -1) : a.daysRemaining - b.daysRemaining)),
    [countdowns],
  );

  if (!hasBirthday) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-8">
        <div className="flex justify-center">
          <GoalConfigPill label="Set birthday" onClick={onOpenGoals} />
        </div>
        <BirthdaySetup onSave={onSetBirthday} />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      {/* Settings pill */}
      <div className="flex justify-center px-4 pb-2">
        <GoalConfigPill
          label={`Life expectancy: ${lifeCalendar.lifeExpectancyYears} yr`}
          onClick={onOpenGoals}
        />
      </div>

      {/* ─── Section 1: Today ─── */}
      <TodaySection />

      {/* ─── Section 2: Your Life in Years ─── */}
      <LifeInYears
        lifeExpectancyYears={lifeCalendar.lifeExpectancyYears}
        yearsLived={yearsLived}
      />

      {/* ─── Section 3: Your Life in Weeks ─── */}
      <div className="border-t border-[#e8e6dc] px-5 py-4 dark:border-[#3d3d3a]">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#c96442] dark:text-[#d97757]">
            Your Life in Weeks
          </span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
            Week {lifeCalendar.weeksLived.toLocaleString()} of {lifeCalendar.weeksTotal.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
            <div
              className="h-full rounded-full bg-[#c96442] dark:bg-[#d97757]"
              style={{ width: `${Math.min(100, lifeCalendar.percentLived)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-foreground">
            {lifeCalendar.percentLived.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ─── Section 4: Year Progress ─── */}
      <YearProgress yearProgress={yearProgress} />

      {/* ─── Section 5: Your Life in Numbers ─── */}
      {stats && (
        <LifeInNumbers
          daysLived={stats.daysLived}
          hoursLived={stats.hoursLived}
          weeksLived={lifeCalendar.weeksLived}
          percentLived={lifeCalendar.percentLived}
          daysRemaining={stats.daysRemaining}
        />
      )}

      {/* ─── Section 6: Quote ─── */}
      <QuoteBar />

      {/* ─── Section 7: Countdowns ─── */}
      <div className="border-t border-[#e8e6dc] px-5 py-4 dark:border-[#3d3d3a]">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c96442] dark:text-[#d97757]">
          Events
        </p>
        {sorted.length === 0 && (
          <p className="py-3 text-center text-[12px] text-[#87867f]">No events yet</p>
        )}
        <div className="space-y-2">
          {sorted.map((cd) => (
            <CountdownRow key={cd.id} cd={cd} onDelete={() => onDeleteCountdown(cd.id)} />
          ))}
          <AddCountdown onAdd={onAddCountdown} disabled={countdowns.length >= 5} />
        </div>
      </div>

      {/* ─── Section 8: FIRE Tracker ─── */}
      <div className="border-t border-[#e8e6dc] px-5 py-4 dark:border-[#3d3d3a]">
        {fireTracker ? (
          <FireCard fire={fireTracker} onEdit={onOpenGoals} />
        ) : (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c96442] dark:text-[#d97757]">
              FIRE Tracker
            </p>
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-[12px] text-[#87867f]">Track your path to financial independence</p>
              <button
                type="button"
                onClick={onOpenGoals}
                className="rounded-xl bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97]"
              >
                Set up FIRE goals
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── CTA ─── */}
      <div className="px-5 pt-2 pb-2">
        <button
          type="button"
          onClick={onOpenGoals}
          className="w-full rounded-2xl bg-[#faf9f5] py-4 text-center text-[16px] font-bold text-[#141413] shadow-sm transition-all active:scale-[0.98] dark:bg-[#30302e] dark:text-[#faf9f5]"
        >
          Let&apos;s Make Them Count
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Today section — daily stoic prompt
// ═══════════════════════════════════════════════════════════════════════════

function TodaySection() {
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="border-t border-[#e8e6dc] px-5 py-5 dark:border-[#3d3d3a]">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground">Today</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#5e5d59] dark:text-[#b0aea5]">
        Today is {dayName}. Choose one hour &mdash; just one &mdash; to be completely present.
        No phone. No autopilot. See what happens.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Your Life in Years — dot grid, 10 columns
// ═══════════════════════════════════════════════════════════════════════════

function LifeInYears({ lifeExpectancyYears, yearsLived }: { lifeExpectancyYears: number; yearsLived: number }) {
  const cur = Math.floor(yearsLived);
  const ahead = Math.max(0, lifeExpectancyYears - cur - 1);
  const cols = 10;
  const dotSize = lifeExpectancyYears > 100 ? 18 : 22;
  const gap = lifeExpectancyYears > 100 ? 4 : 5;

  return (
    <div className="border-t border-[#e8e6dc] px-5 py-5 dark:border-[#3d3d3a]">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c96442] dark:text-[#d97757]">
        Your Life in Years
      </p>
      <div
        className="mx-auto grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${dotSize}px)`,
          gap: `${gap}px`,
          maxWidth: cols * (dotSize + gap) + "px",
        }}
      >
        {Array.from({ length: lifeExpectancyYears }, (_, i) => {
          const lived = i < cur;
          const thisYear = i === cur;
          return (
            <span
              key={i}
              className={`block rounded-full transition-colors ${
                lived
                  ? "bg-foreground"
                  : thisYear
                    ? "bg-foreground/50 ring-[1.5px] ring-foreground/30"
                    : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
              }`}
              style={{ width: dotSize, height: dotSize }}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-center gap-5 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
          <span className="text-[#87867f]">Years lived ({cur})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground/50 ring-1 ring-foreground/30" />
          <span className="text-[#87867f]">This year</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]" />
          <span className="text-[#87867f]">Ahead ({ahead})</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Year Progress — toggleable hero + week dot grid
// ═══════════════════════════════════════════════════════════════════════════

function YearProgress({ yearProgress }: { yearProgress: YearProgressData }) {
  const [mode, setMode] = useState<"pct" | "days">("pct");
  const year = new Date().getFullYear();
  const rem = yearProgress.daysInYear - yearProgress.dayOfYear;
  const pct = yearProgress.percentElapsed;
  const curWeek = Math.ceil(yearProgress.dayOfYear / 7);
  const totalWeeks = Math.ceil(yearProgress.daysInYear / 7);
  const barPct = (yearProgress.dayOfYear / yearProgress.daysInYear) * 100;
  const toggle = () => setMode((m) => (m === "pct" ? "days" : "pct"));

  return (
    <div className="border-t border-[#e8e6dc] px-5 py-5 dark:border-[#3d3d3a]">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[#e8e6dc] px-2.5 py-0.5 text-[11px] font-bold text-foreground dark:border-[#3d3d3a]">
          {year}
        </span>
        <button
          type="button"
          onClick={toggle}
          className="rounded-full p-1 text-[#87867f] transition-colors hover:text-foreground active:scale-90"
          aria-label="Toggle"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <button type="button" onClick={toggle} className="mt-2 flex w-full flex-col items-center py-1">
        <span className="text-[56px] font-black tabular-nums leading-none tracking-tight text-foreground">
          {mode === "pct" ? `${Math.round(pct)}%` : rem}
        </span>
        <span className="mt-1 text-[12px] text-[#87867f]">
          {mode === "pct" ? "of the year complete" : "days remaining"}
        </span>
      </button>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${barPct}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-[2.5px]">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const w = i + 1;
          const isCur = w === curWeek;
          const isLived = w < curWeek;
          return (
            <span
              key={i}
              className={`block h-[7px] w-[7px] rounded-full ${
                isCur
                  ? "bg-[#c96442] shadow-[0_0_6px_2px_rgba(201,100,66,0.45)] dark:bg-[#d97757] dark:shadow-[0_0_6px_2px_rgba(217,119,87,0.45)]"
                  : isLived
                    ? "bg-foreground/75"
                    : "bg-[#e8e6dc]/70 dark:bg-[#3d3d3a]/70"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Your Life in Numbers
// ═══════════════════════════════════════════════════════════════════════════

function LifeInNumbers({
  daysLived,
  hoursLived,
  weeksLived,
  percentLived,
  daysRemaining,
}: {
  daysLived: number;
  hoursLived: number;
  weeksLived: number;
  percentLived: number;
  daysRemaining: number;
}) {
  return (
    <div className="border-t border-[#e8e6dc] px-5 py-6 dark:border-[#3d3d3a]">
      <div className="mb-5 text-center">
        <p className="font-serif text-[20px] font-bold text-foreground">Your Life</p>
        <p className="text-[12px] text-[#87867f]">in numbers</p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <BigStat value={daysLived.toLocaleString()} label="days lived" />
        <BigStat value={hoursLived.toLocaleString()} label="hours experienced" />
        <BigStat value={weeksLived.toLocaleString()} label="weeks behind you" />

        <div className="flex flex-col items-center gap-1">
          <span className="text-[40px] font-black tabular-nums leading-none text-foreground">
            {percentLived.toFixed(0)}%
          </span>
          <span className="text-[12px] text-[#87867f]">of your life has passed</span>
          <div className="mt-1.5 h-1 w-[140px] overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, percentLived)}%` }} />
          </div>
        </div>

        <p className="font-mono text-[12px] tabular-nums text-[#87867f]">
          {daysRemaining.toLocaleString()} days remaining
        </p>
      </div>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[32px] font-black tabular-nums leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[12px] text-[#87867f]">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Quote bar
// ═══════════════════════════════════════════════════════════════════════════

function QuoteBar() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const q = QUOTES[idx % QUOTES.length]!;
  return (
    <div className="flex items-center gap-2 border-t border-[#e8e6dc] px-4 py-3 dark:border-[#3d3d3a]">
      <button type="button" onClick={() => setIdx((i) => (i - 1 + QUOTES.length) % QUOTES.length)} className="shrink-0 p-0.5 text-[#87867f] active:scale-90" aria-label="Previous">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-[11px] italic leading-snug text-[#5e5d59] dark:text-[#b0aea5]">&ldquo;{q.text}&rdquo;</p>
        <p className="mt-0.5 text-[10px] text-[#87867f]">&mdash; {q.author}</p>
      </div>
      <button type="button" onClick={() => setIdx((i) => (i + 1) % QUOTES.length)} className="shrink-0 p-0.5 text-[#87867f] active:scale-90" aria-label="Next">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Countdowns
// ═══════════════════════════════════════════════════════════════════════════

function CountdownRow({ cd, onDelete }: { cd: LifeCountdown; onDelete: () => void }) {
  const abs = Math.abs(cd.daysRemaining);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#e8e6dc] px-3 py-2.5 dark:border-[#3d3d3a]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{cd.label}</p>
        <p className="text-[10px] text-[#87867f]">
          {cd.isPast ? `${abs}d ago` : `${abs}d left`} &middot; {cd.targetDate}
        </p>
      </div>
      {cd.isPast && <span className="rounded-full bg-[#e8e6dc] px-1.5 py-0.5 text-[9px] font-medium text-[#87867f] dark:bg-[#3d3d3a]">Past</span>}
      <button type="button" onClick={onDelete} className="shrink-0 p-0.5 text-neutral-400 hover:text-red-500 active:scale-90" aria-label="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
      </button>
    </div>
  );
}

function AddCountdown({ onAdd, disabled }: { onAdd: (l: string, d: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="w-full rounded-xl border border-dashed border-[#d1cfc5] py-2.5 text-[12px] font-medium text-[#87867f] transition-colors hover:border-[#c96442] hover:text-[#c96442] disabled:opacity-40 dark:border-[#4d4c48] dark:hover:border-[#d97757] dark:hover:text-[#d97757]">
        + Add event
      </button>
    );
  }
  const save = () => { if (label.trim() && date) { onAdd(label.trim(), date); setLabel(""); setDate(""); setOpen(false); } };
  return (
    <div className="space-y-2 rounded-xl border border-[#e8e6dc] p-2.5 dark:border-[#3d3d3a]">
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Event name" maxLength={100} autoFocus className="w-full rounded-lg border border-[#e8e6dc] bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-[#e8e6dc] bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={!label.trim() || !date} className="flex-1 rounded-lg bg-foreground py-1.5 text-[12px] font-semibold text-background disabled:opacity-40">Save</button>
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-[#e8e6dc] py-1.5 text-[12px] text-[#87867f] dark:border-[#3d3d3a]">Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRE Card
// ═══════════════════════════════════════════════════════════════════════════

function FireCard({ fire, onEdit }: { fire: FireTrackerData; onEdit: () => void }) {
  const r = 40, sw = 7, nr = r - sw / 2, c = 2 * Math.PI * nr;
  const off = c * (1 - Math.min(1, fire.percentComplete / 100));
  return (
    <>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c96442] dark:text-[#d97757]">
        FIRE Tracker
      </p>
      <div className="flex items-center gap-3">
        <svg height={r * 2} width={r * 2} className="-rotate-90 shrink-0">
          <circle stroke="currentColor" fill="transparent" strokeWidth={sw} r={nr} cx={r} cy={r} className="text-[#e8e6dc] dark:text-[#3d3d3a]" />
          <circle stroke="currentColor" fill="transparent" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={off} r={nr} cx={r} cy={r} className="text-emerald-500 dark:text-emerald-400" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black tabular-nums text-foreground">{fire.percentComplete.toFixed(1)}%</p>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{FIRE_STAGES[fire.stage]}</p>
          {fire.projectedYearsToTarget != null && (
            <p className="text-[10px] text-[#87867f]">~{fire.projectedYearsToTarget.toFixed(1)} yr to target</p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        {([["Saved", fmt$(fire.savingsCurrent)], ["Target", fmt$(fire.targetAmount)], ["Monthly", fmt$(fire.monthlyContribution)], ["Return", `${fire.annualReturnPct}%`]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg bg-[#f0eee6]/60 px-1 py-1.5 dark:bg-[#3d3d3a]/40">
            <p className="text-[11px] font-bold tabular-nums text-foreground">{v}</p>
            <p className="text-[9px] text-[#87867f]">{l}</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={onEdit} className="mt-3 w-full rounded-lg border border-[#e8e6dc] py-1.5 text-[11px] font-medium text-[#87867f] transition-colors hover:bg-[#f0eee6] active:scale-[0.98] dark:border-[#3d3d3a] dark:hover:bg-[#3d3d3a]">
        Edit FIRE settings
      </button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Birthday setup
// ═══════════════════════════════════════════════════════════════════════════

function BirthdaySetup({ onSave }: { onSave: (b: string) => void }) {
  const [val, setVal] = useState("");
  const submit = () => { if (!val) return; const d = new Date(val + "T00:00:00Z"); if (!isNaN(d.getTime()) && d < new Date()) onSave(val); };
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-[#c96442] dark:text-[#d97757]">
        <path d="M5 22h14" /><path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
      <div>
        <p className="font-serif text-xl font-bold text-foreground">See your life in weeks</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#87867f]">
          Enter your birthday to unlock the life calendar.
          <br />Your data stays completely private.
        </p>
      </div>
      <input type="date" value={val} onChange={(e) => setVal(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full max-w-[200px] rounded-xl border border-[#e8e6dc] bg-background px-3 py-2.5 text-center text-[14px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <button type="button" onClick={submit} disabled={!val} className="w-full max-w-[200px] rounded-xl bg-foreground py-3 text-[14px] font-bold text-background transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-40">
        Save birthday
      </button>
    </div>
  );
}
