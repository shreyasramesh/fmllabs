"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GoalConfigPill } from "@/components/landing/GoalConfigPill";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import type { LandingSleepEntry } from "@/components/landing/types";
import { SleepDurationPicker } from "@/components/landing/SleepDurationPicker";
import { formatSleepDuration, roundSleepHoursToMinute } from "@/lib/sleep-duration";

interface LandingMobileSleepTabProps {
  selectedDayLabel: string;
  sleepEntries: LandingSleepEntry[];
  sleepEntryDayKey: string;
  sleepHabitInsight: string | null;
  sleepHabitInsightLoading?: boolean;
  sleepSaving: boolean;
  sleepSaveError: string | null;
  onSaveSleepEntry: (sleepHours: number, hrvMs: number | null, sleepScore: number | null) => void;
  onViewSleepInsights?: () => void;
  sleepHoursGoal: number;
  onOpenGoals: () => void;
}

export function LandingMobileSleepTab({
  selectedDayLabel,
  sleepEntries,
  sleepEntryDayKey,
  sleepHabitInsight,
  sleepHabitInsightLoading = false,
  sleepSaving,
  sleepSaveError,
  onSaveSleepEntry,
  onViewSleepInsights,
  sleepHoursGoal,
  onOpenGoals,
}: LandingMobileSleepTabProps) {
  const [sleepHoursInput, setSleepHoursInput] = useState(7.5);
  const [hrvInput, setHrvInput] = useState("");
  const [sleepScoreInput, setSleepScoreInput] = useState("");
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);

  const sleepForSelectedDay = useMemo(() => {
    const rows = sleepEntries.filter((e) => e.dayKey === sleepEntryDayKey);
    if (rows.length === 0) return null;
    return rows.slice().sort((a, b) => b.id.localeCompare(a.id))[0]!;
  }, [sleepEntries, sleepEntryDayKey]);

  useEffect(() => {
    if (sleepForSelectedDay) {
      setSleepHoursInput(roundSleepHoursToMinute(sleepForSelectedDay.sleepHours));
      setHrvInput(sleepForSelectedDay.hrvMs != null ? String(sleepForSelectedDay.hrvMs) : "");
      setSleepScoreInput(sleepForSelectedDay.sleepScore != null ? String(sleepForSelectedDay.sleepScore) : "");
    } else {
      setSleepHoursInput(7.5);
      setHrvInput("");
      setSleepScoreInput("");
    }
    setOptionalDetailsOpen(Boolean(sleepForSelectedDay?.hrvMs != null || sleepForSelectedDay?.sleepScore != null));
  }, [
    sleepEntryDayKey,
    sleepForSelectedDay?.id,
    sleepForSelectedDay?.sleepHours,
    sleepForSelectedDay?.hrvMs,
    sleepForSelectedDay?.sleepScore,
  ]);

  function handleSave() {
    const hours = sleepHoursInput;
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) return;
    const hrv = hrvInput.trim() ? parseFloat(hrvInput) : null;
    if (hrv != null && (isNaN(hrv) || hrv < 1 || hrv > 300)) return;
    const score = sleepScoreInput.trim() ? parseFloat(sleepScoreInput) : null;
    if (score != null && (isNaN(score) || score < 1 || score > 100)) return;
    onSaveSleepEntry(
      roundSleepHoursToMinute(hours),
      hrv != null ? Math.round(hrv) : null,
      score != null ? Math.round(score) : null,
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <div className="space-y-3">
        <div className="flex justify-center">
          <GoalConfigPill
            label={`Goal: ${sleepHoursGoal}h/night`}
            onClick={onOpenGoals}
          />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Sleep · {selectedDayLabel}
        </h2>
      </div>

      {/* Recovery chart */}
      <LandingSleepRecoveryChart
        entries={sleepEntries}
        habitInsight={sleepHabitInsight}
        habitInsightLoading={sleepHabitInsightLoading}
        onViewSleepInsights={onViewSleepInsights}
        targetHours={sleepHoursGoal}
        chartsOnly
      />

      {/* Entry form */}
      <div className={`landing-module-glass space-y-3 rounded-2xl border p-4 transition-opacity ${sleepSaving ? "opacity-[0.72]" : ""}`}>
        <div>
          <label className="block text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Sleep duration
          </label>
          <div className="mt-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-600 dark:bg-neutral-800">
            <SleepDurationPicker
              valueHours={sleepHoursInput}
              onChangeHours={setSleepHoursInput}
              disabled={sleepSaving}
              className="w-full justify-center"
              selectClassName="min-w-[4.5rem] appearance-none bg-transparent text-center text-base font-medium tabular-nums text-foreground outline-none"
              separatorClassName="text-base font-medium tabular-nums text-neutral-500 dark:text-neutral-400"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={sleepSaving}
          onClick={() => setOptionalDetailsOpen((prev) => !prev)}
          className="text-sm font-medium text-neutral-500 transition-colors hover:text-foreground disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {optionalDetailsOpen ? "Hide optional details" : "Add HRV or score"}
        </button>

        {optionalDetailsOpen ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                HRV (ms)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="300"
                placeholder="Optional"
                value={hrvInput}
                onChange={(e) => setHrvInput(e.target.value)}
                disabled={sleepSaving}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-600 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Score (1-100)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                placeholder="Optional"
                value={sleepScoreInput}
                onChange={(e) => setSleepScoreInput(e.target.value)}
                disabled={sleepSaving}
                className="mt-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-600 dark:bg-neutral-800"
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={sleepSaving}
          onClick={handleSave}
          className="w-full rounded-xl border border-[#B87B51] bg-[#FBF4EC] py-3 text-[15px] font-semibold text-[#7C522D] transition-colors disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
        >
          {sleepSaving ? "Saving…" : sleepForSelectedDay ? "Update sleep" : "Save sleep"}
        </button>

        {sleepSaveError ? (
          <p className="text-center text-[13px] text-red-600 dark:text-red-400">{sleepSaveError}</p>
        ) : null}

        {/* Status line */}
        {sleepForSelectedDay ? (
          <p className="text-center text-[13px] text-neutral-500 dark:text-neutral-400">
            Logged today: {formatSleepDuration(sleepForSelectedDay.sleepHours)} sleep
            {sleepForSelectedDay.hrvMs != null ? ` · ${sleepForSelectedDay.hrvMs} ms HRV` : ""}
            {sleepForSelectedDay.sleepScore != null ? ` · ${sleepForSelectedDay.sleepScore}/100` : ""}
          </p>
        ) : (
          <p className="text-center text-[13px] text-neutral-500 dark:text-neutral-400">
            No sleep logged for this day yet.
          </p>
        )}
      </div>
    </div>
  );
}
