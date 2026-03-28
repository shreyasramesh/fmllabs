export type JournalEntryTimeParts = { hour: number; minute: number };

function normalizeTimePart(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const whole = Math.floor(value);
  if (whole < min || whole > max) return null;
  return whole;
}

export function getPacificTimeParts(baseDate: Date = new Date()): JournalEntryTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(baseDate);

  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    // Fallback should still produce a valid local-time-like value.
    return { hour: 0, minute: 0 };
  }
  return { hour, minute };
}

export function parseJournalEntryTimeFromBody(body: Record<string, unknown>): JournalEntryTimeParts | null {
  const raw = body.journalEntryTime;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { hour?: unknown; minute?: unknown };
  const hour = normalizeTimePart(candidate.hour, 0, 23);
  const minute = normalizeTimePart(candidate.minute, 0, 59);
  if (hour == null || minute == null) return null;
  return { hour, minute };
}
