import { compressImageForUpload } from "@/lib/compress-image-for-upload";
import type { JournalImageAnalysis, JournalImageAutoKind } from "@/lib/journal-image-analysis";

const JOURNAL_IMAGE_AUTO_KINDS: readonly JournalImageAutoKind[] = [
  "nutrition",
  "exercise",
  "generic_text",
  "weight_scale",
  "sleep_tracker",
] as const;

function parseJournalImageAutoKind(v: unknown): JournalImageAutoKind | undefined {
  return typeof v === "string" && (JOURNAL_IMAGE_AUTO_KINDS as readonly string[]).includes(v)
    ? (v as JournalImageAutoKind)
    : undefined;
}

const IMAGE_TRANSCRIBE_MODE = "auto" as const;

/**
 * Single-image journal transcribe (Quick Note / image ingest). Throws on network or empty draft.
 */
export async function transcribeJournalImageFile(
  file: File,
  hintText: string
): Promise<JournalImageAnalysis> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("An image is too large (max 20MB before compression).");
  }
  const { base64, mimeType } = await compressImageForUpload(file);
  const res = await fetch("/api/me/journal/calorie/image-transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType,
      hintText: hintText.slice(0, 600),
      mode: IMAGE_TRANSCRIBE_MODE,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    nutritionLogDraft?: string;
    imageKind?: unknown;
    dishName?: unknown;
    weightKgGuess?: unknown;
    sleepHoursGuess?: unknown;
    hrvMsGuess?: unknown;
  };
  if (!res.ok) {
    throw new Error(data.error || "Could not read text from this image.");
  }
  const draft = (data.nutritionLogDraft ?? "").trim();
  if (!draft) {
    throw new Error("No text could be extracted from this photo. Try a clearer image or type your note.");
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const previewUrl = URL.createObjectURL(file);
  const imageKind = parseJournalImageAutoKind(data.imageKind);
  const sceneLabel =
    typeof data.dishName === "string" && data.dishName.trim() ? data.dishName.trim().slice(0, 200) : undefined;
  const asGuess = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim());
    return Number.isFinite(n) ? n : null;
  };
  const weightKgGuess = asGuess(data.weightKgGuess);
  const sleepHoursGuess = asGuess(data.sleepHoursGuess);
  const hrvMsGuess = asGuess(data.hrvMsGuess);
  return {
    id,
    previewUrl,
    extractedText: draft,
    ...(imageKind ? { imageKind } : {}),
    ...(sceneLabel ? { sceneLabel } : {}),
    ...(weightKgGuess !== undefined ? { weightKgGuess } : {}),
    ...(sleepHoursGuess !== undefined ? { sleepHoursGuess } : {}),
    ...(hrvMsGuess !== undefined ? { hrvMsGuess } : {}),
  };
}
