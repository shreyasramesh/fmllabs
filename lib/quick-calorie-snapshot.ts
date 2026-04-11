/**
 * Client-provided calorie estimate from /api/me/nutrition-quick-estimate, reused on save
 * when the saved line text still matches (avoids a second finalize call).
 */

const MAX_SOURCE = 2000;

export type ClientQuickCalorieSnapshot = {
  sourceText: string;
  intent: string;
  calories: number | null;
  exerciseCaloriesBurned: number | null;
  assumptions: string[];
  nutritionNotes: string;
  exerciseNotes: string;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  reasoning: string;
};

function toStr(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

function toNum(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Parse and validate body.clientQuickCalories[i] from save-batch. */
export function parseClientQuickCalorieSnapshot(raw: unknown): ClientQuickCalorieSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sourceText = toStr(o.sourceText);
  if (!sourceText || sourceText.length > MAX_SOURCE) return null;
  const intent = toStr(o.intent);
  if (!intent) return null;

  const assumptionsRaw = o.assumptions;
  const assumptions = Array.isArray(assumptionsRaw)
    ? assumptionsRaw
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim())
        .slice(0, 12)
    : [];

  return {
    sourceText,
    intent,
    calories: o.calories === null ? null : toNum(o.calories),
    exerciseCaloriesBurned: o.exerciseCaloriesBurned === null ? null : toNum(o.exerciseCaloriesBurned),
    assumptions,
    nutritionNotes: toStr(o.nutritionNotes) ?? "",
    exerciseNotes: toStr(o.exerciseNotes) ?? "",
    proteinGrams: o.proteinGrams === null ? null : toNum(o.proteinGrams),
    carbsGrams: o.carbsGrams === null ? null : toNum(o.carbsGrams),
    fatGrams: o.fatGrams === null ? null : toNum(o.fatGrams),
    reasoning: toStr(o.reasoning) ?? "",
  };
}
