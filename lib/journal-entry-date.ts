/**
 * Resolve calendar day/month/year for a journal entry.
 * Each part defaults to "today" in the server timezone if omitted.
 */
export function resolveJournalEntryDateParts(input: {
  day?: unknown;
  month?: unknown;
  year?: unknown;
}): { day: number; month: number; year: number } {
  const now = new Date();
  const parsePart = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isInteger(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
    return undefined;
  };

  const dayIn = parsePart(input.day);
  const monthIn = parsePart(input.month);
  const yearIn = parsePart(input.year);

  const y = yearIn ?? now.getFullYear();
  const m = monthIn ?? now.getMonth() + 1;
  const d = dayIn ?? now.getDate();

  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error("Invalid journal entry date");
  }

  const test = new Date(y, m - 1, d);
  if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) {
    throw new Error("Invalid calendar date for journal entry");
  }

  return { day: d, month: m, year: y };
}
