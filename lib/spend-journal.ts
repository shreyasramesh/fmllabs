import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";

/** Match `- Amount: 12.50 USD` (comma thousands allowed). */
export const SPEND_AMOUNT_LINE_RE = /- Amount:\s*([\d,.]+)\s+([A-Z]{3})\b/i;

export function normalizeSpendCurrencyInput(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return "USD";
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(u)) return u;
  return null;
}

export function formatSpendAmountLine(amount: number, currency: string): string {
  const formatted = Math.abs(amount % 1) < 1e-9 ? String(amount) : amount.toFixed(2);
  return `- Amount: ${formatted} ${currency}`;
}

export function formatSpendJournalTranscript(
  memo: string,
  opts: { amount: number; currency: string; tag?: string; notes?: string }
): string {
  const lines: string[] = [];
  lines.push("Spend Tracking Journal");
  lines.push("");
  lines.push("Purchase:");
  lines.push(memo.trim() || "(no description)");
  lines.push("");
  lines.push(formatSpendAmountLine(opts.amount, opts.currency));
  if ((opts.tag ?? "").trim()) lines.push(`- Tag: ${(opts.tag ?? "").trim()}`);
  if ((opts.notes ?? "").trim()) lines.push(`- Notes: ${(opts.notes ?? "").trim()}`);
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}

export function parseSpendAmountFromJournalText(text: string): { amount: number; currency: string } | null {
  const m = SPEND_AMOUNT_LINE_RE.exec(text);
  if (!m) return null;
  const num = Number.parseFloat(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  return { amount: num, currency: m[2]!.toUpperCase() };
}

/** Compact currency string for Quick Note / list rails (uses locale symbols when Intl supports the code). */
export function formatSpendForQuickNoteDisplay(amount: number, currency: string): string {
  const code = (currency || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount);
  } catch {
    const formatted = Math.abs(amount % 1) < 1e-9 ? String(amount) : amount.toFixed(2);
    return `${code} ${formatted}`;
  }
}

export function upsertSpendAmountLine(lines: string[], amount: number, currency: string): string[] {
  const nextLine = formatSpendAmountLine(amount, currency);
  const idx = lines.findIndex((l) => l.trimStart().toLowerCase().startsWith("- amount:"));
  const updated = lines.slice();
  if (idx >= 0) updated[idx] = nextLine;
  else updated.push(nextLine);
  return updated;
}

export function spendJournalTitle(memo: string, amount: number, currency: string): string {
  const m = memo.trim();
  if (m) return m.length > 120 ? `${m.slice(0, 117)}...` : m;
  return `${currency} ${amount}`;
}
