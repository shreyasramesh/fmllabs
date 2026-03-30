export type ReminderType = "nutrition" | "exercise" | "gratitude" | "weight" | "mentalModel";

export type ReminderSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[]; // 0-6 (Sun-Sat)
};

export type ReminderPreferences = Record<ReminderType, ReminderSchedule>;

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  nutrition: { enabled: false, hour: 8, minute: 30, days: DEFAULT_DAYS },
  exercise: { enabled: false, hour: 18, minute: 0, days: DEFAULT_DAYS },
  gratitude: { enabled: false, hour: 21, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
  weight: { enabled: false, hour: 7, minute: 30, days: [1, 3, 5] },
  mentalModel: { enabled: false, hour: 12, minute: 30, days: DEFAULT_DAYS },
};

function clampHour(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback;
}

function clampMinute(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 59 ? v : fallback;
}

function normalizeDays(v: unknown, fallback: number[]): number[] {
  if (!Array.isArray(v)) return fallback;
  const unique = Array.from(
    new Set(v.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6))
  );
  return unique.length > 0 ? unique : fallback;
}

function normalizeOne(input: unknown, fallback: ReminderSchedule): ReminderSchedule {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    enabled: Boolean(obj.enabled),
    hour: clampHour(obj.hour, fallback.hour),
    minute: clampMinute(obj.minute, fallback.minute),
    days: normalizeDays(obj.days, fallback.days),
  };
}

export function normalizeReminderPreferences(input: unknown): ReminderPreferences {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    nutrition: normalizeOne(obj.nutrition, DEFAULT_REMINDER_PREFERENCES.nutrition),
    exercise: normalizeOne(obj.exercise, DEFAULT_REMINDER_PREFERENCES.exercise),
    gratitude: normalizeOne(obj.gratitude, DEFAULT_REMINDER_PREFERENCES.gratitude),
    weight: normalizeOne(obj.weight, DEFAULT_REMINDER_PREFERENCES.weight),
    mentalModel: normalizeOne(obj.mentalModel, DEFAULT_REMINDER_PREFERENCES.mentalModel),
  };
}

