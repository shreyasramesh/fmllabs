import { getDb, type UsageEventDoc, type UsageService } from "@/lib/db";
import { encryptUsageMetadata } from "@/lib/crypto-fields";
import {
  GEMINI_INPUT_PRICE_PER_1M,
  GEMINI_OUTPUT_PRICE_PER_1M,
  TRANSCRIBR_PRICE_PER_FETCH,
  ELEVENLABS_TTS_EXTRA_PRICE_PER_MIN,
  ELEVENLABS_STT_INCLUDED_HOURS,
  ELEVENLABS_STT_INCLUDED_PRICE_PER_HOUR,
  ELEVENLABS_STT_EXTRA_PRICE_PER_HOUR,
  TTS_CHARS_PER_MINUTE,
} from "@/lib/cost-config";

export type { UsageService };

export async function recordUsageEvent(params: {
  userId: string | null;
  service: UsageService;
  eventType: string;
  costUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    const doc: UsageEventDoc = {
      userId: params.userId,
      service: params.service,
      eventType: params.eventType,
      costUsd: params.costUsd,
      metadata: encryptUsageMetadata(params.metadata ?? {}) as UsageEventDoc["metadata"],
      timestamp: new Date(),
    };
    await db.collection<UsageEventDoc>("usage_events").insertOne(doc);
  } catch (err) {
    console.error("recordUsageEvent failed:", err);
  }
}

export function computeGeminiCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GEMINI_INPUT_PRICE_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * GEMINI_OUTPUT_PRICE_PER_1M;
  return inputCost + outputCost;
}

export function computeTranscribrCost(): number {
  return TRANSCRIBR_PRICE_PER_FETCH;
}

export function computeTtsCost(charCount: number): number {
  const minutes = charCount / TTS_CHARS_PER_MINUTE;
  if (minutes <= 0) return 0;
  return minutes * ELEVENLABS_TTS_EXTRA_PRICE_PER_MIN;
}

export function computeTtsCostFromDurationSeconds(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  if (minutes <= 0) return 0;
  return minutes * ELEVENLABS_TTS_EXTRA_PRICE_PER_MIN;
}

/** Records a MongoDB request for proportional cost allocation. costUsd is 0; dashboard aggregation computes proportional share. */
export async function recordMongoUsageRequest(userId: string | null): Promise<void> {
  await recordUsageEvent({
    userId,
    service: "mongodb",
    eventType: "request",
    costUsd: 0,
    metadata: { proportional: true },
  });
}

export function computeSttCost(durationSeconds: number): number {
  const hours = durationSeconds / 3600;
  if (hours <= ELEVENLABS_STT_INCLUDED_HOURS) {
    return hours * ELEVENLABS_STT_INCLUDED_PRICE_PER_HOUR;
  }
  const extraHours = hours - ELEVENLABS_STT_INCLUDED_HOURS;
  return (
    ELEVENLABS_STT_INCLUDED_HOURS * ELEVENLABS_STT_INCLUDED_PRICE_PER_HOUR +
    extraHours * ELEVENLABS_STT_EXTRA_PRICE_PER_HOUR
  );
}
