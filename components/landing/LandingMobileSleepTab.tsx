"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import type {
  FocusDurationSuggestion,
  LandingSleepEntry,
} from "@/components/landing/types";
import { LandingMobileSleepGoalPanel } from "@/components/landing/LandingMobileSleepGoalPanel";
import { SleepDurationPicker } from "@/components/landing/SleepDurationPicker";
import { formatSleepDuration, roundSleepHoursToMinute } from "@/lib/sleep-duration";

interface LandingMobileSleepTabProps {
  selectedDayLabel: string;
  sleepEntries: LandingSleepEntry[];
  sleepEntryDayKey: string;
  sleepFocusSuggestion: FocusDurationSuggestion | null;
  sleepSaving: boolean;
  onSaveSleepEntry: (sleepHours: number, hrvMs: number | null, sleepScore: number | null) => void;
  onViewSleepInsights?: () => void;
  sleepHoursGoal: number;
}

export function LandingMobileSleepTab({
  selectedDayLabel,
  sleepEntries,
  sleepEntryDayKey,
  sleepFocusSuggestion,
  sleepSaving,
  onSaveSleepEntry,
  onViewSleepInsights,
  sleepHoursGoal,
}: LandingMobileSleepTabProps) {
  const [sleepHoursInput, setSleepHoursInput] = useState(7.5);
  const [hrvInput, setHrvInput] = useState("");
  const [sleepScoreInput, setSleepScoreInput] = useState("");

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
      <LandingMobileSleepGoalPanel
        loggedHours={sleepForSelectedDay != null ? sleepForSelectedDay.sleepHours : null}
        sleepHoursGoal={sleepHoursGoal}
        selectedDayLabel={selectedDayLabel}
      />

      <h2 className="text-xl font-bold text-foreground">
        Sleep · {selectedDayLabel}
      </h2>

      {/* Entry form */}
      <div className="landing-module-glass space-y-3 rounded-2xl border p-4">
        <div>
          <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300">
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
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Score (1–100)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              placeholder="Optional"
              value={sleepScoreInput}
              onChange={(e) => setSleepScoreInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-base text-foreground outline-none focus:border-[#B87B51] focus:ring-2 focus:ring-[#B87B51]/25 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={sleepSaving}
          onClick={handleSave}
          className="w-full rounded-xl border border-[#B87B51] bg-[#FBF4EC] py-3 text-[15px] font-semibold text-[#7C522D] transition-colors disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7]"
        >
          {sleepSaving ? "Saving…" : sleepForSelectedDay ? "Update sleep" : "Save sleep"}
        </button>

        {/* Status line */}
        {sleepForSelectedDay ? (
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            Logged: {formatSleepDuration(sleepForSelectedDay.sleepHours)} sleep
            {sleepForSelectedDay.hrvMs != null ? ` · ${sleepForSelectedDay.hrvMs} ms HRV` : ""}
            {sleepForSelectedDay.sleepScore != null ? ` · ${sleepForSelectedDay.sleepScore}/100` : ""}
          </p>
        ) : (
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            No sleep logged for this day yet.
          </p>
        )}
      </div>

      {/* Recovery chart */}
      <LandingSleepRecoveryChart
        entries={sleepEntries}
        focusSuggestion={sleepFocusSuggestion}
        onViewSleepInsights={onViewSleepInsights}
      />
    </div>
  );
}
