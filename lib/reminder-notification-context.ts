/**
 * Optional context for {@link syncNativeReminders} so repeating reminders skip
 * today's slot when the user has already completed the related action.
 */
export type ReminderNotificationContext = {
  /** `Date#getDay()` — 0 Sun … 6 Sat; must match `ReminderSchedule.days`. */
  todayWeekday: number;
  /** True when there is a weight entry for the user's local calendar day. */
  hasWeightEntryToday: boolean;
  /** Journal / calorie entry with nutrition category for today. */
  loggedNutritionToday?: boolean;
  /** Journal entry with exercise category for today. */
  loggedExerciseToday?: boolean;
  /** Gratitude journal entry (title match) for today. */
  loggedGratitudeToday?: boolean;
  /** Habits that have device reminders enabled. */
  habits?: Array<{
    id: string;
    name: string;
    reminder: { enabled: boolean; hour: number; minute: number; days: number[] };
  }>;
  /** Whether each habit is completed for today's calendar date (`YYYY-MM-DD`). */
  habitDoneToday?: Record<string, boolean>;
};
