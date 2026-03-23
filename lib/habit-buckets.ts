/** Life-area bucket for habits (stable API / DB values). Safe to import from client components. */

export type HabitBucket = "creative" | "intellectual" | "wellbeing" | "connection";

export const HABIT_BUCKET_IDS: readonly HabitBucket[] = [
  "creative",
  "intellectual",
  "wellbeing",
  "connection",
] as const;

export function isHabitBucket(value: unknown): value is HabitBucket {
  return typeof value === "string" && (HABIT_BUCKET_IDS as readonly string[]).includes(value);
}
