"use client";

import React from "react";

import { LandingDateStrip } from "@/components/landing/LandingDateStrip";
import { LandingFocusCanvas } from "@/components/landing/LandingFocusCanvas";
import { LandingTimelineCard } from "@/components/landing/LandingTimelineCard";
import { LandingTopBar } from "@/components/landing/LandingTopBar";
import type {
  LandingActivityGroupSummary,
  LandingDateItem,
  LandingFigureSummary,
  LandingFocusSummaryRow,
  LandingNutritionGoals,
  LandingNutritionSummary,
  LandingQuickCaptureItem,
  LandingTimelineEvent,
} from "@/components/landing/types";

function ModuleCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.8rem] border border-neutral-200/70 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-neutral-950/80">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B87B51] dark:text-[#D6A67E]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
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
}: LandingShellProps) {
  const distanceToTarget =
    weightCurrentKg != null && weightTargetKg != null
      ? Math.abs(weightCurrentKg - weightTargetKg).toFixed(1)
      : null;

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
        weightCurrentKg={weightCurrentKg}
        weightTargetKg={weightTargetKg}
        weightEntryCount={weightEntryCount}
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
        onOpenWeight={onOpenWeight}
        onCustomFocusTagInputChange={onCustomFocusTagInputChange}
        onCustomFocusMinutesInputChange={onCustomFocusMinutesInputChange}
        onCustomFocusTimeInputChange={onCustomFocusTimeInputChange}
        onAddCustomFocusEntry={onAddCustomFocusEntry}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ModuleCard
          eyebrow="Mind Lab"
          title={mindLabTitle}
          description={mindLabDescription}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenMentalModels}
              className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <p className="text-2xl font-semibold text-foreground">{mentalModelCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{mentalModelsLabel}</p>
            </button>
            <button
              type="button"
              onClick={onOpenPromptGames}
              className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <p className="text-2xl font-semibold text-foreground">{perspectiveCardCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{savedPerspectiveCardsLabel}</p>
            </button>
            <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-2xl font-semibold text-foreground">{conceptCount + frameworkCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{conceptsAndPlaygroundsLabel}</p>
            </div>
            <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-2xl font-semibold text-foreground">{longTermMemoryCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{savedMemoriesLabel}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenLearnMentalModel}
              className="rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {learnMentalModelLabel}
            </button>
            <button
              type="button"
              onClick={onOpenPromptGames}
              className="rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {promptGamesLabel}
            </button>
          </div>
        </ModuleCard>

        <ModuleCard
          eyebrow="Mentor Hub"
          title={mentorHubTitle}
          description={mentorHubDescription}
        >
          <div className="flex flex-wrap items-center gap-2">
            {mentors.slice(0, 5).map((mentor) => (
              <div
                key={mentor.id}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: `hsl(${mentor.hue} 70% 45%)` }}
                >
                  {mentor.initials}
                </span>
                <span className="max-w-[8rem] truncate text-xs text-neutral-700 dark:text-neutral-200">
                  {mentor.name}
                </span>
              </div>
            ))}
            {mentorCount === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {followMentorsHint}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenOneOnOneMentor}
              className="rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {mentorChatLabel}
            </button>
            <button
              type="button"
              onClick={onOpenAskMentors}
              className="rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {askMentorsLabel}
            </button>
          </div>
        </ModuleCard>

        <ModuleCard
          eyebrow="Growth Studio"
          title={growthStudioTitle}
          description={growthStudioDescription}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-2xl font-semibold text-foreground">{habitsCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{experimentsLabel}</p>
            </div>
            <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-2xl font-semibold text-foreground">{conversationCount}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{savedConversationsLabel}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenGoals}
              className="rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {setGoalsLabel}
            </button>
            <button
              type="button"
              onClick={onOpenWeeklySummary}
              className="rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              {weeklySummaryLabel}
            </button>
            <button
              type="button"
              onClick={onOpenHabits}
              className="rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Experiments
            </button>
            <button
              type="button"
              onClick={onOpenPlaygrounds}
              className="rounded-full border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Playgrounds
            </button>
          </div>
        </ModuleCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ModuleCard
          eyebrow="Quick Capture"
          title="Journal, nutrition, exercise, and reflections"
          description="Fast capture actions stay lightweight while preserving the existing journaling flows."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {quickCaptures.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex items-center gap-3 rounded-[1.2rem] border border-neutral-200 px-3 py-3 text-left transition-colors hover:border-[#DDB691] hover:bg-[#FBF4EC] dark:border-neutral-800 dark:hover:border-[#6A4A33] dark:hover:bg-[#241a14]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FBF4EC] text-[#B87B51] dark:bg-[#241a14] dark:text-[#E8C3A0]">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </ModuleCard>

        <div className="space-y-4">
          <ModuleCard
            eyebrow="Weight"
            title={weightTitle}
            description={weightDescription}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-2xl font-semibold text-foreground">
                  {weightCurrentKg == null ? "--" : `${weightCurrentKg.toFixed(1)} kg`}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{currentWeightLabel}</p>
              </div>
              <div className="rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-2xl font-semibold text-foreground">
                  {weightTargetKg == null ? "--" : `${weightTargetKg.toFixed(1)} kg`}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{targetWeightLabel}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.2rem] border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {distanceToTarget == null ? noTargetYetLabel : `${distanceToTarget} kg to target`}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {weightEntryCount} logged entr{weightEntryCount === 1 ? "y" : "ies"}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenWeight}
                className="rounded-full border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-950"
              >
                {openLabel}
              </button>
            </div>
          </ModuleCard>

          <ModuleCard
            eyebrow="Activity"
            title={activityTitle}
            description={activityDescription}
          >
            <div className="space-y-2">
              {activityGroups.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No activity yet for this day.
                </p>
              ) : (
                activityGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={group.onClick}
                    className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] border border-neutral-200 px-3 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{group.label}</span>
                      <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                        {tapToInspectLabel}
                      </span>
                    </span>
                    <span className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                      {group.count}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ModuleCard>
        </div>
      </div>

      <LandingTimelineCard eyebrow={timelineEyebrow} dayLabel={timelineLabel} events={timelineEvents} />
    </div>
  );
}
