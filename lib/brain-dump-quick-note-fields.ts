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
export function brainDumpResultFromQuickEstimateLine(text: string, intentRaw: string): BrainDumpResult | null {
  const t = text.trim();
  if (!t) return null;
  const intent = intentRaw.trim().toLowerCase();
  const line = firstMeaningfulLine(t);
  const title = (line.length > 120 ? `${line.slice(0, 117)}...` : line) || "Quick note";

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
