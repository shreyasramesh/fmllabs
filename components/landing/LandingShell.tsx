"use client";

import React, { useState } from "react";

import { LandingCaffeineChart } from "@/components/landing/LandingCaffeineChart";
import { LandingDateStrip } from "@/components/landing/LandingDateStrip";
import { LandingFocusCanvas } from "@/components/landing/LandingFocusCanvas";
import { LandingSleepRecoveryChart } from "@/components/landing/LandingSleepRecoveryChart";
import { LandingTimelineCard } from "@/components/landing/LandingTimelineCard";
import { LandingTopBar } from "@/components/landing/LandingTopBar";
import type {
  CaffeineFocusWindow,
  CaffeineIntake,
  FocusDurationSuggestion,
  LandingActivityGroupSummary,
  LandingDateItem,
  LandingFigureSummary,
  LandingFocusSummaryRow,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingSleepEntry,
  LandingTimelineEvent,
  LandingWeeklySummaryPreview,
} from "@/components/landing/types";

function ModuleCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200/70 bg-white/90 px-3 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-[13px] font-semibold text-foreground">{eyebrow}</h3>
      {description && (
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? "bg-[#C87B3A]" : "bg-neutral-300 dark:bg-neutral-600"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-[1.1rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SegmentedPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { key: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-100 p-px dark:border-neutral-700 dark:bg-neutral-800">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === opt.key
              ? "bg-white text-foreground shadow-sm dark:bg-neutral-700"
              : "text-neutral-500 hover:text-foreground dark:text-neutral-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChevronRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

interface LandingShellProps {
  dashboardEyebrow: string;
  title: string;
  subtitle: string;
  selectedDateLabel: string;
  dateItems: LandingDateItem[];
  dateStripLabel: string;
  dateStripHint: string;
  onOpenCalendar: () => void;
  focusCanvasEyebrow: string;
  focusCanvasTitle: string;
  focusCanvasSubtitle: string;
  nutritionLabel: string;
  caloriesRemainingLabel: string;
  foodLoggedLabel: string;
  carbsLabel: string;
  proteinLabel: string;
  focusSummaryLabel: string;
  noFocusLoggedLabel: string;
  liveFocusLabel: string;
  quickCaptureTitle: string;
  manualFocusLogTitle: string;
  nutrition: LandingNutritionSummary;
  nutritionGoals: LandingNutritionGoals;
  focusSummaryMinutes: number;
  focusSummarySessions: number;
  focusSummaryRows: LandingFocusSummaryRow[];
  quickCaptures: LandingQuickCaptureItem[];
  pomodoroClockLabel: string;
  pomodoroRunning: boolean;
  pomodoroSessionActive: boolean;
  pomodoroDurationMinutes: number;
  pomodoroCustomMinutesInput: string;
  focusSessionTagInput: string;
  focusTrackerSaving: boolean;
  focusTrackerError: string | null;
  pomodoroJustLogged: boolean;
  customFocusTagInput: string;
  customFocusMinutesInput: string;
  customFocusTimeInput: string;
  onOpenNutrition: () => void;
  onPomodoroCustomMinutesInputChange: (value: string) => void;
  onApplyCustomPomodoroMinutes: () => void;
  onSelectPomodoroDuration: (minutes: number) => void;
  onFocusSessionTagInputChange: (value: string) => void;
  onStartPomodoro: () => void;
  onPausePomodoro: () => void;
  onResetPomodoro: () => void;
  onEndPomodoro: () => void;
  onCustomFocusTagInputChange: (value: string) => void;
  onCustomFocusMinutesInputChange: (value: string) => void;
  onCustomFocusTimeInputChange: (value: string) => void;
  onAddCustomFocusEntry: () => void;
  activityGroups: LandingActivityGroupSummary[];
  mentors: LandingFigureSummary[];
  mentorCount: number;
  mentalModelCount: number;
  longTermMemoryCount: number;
  conceptCount: number;
  frameworkCount: number;
  perspectiveCardCount: number;
  habitsCount: number;
  conversationCount: number;
  weightCurrentKg: number | null;
  weightTargetKg: number | null;
  weightEntryCount: number;
  onOpenOneOnOneMentor: () => void;
  onOpenAskMentors: () => void;
  onOpenMentalModels: () => void;
  onOpenLearnMentalModel: () => void;
  onOpenPromptGames: () => void;
  onOpenGoals: () => void;
  onOpenWeeklySummary: () => void;
  onOpenHabits: () => void;
  onOpenPlaygrounds: () => void;
  onOpenWeight: () => void;
  mindLabTitle: string;
  mindLabDescription: string;
  mentalModelsLabel: string;
  savedPerspectiveCardsLabel: string;
  conceptsAndPlaygroundsLabel: string;
  savedMemoriesLabel: string;
  learnMentalModelLabel: string;
  promptGamesLabel: string;
  mentorHubTitle: string;
  mentorHubDescription: string;
  followMentorsHint: string;
  mentorChatLabel: string;
  askMentorsLabel: string;
  growthStudioTitle: string;
  growthStudioDescription: string;
  experimentsLabel: string;
  savedConversationsLabel: string;
  setGoalsLabel: string;
  weeklySummaryLabel: string;
  weightTitle: string;
  weightDescription: string;
  currentWeightLabel: string;
  targetWeightLabel: string;
  noTargetYetLabel: string;
  openLabel: string;
  activityTitle: string;
  activityDescription: string;
  tapToInspectLabel: string;
  timelineEyebrow: string;
  timelineLabel: string;
  timelineEvents: LandingTimelineEvent[];
  caffeineIntakes: CaffeineIntake[];
  caffeineFocusWindow: CaffeineFocusWindow | null;
  featuredMentalModelName: string | null;
  secondOrderCitationsEnabled: boolean;
  onToggleSecondOrderCitations: () => void;
  responseVerbosity: "compact" | "detailed";
  onResponseVerbosityChange: (value: "compact" | "detailed") => void;
  onStartMindLabConversation: () => void;
  onOpenConversations: () => void;
  weeklySummary: LandingWeeklySummaryPreview | null;
  sleepEntries: LandingSleepEntry[];
  sleepFocusSuggestion: FocusDurationSuggestion | null;
  sleepSaving: boolean;
  onSaveSleepEntry: (sleepHours: number, hrvMs: number | null) => void;
}

export function LandingShell({
  dashboardEyebrow,
  title,
  subtitle,
  selectedDateLabel,
  dateItems,
  dateStripLabel,
  dateStripHint,
  onOpenCalendar,
  focusCanvasEyebrow,
  focusCanvasTitle,
  focusCanvasSubtitle,
  nutritionLabel,
  caloriesRemainingLabel,
  foodLoggedLabel,
  carbsLabel,
  proteinLabel,
  focusSummaryLabel,
  noFocusLoggedLabel,
  liveFocusLabel,
  quickCaptureTitle,
  manualFocusLogTitle,
  nutrition,
  nutritionGoals,
  focusSummaryMinutes,
  focusSummarySessions,
  focusSummaryRows,
  quickCaptures,
  pomodoroClockLabel,
  pomodoroRunning,
  pomodoroSessionActive,
  pomodoroDurationMinutes,
  pomodoroCustomMinutesInput,
  focusSessionTagInput,
  focusTrackerSaving,
  focusTrackerError,
  pomodoroJustLogged,
  customFocusTagInput,
  customFocusMinutesInput,
  customFocusTimeInput,
  onOpenNutrition,
  onPomodoroCustomMinutesInputChange,
  onApplyCustomPomodoroMinutes,
  onSelectPomodoroDuration,
  onFocusSessionTagInputChange,
  onStartPomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onEndPomodoro,
  onCustomFocusTagInputChange,
  onCustomFocusMinutesInputChange,
  onCustomFocusTimeInputChange,
  onAddCustomFocusEntry,
  activityGroups,
  mentors,
  mentorCount,
  mentalModelCount,
  longTermMemoryCount,
  conceptCount,
  frameworkCount,
  perspectiveCardCount,
  habitsCount,
  conversationCount,
  weightCurrentKg,
  weightTargetKg,
  weightEntryCount,
  onOpenOneOnOneMentor,
  onOpenAskMentors,
  onOpenMentalModels,
  onOpenLearnMentalModel,
  onOpenPromptGames,
  onOpenGoals,
  onOpenWeeklySummary,
  onOpenHabits,
  onOpenPlaygrounds,
  onOpenWeight,
  mindLabTitle,
  mindLabDescription,
  mentalModelsLabel,
  savedPerspectiveCardsLabel,
  conceptsAndPlaygroundsLabel,
  savedMemoriesLabel,
  learnMentalModelLabel,
  promptGamesLabel,
  mentorHubTitle,
  mentorHubDescription,
  followMentorsHint,
  mentorChatLabel,
  askMentorsLabel,
  growthStudioTitle,
  growthStudioDescription,
  experimentsLabel,
  savedConversationsLabel,
  setGoalsLabel,
  weeklySummaryLabel,
  weightTitle,
  weightDescription,
  currentWeightLabel,
  targetWeightLabel,
  noTargetYetLabel,
  openLabel,
  activityTitle,
  activityDescription,
  tapToInspectLabel,
  timelineEyebrow,
  timelineLabel,
  timelineEvents,
  caffeineIntakes,
  caffeineFocusWindow,
  featuredMentalModelName,
  secondOrderCitationsEnabled,
  onToggleSecondOrderCitations,
  responseVerbosity,
  onResponseVerbosityChange,
  onStartMindLabConversation,
  onOpenConversations,
  weeklySummary,
  sleepEntries,
  sleepFocusSuggestion,
  sleepSaving,
  onSaveSleepEntry,
}: LandingShellProps) {
  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

  const [sleepHoursInput, setSleepHoursInput] = useState("7.5");
  const [hrvInput, setHrvInput] = useState("");

  const lastSleep = sleepEntries.length > 0 ? sleepEntries[0] : null;

  function handleSaveSleep() {
    const hours = parseFloat(sleepHoursInput);
    if (isNaN(hours) || hours < 0.5 || hours > 24) return;
    const hrv = hrvInput.trim() ? parseFloat(hrvInput) : null;
    if (hrv != null && (isNaN(hrv) || hrv < 1 || hrv > 300)) return;
    onSaveSleepEntry(Math.round(hours * 10) / 10, hrv != null ? Math.round(hrv) : null);
  }

  return (
    <div className="w-full max-w-[88rem] min-w-0 space-y-4 animate-fade-in-up">
      <LandingTopBar
        eyebrow={dashboardEyebrow}
        title={title}
        subtitle={subtitle}
        selectedDateLabel={selectedDateLabel}
        onOpenCalendar={onOpenCalendar}
      />

      <LandingDateStrip label={dateStripLabel} hint={dateStripHint} items={dateItems} />

      <LandingFocusCanvas
        eyebrow={focusCanvasEyebrow}
        title={focusCanvasTitle}
        subtitle={focusCanvasSubtitle}
        nutritionLabel={nutritionLabel}
        caloriesRemainingLabel={caloriesRemainingLabel}
        foodLoggedLabel={foodLoggedLabel}
        carbsLabel={carbsLabel}
        proteinLabel={proteinLabel}
        focusSummaryLabel={focusSummaryLabel}
        noFocusLoggedLabel={noFocusLoggedLabel}
        liveFocusLabel={liveFocusLabel}
        quickCaptureTitle={quickCaptureTitle}
        manualFocusLogTitle={manualFocusLogTitle}
        nutrition={nutrition}
        nutritionGoals={nutritionGoals}
        focusSummaryMinutes={focusSummaryMinutes}
        focusSummarySessions={focusSummarySessions}
        focusSummaryRows={focusSummaryRows}
        quickCaptures={quickCaptures.slice(0, 4)}
        pomodoroClockLabel={pomodoroClockLabel}
        pomodoroRunning={pomodoroRunning}
        pomodoroSessionActive={pomodoroSessionActive}
        pomodoroDurationMinutes={pomodoroDurationMinutes}
        pomodoroCustomMinutesInput={pomodoroCustomMinutesInput}
        focusSessionTagInput={focusSessionTagInput}
        focusTrackerSaving={focusTrackerSaving}
        focusTrackerError={focusTrackerError}
        pomodoroJustLogged={pomodoroJustLogged}
        customFocusTagInput={customFocusTagInput}
        customFocusMinutesInput={customFocusMinutesInput}
        customFocusTimeInput={customFocusTimeInput}
        onOpenNutrition={onOpenNutrition}
        onPomodoroCustomMinutesInputChange={onPomodoroCustomMinutesInputChange}
        onApplyCustomPomodoroMinutes={onApplyCustomPomodoroMinutes}
        onSelectPomodoroDuration={onSelectPomodoroDuration}
        onFocusSessionTagInputChange={onFocusSessionTagInputChange}
        onStartPomodoro={onStartPomodoro}
        onPausePomodoro={onPausePomodoro}
        onResetPomodoro={onResetPomodoro}
        onEndPomodoro={onEndPomodoro}
        onCustomFocusTagInputChange={onCustomFocusTagInputChange}
        onCustomFocusMinutesInputChange={onCustomFocusMinutesInputChange}
        onCustomFocusTimeInputChange={onCustomFocusTimeInputChange}
        onAddCustomFocusEntry={onAddCustomFocusEntry}
      />

      {/* Row 1: Quick Capture · Mind Lab · Mentor Hub */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ModuleCard eyebrow="Quick Capture" title="Quick Capture Panel">
          <div className="grid grid-cols-3 gap-1.5">
            {quickCaptures.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 px-1.5 py-2 transition-colors hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                  {item.icon}
                </span>
                <span className="text-[11px] font-medium text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </ModuleCard>

        <ModuleCard eyebrow="Mind Lab" title={mindLabTitle}>
          {featuredMentalModelName && (
            <button
              type="button"
              onClick={onOpenMentalModels}
              className="flex w-full items-center justify-between gap-2 rounded-lg border-l-[3px] border-neutral-300 bg-neutral-50 px-2.5 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{featuredMentalModelName}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Interactive mental model</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-neutral-400">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <div className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
            <ToggleRow
              label="Think deeper (metacognition)"
              checked={secondOrderCitationsEnabled}
              onChange={onToggleSecondOrderCitations}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Response style</p>
            <SegmentedPicker
              value={responseVerbosity}
              onChange={(v) => onResponseVerbosityChange(v as "compact" | "detailed")}
              options={[
                { key: "compact", label: "Compact" },
                { key: "detailed", label: "Detailed" },
              ]}
            />
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={onStartMindLabConversation}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
            >
              Start conversation
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="mt-2">
            <ChevronRow label={learnMentalModelLabel} onClick={onOpenLearnMentalModel} />
          </div>
          {conversationCount > 0 && (
            <button
              type="button"
              onClick={onOpenConversations}
              className="mt-2 flex w-full items-center justify-between border-t border-neutral-100 pt-2 text-left transition-colors hover:opacity-70 dark:border-neutral-800"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Conversations
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {conversationCount} item{conversationCount !== 1 ? "s" : ""}, tap to view
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-400">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </ModuleCard>

        <ModuleCard eyebrow="Mentor Hub" title={mentorHubTitle}>
          <div className="flex flex-wrap items-center gap-1.5">
            {mentors.slice(0, 5).map((mentor) => (
              <span
                key={mentor.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-0.5 pl-0.5 pr-2.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                  style={{ backgroundColor: `hsl(${mentor.hue} 70% 45%)` }}
                >
                  {mentor.initials}
                </span>
                <span className="truncate text-[12px] font-medium text-foreground">{mentor.name}</span>
              </span>
            ))}
            {mentorCount === 0 && (
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{followMentorsHint}</p>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onOpenOneOnOneMentor}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-semibold text-[#7C522D] shadow-sm transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
            >
              1:1 with a mentor
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onOpenAskMentors}
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-center text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              {askMentorsLabel}
            </button>
          </div>
        </ModuleCard>
      </div>

      {/* Row 2: Weekly Summary · Growth Studio · Weight */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ModuleCard eyebrow="Weekly Summary" title={weeklySummaryLabel}>
          {weeklySummary ? (
            <>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {weeklySummary.weekStartLabel} – {weeklySummary.weekEndLabel}
              </p>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                {weeklySummary.rows.map((row) => {
                  const hasActivity = row.foodEntries > 0 || row.exerciseEntries > 0 || row.focusMinutes > 0;
                  return (
                    <div key={row.dayKey} className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500">
                        {row.weekdayLabel.slice(0, 1)}
                      </span>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                          hasActivity
                            ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300"
                            : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                        }`}
                      >
                        {row.foodEntries + row.exerciseEntries || "·"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-lg font-semibold text-foreground">{weeklySummary.trackedDays}<span className="text-[11px] font-normal text-neutral-400">/7</span></p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Days tracked</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className={`text-lg font-semibold ${weeklySummary.caloriesUnderBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {Math.abs(weeklySummary.caloriesUnderBudget).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {weeklySummary.caloriesUnderBudget >= 0 ? "Under budget" : "Over budget"}
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-lg font-semibold text-foreground">{weeklySummary.foodEntries}</p>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Meals logged</p>
                </div>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={onOpenWeeklySummary}
                  className="w-full rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
                >
                  View full report
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-6 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            </div>
          )}
        </ModuleCard>

        <ModuleCard eyebrow="Growth Studio" title={growthStudioTitle}>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">Active 30-Day Experiments</span>
                <span className="font-semibold text-foreground">{habitsCount}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-[#5A7D5B] transition-all"
                  style={{ width: `${Math.min(100, habitsCount * 12)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">Progress</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-[#A0522D] transition-all"
                  style={{ width: `${Math.min(100, habitsCount > 0 ? 45 : 0)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2">
            <ChevronRow label="Playgrounds" onClick={onOpenPlaygrounds} />
          </div>
        </ModuleCard>

        <ModuleCard
          eyebrow="Weight"
          title={weightTitle}
          description={weightDescription}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-lg font-semibold text-foreground">
                {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)} kg`}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{currentWeightLabel}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-lg font-semibold text-foreground">
                {weightTargetKg == null ? "--" : `${weightTargetKg.toFixed(1)} kg`}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{targetWeightLabel}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {distanceToTarget == null ? noTargetYetLabel : `${distanceToTarget} kg to target`}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {weightEntryCount} logged entr{weightEntryCount === 1 ? "y" : "ies"}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenWeight}
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-950"
            >
              {openLabel}
            </button>
          </div>
        </ModuleCard>
      </div>

      {/* Row 3: Activity · Sleep & Recovery */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ModuleCard
          eyebrow="Activity"
          title={activityTitle}
          description={activityDescription}
        >
          <div className="space-y-1.5">
            {activityGroups.length === 0 ? (
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                No activity yet for this day.
              </p>
            ) : (
              activityGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={group.onClick}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">{group.label}</span>
                    <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                      {tapToInspectLabel}
                    </span>
                  </span>
                  <span className="rounded-full border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    {group.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </ModuleCard>

        <ModuleCard eyebrow="Sleep &amp; Recovery" title="Log Last Night">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  Sleep (hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={sleepHoursInput}
                  onChange={(e) => setSleepHoursInput(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-indigo-400 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  HRV (ms, optional)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="300"
                  placeholder="—"
                  value={hrvInput}
                  onChange={(e) => setHrvInput(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-indigo-400 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={sleepSaving}
              onClick={handleSaveSleep}
              className="w-full rounded-lg border border-[#B87B51] bg-[#FBF4EC] px-3 py-1.5 text-[13px] font-medium text-[#7C522D] transition-colors hover:bg-[#F5E8D8] disabled:opacity-50 dark:border-[#D6A67E] dark:bg-[#241a14] dark:text-[#F3D6B7] dark:hover:bg-[#2e2018]"
            >
              {sleepSaving ? "Saving…" : "Log last night"}
            </button>
            {lastSleep && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Last: {lastSleep.sleepHours}h sleep
                {lastSleep.hrvMs != null ? ` · ${lastSleep.hrvMs} ms HRV` : ""}
                {" · "}
                {lastSleep.dayKey}
              </p>
            )}
          </div>
        </ModuleCard>
      </div>

      <LandingTimelineCard eyebrow={timelineEyebrow} dayLabel={timelineLabel} events={timelineEvents} />

      <LandingCaffeineChart intakes={caffeineIntakes} focusWindow={caffeineFocusWindow} />

      <LandingSleepRecoveryChart entries={sleepEntries} focusSuggestion={sleepFocusSuggestion} />
    </div>
  );
}
