import type { JournalImageAnalysis } from "@/lib/journal-image-analysis";

/** Window event: Quick Note / brain-dump sheet can ingest image analyses from the desktop speed dial. */
export const JOURNAL_IMAGE_ANALYSES_BRIDGE_EVENT = "fml-journal-image-analyses-bridge";

export type JournalImageAnalysesBridgeDetail = { analyses: JournalImageAnalysis[] };

export function dispatchJournalImageAnalysesBridge(analyses: JournalImageAnalysis[]) {
  if (typeof window === "undefined" || analyses.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<JournalImageAnalysesBridgeDetail>(JOURNAL_IMAGE_ANALYSES_BRIDGE_EVENT, {
      detail: { analyses },
    })
  );
}
