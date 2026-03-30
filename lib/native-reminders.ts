import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type PermissionStatus,
} from "@capacitor/local-notifications";
import type { ReminderPreferences, ReminderType } from "@/lib/reminder-settings";

const BASE_IDS: Record<ReminderType, number> = {
  nutrition: 1100,
  exercise: 1200,
  gratitude: 1300,
  weight: 1500,
  mentalModel: 1700,
};

const REMINDER_TITLES: Record<ReminderType, string> = {
  nutrition: "Nutrition check-in",
  exercise: "Exercise check-in",
  gratitude: "Gratitude journal",
  weight: "Weight check-in",
  mentalModel: "Mental model spark",
};

const REMINDER_BODIES: Record<ReminderType, string> = {
  nutrition: "Log what you ate today. Small entries keep consistency high.",
  exercise: "Log your movement today, even if it was a short walk.",
  gratitude: "Capture one gratitude moment in your journal.",
  weight: "Log your weight to keep your progress trend up to date.",
  mentalModel: "Quick reset: apply one mental model to your next decision.",
};

const MENTAL_MODEL_PROMPTS = [
  "First Principles: what assumptions can you strip away?",
  "Second-order thinking: what happens after this decision?",
  "Inversion: what would make this fail?",
  "Opportunity cost: what are you saying no to?",
  "Circle of control: what part is truly in your control?",
  "80/20 rule: where is most impact coming from?",
  "Systems lens: what dependencies are driving this?",
  "Probabilistic thinking: what outcome is most likely?",
  "Margin of safety: what buffer do you need?",
  "Regret minimization: what would future-you prefer?",
];

function randomMentalModelPrompt(): string {
  return MENTAL_MODEL_PROMPTS[Math.floor(Math.random() * MENTAL_MODEL_PROMPTS.length)]!;
}

const NIGHTLY_DAILY_REPORT_BASE_ID = 1400;
const POMODORO_COMPLETION_NOTIFICATION_ID = 1600;

function toCapacitorWeekday(day: number): number {
  return day + 1; // JS 0-6 (Sun-Sat) => Capacitor 1-7
}

function allManagedIds(): number[] {
  const ids: number[] = [];
  for (const type of Object.keys(BASE_IDS) as ReminderType[]) {
    const base = BASE_IDS[type];
    for (let day = 0; day <= 6; day++) ids.push(base + day);
  }
  for (let day = 0; day <= 6; day++) ids.push(NIGHTLY_DAILY_REPORT_BASE_ID + day);
  return ids;
}

function buildNotifications(
  preferences: ReminderPreferences,
  options?: { nightlyNutritionReportNotificationEnabled?: boolean }
): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  for (const type of Object.keys(BASE_IDS) as ReminderType[]) {
    const schedule = preferences[type];
    if (!schedule.enabled) continue;
    for (const day of schedule.days) {
      const isMentalModel = type === "mentalModel";
      notifications.push({
        id: BASE_IDS[type] + day,
        title: REMINDER_TITLES[type],
        body: isMentalModel ? randomMentalModelPrompt() : REMINDER_BODIES[type],
        schedule: {
          repeats: true,
          allowWhileIdle: true,
          on: {
            weekday: toCapacitorWeekday(day),
            hour: schedule.hour,
            minute: schedule.minute,
          },
        },
      });
    }
  }
  if (options?.nightlyNutritionReportNotificationEnabled) {
    for (let day = 0; day <= 6; day++) {
      notifications.push({
        id: NIGHTLY_DAILY_REPORT_BASE_ID + day,
        title: "Your daily report is ready",
        body: "Your daily report is ready, click to view.",
        schedule: {
          repeats: true,
          allowWhileIdle: true,
          on: {
            weekday: toCapacitorWeekday(day),
            hour: 21,
            minute: 0,
          },
        },
      });
    }
  }
  return notifications;
}

export async function syncNativeReminders(
  preferences: ReminderPreferences,
  options?: { nightlyNutritionReportNotificationEnabled?: boolean }
): Promise<{
  ok: boolean;
  reason?: "not-native" | "permission-denied";
}> {
  if (!Capacitor.isNativePlatform()) return { ok: true, reason: "not-native" };

  let permissions: PermissionStatus = await LocalNotifications.checkPermissions();
  if (permissions.display !== "granted") {
    permissions = await LocalNotifications.requestPermissions();
  }
  if (permissions.display !== "granted") return { ok: false, reason: "permission-denied" };

  await LocalNotifications.cancel({
    notifications: allManagedIds().map((id) => ({ id })),
  });

  const notifications = buildNotifications(preferences, options);
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }

  return { ok: true };
}

export async function notifyPomodoroCompleted(): Promise<{
  ok: boolean;
  reason?: "not-native" | "permission-denied";
}> {
  if (!Capacitor.isNativePlatform()) return { ok: true, reason: "not-native" };

  let permissions: PermissionStatus = await LocalNotifications.checkPermissions();
  if (permissions.display !== "granted") {
    permissions = await LocalNotifications.requestPermissions();
  }
  if (permissions.display !== "granted") return { ok: false, reason: "permission-denied" };

  await LocalNotifications.cancel({
    notifications: [{ id: POMODORO_COMPLETION_NOTIFICATION_ID }],
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: POMODORO_COMPLETION_NOTIFICATION_ID,
        title: "Pomodoro complete",
        body: "Nice work. Your focus session just ended.",
        schedule: { at: new Date(Date.now() + 120) },
      },
    ],
  });

  return { ok: true };
}

