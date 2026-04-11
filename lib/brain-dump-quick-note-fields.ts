import type { BrainDumpResult } from "@/lib/gemini";

function firstMeaningfulLine(raw: string): string {
  return raw
    .trim()
    .split(/\n/)
    .map((s) => s.trim())
    .find(Boolean) ?? "";
}

/**
 * Build a single nutrition/exercise brain-dump entry from inline quick-estimate intent.
 * Client-safe (no db/mongodb). Used to skip categorizeBrainDump on Enter when estimate is done.
 */
export function brainDumpResultFromQuickEstimateLine(
  text: string,
  intentRaw: string,
  sleepHours?: number | null
): BrainDumpResult | null {
  const t = text.trim();
  if (!t) return null;
  const intent = intentRaw.trim().toLowerCase();
  const line = firstMeaningfulLine(t);
  const title = (line.length > 120 ? `${line.slice(0, 117)}...` : line) || "Quick note";

  if (intent === "sleep") {
    const h =
      typeof sleepHours === "number" && Number.isFinite(sleepHours) && sleepHours > 0 ? sleepHours : undefined;
    return {
      category: "sleep",
      title,
      sleepHours: h,
    };
  }
  if (intent === "nutrition" || intent === "mixed") {
    return {
      category: "nutrition",
      title,
      nutritionText: t,
    };
  }
  if (intent === "exercise") {
    return {
      category: "exercise",
      title,
      exerciseText: t,
    };
  }
  return null;
}
