import { getModel } from "@/lib/gemini";
import { computeGeminiCost, recordUsageEvent } from "@/lib/usage";

const TITLE_MAX_CHARS = 100;

/**
 * Single-line title for a journal entry; same language as the body, succinct.
 */
export async function inferJournalTitleFromContent(
  journalText: string,
  options: { userId: string }
): Promise<string> {
  const clipped = journalText.trim().slice(0, 12_000);
  if (!clipped) return "Journal entry";

  const model = getModel();
  const result = await model.generateContent(
    `You title private journal entries. Output rules:
- Reply with ONE line only: the title. No quotation marks. No preamble.
- At most 12 words; prefer 3–8 words.
- Capture the main theme or emotional gist; do not summarize every detail.
- Use the same language as the journal text below.

Journal:
${clipped}`
  );

  const response = result.response;
  const um = response.usageMetadata as
    | { promptTokenCount?: number; candidatesTokenCount?: number }
    | undefined;
  if (um && (um.promptTokenCount ?? 0) > 0) {
    const inputTokens = um.promptTokenCount ?? 0;
    const outputTokens = um.candidatesTokenCount ?? 0;
    recordUsageEvent({
      userId: options.userId,
      service: "gemini",
      eventType: "journal_title",
      costUsd: computeGeminiCost(inputTokens, outputTokens),
      metadata: { inputTokens, outputTokens },
    }).catch((e) => console.error("Gemini usage recording failed:", e));
  }

  let raw = response.text()?.trim() ?? "";
  raw = raw.replace(/^["'\s]+|["'\s]+$/g, "");
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  if (!cleaned) return "Journal entry";
  return cleaned.length > TITLE_MAX_CHARS
    ? cleaned.slice(0, TITLE_MAX_CHARS - 3).trimEnd() + "..."
    : cleaned;
}
