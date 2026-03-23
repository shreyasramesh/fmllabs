/** Optional month/year for when the user plans to start a habit (1–12 and calendar year). */

export const HABIT_INTENDED_YEAR_MIN = 2000;
export const HABIT_INTENDED_YEAR_MAX = 2100;

export function isValidIntendedMonth(m: number): boolean {
  return Number.isInteger(m) && m >= 1 && m <= 12;
}

export function isValidIntendedYear(y: number): boolean {
  return (
    Number.isInteger(y) &&
    y >= HABIT_INTENDED_YEAR_MIN &&
    y <= HABIT_INTENDED_YEAR_MAX
  );
}

/** Years shown in habit “intended start” pickers: previous year through ~10 years ahead, clamped to valid range. */
export function getHabitIntendedYearOptions(now = new Date()): number[] {
  const y0 = now.getFullYear();
  const out: number[] = [];
  for (let y = y0 - 1; y <= y0 + 10; y++) {
    if (y >= HABIT_INTENDED_YEAR_MIN && y <= HABIT_INTENDED_YEAR_MAX) {
      out.push(y);
    }
  }
  return out;
}

export function formatHabitIntendedPeriod(
  month: number,
  year: number,
  language: string
): string {
  return new Intl.DateTimeFormat(language, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
