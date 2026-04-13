/**
 * Resolve calendar day/month/year for a journal entry.
 * Each part defaults to "today" in Pacific time if omitted.
 */
export function getPacificDateParts(baseDate: Date = new Date()): {
  day: number;
  month: number;
  year: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { year: 1970, month: 1, day: 1 };
  }

  return { year, month, day };
}

export function getPacificDayKey(baseDate: Date = new Date()): string {
  const { year, month, day } = getPacificDateParts(baseDate);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function resolveJournalEntryDateParts(input: {
  day?: unknown;
  month?: unknown;
  year?: unknown;
}): { day: number; month: number; year: number } {
  const parsePart = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isInteger(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
    return undefined;
  };

  const dayIn = parsePart(input.day);
  const monthIn = parsePart(input.month);
  const yearIn = parsePart(input.year);
  const pacificToday = getPacificDateParts();

  const y = yearIn ?? pacificToday.year;
  const m = monthIn ?? pacificToday.month;
  const d = dayIn ?? pacificToday.day;

  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error("Invalid journal entry date");
  }

  const test = new Date(y, m - 1, d);
  if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) {
    throw new Error("Invalid calendar date for journal entry");
  }

  return { day: d, month: m, year: y };
}
