/** Mirrors `NutritionImageAutoKind` from image transcribe (auto mode). Kept here for client-safe imports. */
export type JournalImageAutoKind =
  | "nutrition"
  | "exercise"
  | "generic_text"
  | "weight_scale"
  | "sleep_tracker";

export type JournalImageAnalysis = {
  id: string;
  previewUrl: string;
  extractedText: string;
  imageKind?: JournalImageAutoKind;
  /** Short scene label from the model (e.g. dish name, title snippet). */
  sceneLabel?: string;
  weightKgGuess?: number | null;
  sleepHoursGuess?: number | null;
  hrvMsGuess?: number | null;
};

export function formatJournalImageAnalysisBlocks(
  analyses: JournalImageAnalysis[],
  startIndex = 1
): string {
  return analyses
    .map((item, idx) => `Photo ${startIndex + idx} analysis:\n${item.extractedText.trim()}`)
    .filter((chunk) => chunk.trim().length > 0)
    .join("\n\n");
}

export function buildHydratedJournalImageText(
  analyses: JournalImageAnalysis[],
  context: string
): string {
  const extracted = formatJournalImageAnalysisBlocks(analyses);
  const trimmedContext = context.trim();
  if (extracted && trimmedContext) {
    return `${extracted}\n\nAdditional user context:\n${trimmedContext}`;
  }
  return extracted || trimmedContext;
}
