function clampMinutes(totalMinutes: number): number {
  if (!Number.isFinite(totalMinutes)) return 450;
  return Math.max(30, Math.min(1440, Math.round(totalMinutes)));
}

export function roundSleepHoursToMinute(hours: number): number {
  if (!Number.isFinite(hours)) return 7.5;
  return clampMinutes(hours * 60) / 60;
}

export function formatSleepDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "--";
  const totalMinutes = clampMinutes(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
