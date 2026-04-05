import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type PermissionStatus,
} from "@capacitor/local-notifications";
import type { ReminderPreferences, ReminderType } from "@/lib/reminder-settings";
import type { ReminderNotificationContext } from "@/lib/reminder-notification-context";

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

const POMODORO_COMPLETION_NOTIFICATION_ID = 1600;
const CAFFEINE_FOCUS_NOTIFICATION_ID = 1800;

/** Stable numeric id for one habit + weekday slot (0–6). */
function habitSlotNotificationId(habitId: string, day: number): number {
  let h = 5381;
  for (let i = 0; i < habitId.length; i++) {
    h = (h * 33 + habitId.charCodeAt(i)) >>> 0;
  }
  return 21000 + (h % 8000) * 10 + day;
}

/** Ids scheduled on the last sync so we can cancel when habits change. */
let lastHabitNotificationIds: number[] = [];

function toCapacitorWeekday(day: number): number {
  return day + 1; // JS 0-6 (Sun-Sat) => Capacitor 1-7
}

function allManagedGlobalIds(): number[] {
  const ids: number[] = [];
  for (const type of Object.keys(BASE_IDS) as ReminderType[]) {
    const base = BASE_IDS[type];
    for (let day = 0; day <= 6; day++) ids.push(base + day);
  }
  return ids;
}

function shouldSkipGlobalSlot(
  type: ReminderType,
  scheduledWeekday: number,
  ctx: ReminderNotificationContext | undefined,
): boolean {
  if (!ctx) return false;
  if (scheduledWeekday !== ctx.todayWeekday) return false;
  switch (type) {
    case "weight":
      return ctx.hasWeightEntryToday;
    case "nutrition":
      return Boolean(ctx.loggedNutritionToday);
    case "exercise":
      return Boolean(ctx.loggedExerciseToday);
    case "gratitude":
      return Boolean(ctx.loggedGratitudeToday);
    default:
      return false;
  }
}

function buildGlobalNotifications(
  preferences: ReminderPreferences,
  ctx: ReminderNotificationContext | undefined,
): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  for (const type of Object.keys(BASE_IDS) as ReminderType[]) {
    const schedule = preferences[type];
    if (!schedule.enabled) continue;
    for (const day of schedule.days) {
      if (shouldSkipGlobalSlot(type, day, ctx)) continue;
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
  return notifications;
}

function buildHabitNotifications(ctx: ReminderNotificationContext | undefined): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  if (!ctx?.habits?.length) return notifications;

  for (const h of ctx.habits) {
    if (!h.reminder?.enabled) continue;
    const doneToday = ctx.habitDoneToday?.[h.id] === true;
    const { hour, minute, days } = h.reminder;
    for (const day of days) {
      if (doneToday && day === ctx.todayWeekday) continue;
      const title = `Habit · ${h.name.trim() || "Check-in"}`;
      const body = `Time to log this habit for today.`;
      notifications.push({
        id: habitSlotNotificationId(h.id, day),
        title,
        body,
        schedule: {
          repeats: true,
          allowWhileIdle: true,
          on: {
            weekday: toCapacitorWeekday(day),
            hour,
            minute,
          },
        },
      });
    }
  }
  return notifications;
}

export async function syncNativeReminders(
  preferences: ReminderPreferences,
  context?: ReminderNotificationContext,
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

  const toCancel = [
    ...allManagedGlobalIds().map((id) => ({ id })),
    ...lastHabitNotificationIds.map((id) => ({ id })),
  ];
  await LocalNotifications.cancel({ notifications: toCancel });
  lastHabitNotificationIds = [];

  const globalNotifications = buildGlobalNotifications(preferences, context);
  const habitNotifications = buildHabitNotifications(context);
  lastHabitNotificationIds = habitNotifications.map((n) => n.id as number);

  const notifications = [...globalNotifications, ...habitNotifications];
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

export async function scheduleCaffeineFocusNotification(focusWindowStartMinute: number): Promise<{
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
    notifications: [{ id: CAFFEINE_FOCUS_NOTIFICATION_ID }],
  });

  const now = new Date();
  const notifyMinute = focusWindowStartMinute - 5;
  const notifyDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(notifyMinute / 60), notifyMinute % 60, 0, 0);
  if (notifyDate.getTime() <= Date.now()) return { ok: true };

  await LocalNotifications.schedule({
    notifications: [
      {
        id: CAFFEINE_FOCUS_NOTIFICATION_ID,
        title: "Peak Focus Window",
        body: "Your caffeine levels peak soon. Great time for deep thinking.",
        schedule: { at: notifyDate },
      },
    ],
  });

  return { ok: true };
}
