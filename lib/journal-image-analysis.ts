export type JournalImageAnalysis = {
  id: string;
  previewUrl: string;
  extractedText: string;
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
