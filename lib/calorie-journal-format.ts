import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";

export function formatNutritionJournalText(
  entryText: string,
  answers: string[],
  estimate: {
    calories: number | null;
    proteinGrams: number | null;
    carbsGrams: number | null;
    fatGrams: number | null;
    facts?: {
      totalCarbohydratesGrams: number | null;
      dietaryFiberGrams: number | null;
      sugarGrams: number | null;
      addedSugarsGrams: number | null;
      sugarAlcoholsGrams: number | null;
      netCarbsGrams: number | null;
      saturatedFatGrams: number | null;
      transFatGrams: number | null;
      polyunsaturatedFatGrams: number | null;
      monounsaturatedFatGrams: number | null;
      cholesterolMg: number | null;
      sodiumMg: number | null;
      calciumMg: number | null;
      ironMg: number | null;
      potassiumMg: number | null;
      vitaminAIu: number | null;
      vitaminCMg: number | null;
      vitaminDMcg: number | null;
      caffeineMg: number | null;
    };
    notes: string;
  },
  assumptions: string[],
  customTag?: string
): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Nutrition)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(entryText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
  lines.push(`- Calories: ${estimate.calories ?? "unknown"} kcal`);
  lines.push(`- Protein: ${estimate.proteinGrams ?? "unknown"} g`);
  lines.push(`- Carbs: ${estimate.carbsGrams ?? "unknown"} g`);
  lines.push(`- Fat: ${estimate.fatGrams ?? "unknown"} g`);
  lines.push(`- Total Carbohydrates: ${estimate.facts?.totalCarbohydratesGrams ?? "unknown"} g`);
  lines.push(`- Dietary Fiber: ${estimate.facts?.dietaryFiberGrams ?? "unknown"} g`);
  lines.push(`- Sugar: ${estimate.facts?.sugarGrams ?? "unknown"} g`);
  lines.push(`- Added Sugars: ${estimate.facts?.addedSugarsGrams ?? "unknown"} g`);
  lines.push(`- Sugar Alcohols: ${estimate.facts?.sugarAlcoholsGrams ?? "unknown"} g`);
  lines.push(`- Net Carbs: ${estimate.facts?.netCarbsGrams ?? "unknown"} g`);
  lines.push(`- Saturated Fat: ${estimate.facts?.saturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Trans Fat: ${estimate.facts?.transFatGrams ?? "unknown"} g`);
  lines.push(`- Polyunsaturated Fat: ${estimate.facts?.polyunsaturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Monounsaturated Fat: ${estimate.facts?.monounsaturatedFatGrams ?? "unknown"} g`);
  lines.push(`- Cholesterol: ${estimate.facts?.cholesterolMg ?? "unknown"} mg`);
  lines.push(`- Sodium: ${estimate.facts?.sodiumMg ?? "unknown"} mg`);
  lines.push(`- Calcium: ${estimate.facts?.calciumMg ?? "unknown"} mg`);
  lines.push(`- Iron: ${estimate.facts?.ironMg ?? "unknown"} mg`);
  lines.push(`- Potassium: ${estimate.facts?.potassiumMg ?? "unknown"} mg`);
  lines.push(`- Vitamin A: ${estimate.facts?.vitaminAIu ?? "unknown"} IU`);
  lines.push(`- Vitamin C: ${estimate.facts?.vitaminCMg ?? "unknown"} mg`);
  lines.push(`- Vitamin D: ${estimate.facts?.vitaminDMcg ?? "unknown"} mcg`);
  lines.push(`- Caffeine: ${estimate.facts?.caffeineMg ?? "unknown"} mg`);
  if ((customTag ?? "").trim()) lines.push(`- Tag: ${(customTag ?? "").trim()}`);
  if (estimate.notes.trim()) lines.push(`- Notes: ${estimate.notes.trim()}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("Assumptions:");
    assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}

export function formatExerciseJournalText(
  entryText: string,
  answers: string[],
  estimate: {
    caloriesBurned: number | null;
    carbsUsedGrams?: number | null;
    fatUsedGrams?: number | null;
    proteinDeltaGrams?: number | null;
    notes: string;
  },
  assumptions: string[],
  customTag?: string
): string {
  const lines: string[] = [];
  lines.push("Calorie Tracking Journal (Exercise)");
  lines.push("");
  lines.push("Enriched entry:");
  lines.push(entryText.trim());
  if (answers.length > 0) {
    lines.push("");
    lines.push("Clarifications:");
    answers.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }
  lines.push("");
  lines.push(`- Calories burned: ${estimate.caloriesBurned ?? "unknown"} kcal`);
  lines.push(`- Carbs used: ${estimate.carbsUsedGrams ?? "unknown"} g`);
  lines.push(`- Fat used: ${estimate.fatUsedGrams ?? "unknown"} g`);
  lines.push(`- Protein delta: ${estimate.proteinDeltaGrams ?? "unknown"} g`);
  if ((customTag ?? "").trim()) lines.push(`- Tag: ${(customTag ?? "").trim()}`);
  if (estimate.notes.trim()) lines.push(`- Notes: ${estimate.notes.trim()}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("Assumptions:");
    assumptions.forEach((a) => lines.push(`- ${a}`));
  }
  return lines.join("\n").slice(0, EXTRACT_CONCEPTS_MAX_TOTAL_CHARS);
}
