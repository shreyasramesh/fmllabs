"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  { text: "The bad news is time flies. The good news is you're the pilot.", author: "Michael Altshuler" },
  { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca" },
  { text: "The cost of a thing is the amount of life you exchange for it.", author: "Henry David Thoreau" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius" },
  { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "The trouble is, you think you have time.", author: "Jack Kornfield" },
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

// ---------------------------------------------------------------------------
// Main Tab
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
  const hasBirthday = !!lifeCalendar.birthday;

  const yearsLived = useMemo(() => {
    if (!lifeCalendar.birthday) return 0;
    return (Date.now() - new Date(lifeCalendar.birthday + "T00:00:00").getTime()) / (365.25 * 24 * 3600_000);
  }, [lifeCalendar.birthday]);

  const lifeStats = useMemo(() => {
    if (!lifeCalendar.birthday) return null;
    const bMs = new Date(lifeCalendar.birthday + "T00:00:00").getTime();
    const daysLived = Math.floor((Date.now() - bMs) / 86_400_000);
    const totalDays = Math.round(lifeCalendar.lifeExpectancyYears * 365.25);
    return {
      daysLived,
      hoursLived: daysLived * 24,
      daysRemaining: Math.max(0, totalDays - daysLived),
    };
  }, [lifeCalendar.birthday, lifeCalendar.lifeExpectancyYears]);

  const sorted = useMemo(
    () => [...countdowns].sort((a, b) => (a.isPast !== b.isPast ? (a.isPast ? 1 : -1) : a.daysRemaining - b.daysRemaining)),
    [countdowns],
  );

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <div className="flex justify-center">
        <GoalConfigPill
          label={hasBirthday ? `Life expectancy: ${lifeCalendar.lifeExpectancyYears} yr` : "Set birthday"}
          onClick={onOpenGoals}
        />
      </div>

      {hasBirthday ? (
        <>
          {/* ── Year Progress ── */}
          <YearHero yearProgress={yearProgress} />

          {/* ── Life Overview ── */}
          <Section label="Your Life">
            <LifeDotsRow
              lifeExpectancyYears={lifeCalendar.lifeExpectancyYears}
              yearsLived={yearsLived}
            />
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar pct={lifeCalendar.percentLived} accent />
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">
                {lifeCalendar.percentLived.toFixed(1)}%
              </span>
            </div>
            <p className="mt-1.5 text-center text-[11px] tabular-nums text-[#87867f]">
              Week {lifeCalendar.weeksLived.toLocaleString()} of {lifeCalendar.weeksTotal.toLocaleString()}
            </p>
          </Section>

          {/* ── Life in Numbers ── */}
          {lifeStats && (
            <Section label="In Numbers">
              <div className="grid grid-cols-3 gap-2">
                <NumTile value={lifeStats.daysLived.toLocaleString()} unit="days" />
                <NumTile value={lifeStats.hoursLived.toLocaleString()} unit="hours" />
                <NumTile value={lifeCalendar.weeksLived.toLocaleString()} unit="weeks" />
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
                <span className="text-[20px] font-black tabular-nums text-foreground">
                  {lifeStats.daysRemaining.toLocaleString()}
                </span>
                <span className="text-[12px] text-[#87867f]">days remaining</span>
              </div>
            </Section>
          )}

          {/* ── Quote ── */}
          <QuoteStrip />

          {/* ── Countdowns ── */}
          <Section label="Countdowns">
            {sorted.length === 0 && (
              <p className="py-2 text-center text-[12px] text-[#87867f]">No countdowns yet</p>
            )}
            {sorted.map((cd) => (
              <CountdownRow key={cd.id} cd={cd} onDelete={() => onDeleteCountdown(cd.id)} />
            ))}
            <AddCountdown onAdd={onAddCountdown} disabled={countdowns.length >= 5} />
          </Section>

          {/* ── FIRE ── */}
          {fireTracker ? (
            <FireCard fire={fireTracker} onEdit={onOpenGoals} />
          ) : (
            <Section label="FIRE Tracker">
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-[12px] text-[#87867f]">Track your path to financial independence</p>
                <button
                  type="button"
                  onClick={onOpenGoals}
                  className="rounded-xl border border-[#c96442] bg-[#f5f4ed] px-4 py-2 text-[13px] font-semibold text-[#4d4c48] transition-all hover:bg-[#e8e6dc] active:scale-[0.97] dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5]"
                >
                  Set up FIRE goals
                </button>
              </div>
            </Section>
          )}
        </>
      ) : (
        <BirthdaySetup onSave={onSetBirthday} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#87867f]">{label}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ pct, accent }: { pct: number; accent?: boolean }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8e6dc] dark:bg-[#3d3d3a]">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${
          accent ? "bg-[#c96442] dark:bg-[#d97757]" : "bg-foreground"
        }`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function NumTile({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-2 py-2.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <span className="text-[15px] font-bold tabular-nums leading-tight text-foreground">{value}</span>
      <span className="text-[10px] text-[#87867f]">{unit}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year Hero
// ---------------------------------------------------------------------------

function YearHero({ yearProgress }: { yearProgress: YearProgressData }) {
  const [mode, setMode] = useState<"pct" | "days">("pct");
  const year = new Date().getFullYear();
  const rem = yearProgress.daysInYear - yearProgress.dayOfYear;
  const pct = yearProgress.percentElapsed;
  const curWeek = Math.ceil(yearProgress.dayOfYear / 7);
  const totalWeeks = Math.ceil(yearProgress.daysInYear / 7);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[#e8e6dc] px-2.5 py-0.5 text-[11px] font-semibold text-foreground dark:border-[#3d3d3a]">
          {year}
        </span>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "pct" ? "days" : "pct"))}
          className="rounded-full p-1 text-[#87867f] transition-all hover:text-foreground active:scale-90"
          aria-label="Toggle view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <button type="button" onClick={() => setMode((m) => (m === "pct" ? "days" : "pct"))} className="flex w-full flex-col items-center gap-0.5 py-1">
        <span className="text-5xl font-black tabular-nums tracking-tight text-foreground transition-all duration-300">
          {mode === "pct" ? `${Math.round(pct)}%` : rem}
        </span>
        <span className="text-[12px] text-[#87867f]">
          {mode === "pct" ? "of the year complete" : "days remaining"}
        </span>
      </button>

      <ProgressBar pct={pct} />

      <div className="flex flex-wrap justify-center gap-[2px]">
        {Array.from({ length: totalWeeks }, (_, i) => {
          const w = i + 1;
          const cur = w === curWeek;
          const lived = w < curWeek;
          return (
            <span
              key={i}
              className={`block h-[6px] w-[6px] rounded-full ${
                cur
                  ? "bg-[#c96442] shadow-[0_0_5px_1px_rgba(201,100,66,0.5)] dark:bg-[#d97757] dark:shadow-[0_0_5px_1px_rgba(217,119,87,0.5)]"
                  : lived
                    ? "bg-foreground/70"
                    : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Life Dots Row — one dot per year, compact
// ---------------------------------------------------------------------------

function LifeDotsRow({ lifeExpectancyYears, yearsLived }: { lifeExpectancyYears: number; yearsLived: number }) {
  const cur = Math.floor(yearsLived);
  return (
    <div className="flex flex-wrap justify-center gap-[4px]">
      {Array.from({ length: lifeExpectancyYears }, (_, i) => {
        const lived = i < cur;
        const thisYear = i === cur;
        return (
          <span
            key={i}
            className={`block h-[10px] w-[10px] rounded-full ${
              lived
                ? "bg-[#c96442] dark:bg-[#d97757]"
                : thisYear
                  ? "bg-[#c96442]/60 ring-1 ring-[#c96442]/30 dark:bg-[#d97757]/60 dark:ring-[#d97757]/30"
                  : "bg-[#e8e6dc] dark:bg-[#3d3d3a]"
            }`}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quote Strip
// ---------------------------------------------------------------------------

function QuoteStrip() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const q = QUOTES[idx % QUOTES.length]!;
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[#e8e6dc] bg-[#faf9f5]/80 px-2.5 py-2.5 dark:border-[#3d3d3a] dark:bg-[#30302e]/80">
      <button type="button" onClick={() => setIdx((i) => (i - 1 + QUOTES.length) % QUOTES.length)} className="shrink-0 p-0.5 text-[#87867f] active:scale-90" aria-label="Previous">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-[11px] italic leading-snug text-[#4d4c48] dark:text-[#b0aea5]">&ldquo;{q.text}&rdquo;</p>
        <p className="mt-0.5 text-[10px] text-[#87867f]">&mdash; {q.author}</p>
      </div>
      <button type="button" onClick={() => setIdx((i) => (i + 1) % QUOTES.length)} className="shrink-0 p-0.5 text-[#87867f] active:scale-90" aria-label="Next">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

function CountdownRow({ cd, onDelete }: { cd: LifeCountdown; onDelete: () => void }) {
  const abs = Math.abs(cd.daysRemaining);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-3 py-2.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{cd.label}</p>
        <p className="text-[11px] text-[#87867f]">
          {cd.isPast ? `${abs}d ago` : `${abs}d left`} · {cd.targetDate}
        </p>
      </div>
      {cd.isPast && <span className="rounded-full bg-[#e8e6dc] px-1.5 py-0.5 text-[9px] font-medium text-[#87867f] dark:bg-[#3d3d3a]">Past</span>}
      <button type="button" onClick={onDelete} className="shrink-0 p-0.5 text-neutral-400 transition-colors hover:text-red-500 active:scale-90" aria-label="Delete">
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
        + Add countdown
      </button>
    );
  }
  const save = () => { if (label.trim() && date) { onAdd(label.trim(), date); setLabel(""); setDate(""); setOpen(false); } };
  return (
    <div className="space-y-2 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] p-2.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" maxLength={100} autoFocus className="w-full rounded-lg border border-[#e8e6dc] bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-[#e8e6dc] bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={!label.trim() || !date} className="flex-1 rounded-lg border border-[#c96442] bg-[#f5f4ed] py-1.5 text-[12px] font-semibold text-[#4d4c48] disabled:opacity-40 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5]">Save</button>
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-[#e8e6dc] py-1.5 text-[12px] text-[#87867f] dark:border-[#3d3d3a]">Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FIRE Card
// ---------------------------------------------------------------------------

function FireCard({ fire, onEdit }: { fire: FireTrackerData; onEdit: () => void }) {
  const r = 44, sw = 8, nr = r - sw / 2, c = 2 * Math.PI * nr;
  const off = c * (1 - Math.min(1, fire.percentComplete / 100));
  return (
    <Section label="FIRE Tracker">
      <div className="rounded-xl border border-[#e8e6dc] bg-[#faf9f5] p-3.5 dark:border-[#3d3d3a] dark:bg-[#30302e]">
        <div className="flex items-center gap-3">
          <svg height={r * 2} width={r * 2} className="-rotate-90 shrink-0">
            <circle stroke="currentColor" fill="transparent" strokeWidth={sw} r={nr} cx={r} cy={r} className="text-[#e8e6dc] dark:text-[#3d3d3a]" />
            <circle stroke="currentColor" fill="transparent" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={off} r={nr} cx={r} cy={r} className="text-emerald-500 dark:text-emerald-400" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tabular-nums text-foreground">{fire.percentComplete.toFixed(1)}%</p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{FIRE_STAGES[fire.stage]}</p>
            {fire.projectedYearsToTarget != null && (
              <p className="text-[10px] text-[#87867f]">~{fire.projectedYearsToTarget.toFixed(1)} yr to target</p>
            )}
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          <MiniTile label="Saved" val={fmt$(fire.savingsCurrent)} />
          <MiniTile label="Target" val={fmt$(fire.targetAmount)} />
          <MiniTile label="Monthly" val={fmt$(fire.monthlyContribution)} />
          <MiniTile label="Return" val={`${fire.annualReturnPct}%`} />
        </div>
        <button type="button" onClick={onEdit} className="mt-2.5 w-full rounded-lg border border-[#e8e6dc] py-1.5 text-[11px] font-medium text-[#87867f] transition-colors hover:bg-[#f0eee6] active:scale-[0.98] dark:border-[#3d3d3a] dark:hover:bg-[#3d3d3a]">
          Edit FIRE settings
        </button>
      </div>
    </Section>
  );
}

function MiniTile({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-lg bg-[#f0eee6]/60 px-1.5 py-1.5 text-center dark:bg-[#141413]/40">
      <p className="text-[11px] font-semibold tabular-nums text-foreground">{val}</p>
      <p className="text-[9px] text-[#87867f]">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Birthday Setup
// ---------------------------------------------------------------------------

function BirthdaySetup({ onSave }: { onSave: (b: string) => void }) {
  const [val, setVal] = useState("");
  const submit = () => { if (!val) return; const d = new Date(val + "T00:00:00Z"); if (!isNaN(d.getTime()) && d < new Date()) onSave(val); };
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-5 py-10 text-center dark:border-[#3d3d3a] dark:bg-[#30302e]">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-[#c96442] dark:text-[#d97757]">
        <path d="M5 22h14" /><path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
      <div>
        <h3 className="font-serif text-lg font-medium text-foreground">See your life in weeks</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[#87867f]">Enter your date of birth to unlock the life calendar. Your data stays private.</p>
      </div>
      <input type="date" value={val} onChange={(e) => setVal(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full max-w-[200px] rounded-xl border border-[#e8e6dc] bg-background px-3 py-2 text-center text-[14px] outline-none focus:border-[#c96442] dark:border-[#3d3d3a]" />
      <button type="button" onClick={submit} disabled={!val} className="w-full max-w-[200px] rounded-xl border border-[#c96442] bg-[#f5f4ed] py-2.5 text-[14px] font-semibold text-[#4d4c48] transition-all hover:bg-[#e8e6dc] active:scale-[0.97] disabled:opacity-40 dark:border-[#d97757] dark:bg-[#30302e] dark:text-[#b0aea5]">
        Save birthday
      </button>
    </div>
  );
}
