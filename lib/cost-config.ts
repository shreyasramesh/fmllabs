/**
 * Cost configuration for paid services (gemini-3.1-flash-lite).
 * Used by usage tracking and admin analytics.
 */

export const GEMINI_INPUT_PRICE_PER_1M = 0.25;
export const GEMINI_OUTPUT_PRICE_PER_1M = 1.5;

/** Context caching (for future use if enabled):
 * - $0.025 / 1M tokens (cache read)
 * - $1.00 / 1M tokens per hour (storage)
 * - 5,000 prompts/month free, then $14 / 1,000 search queries
 */

export const TRANSCRIBR_PRICE_PER_FETCH = 0.03;

export const MONGODB_M10_HOURLY = 0.027;
export const MONGODB_FLEX_HOURLY = 0.011;

export const ELEVENLABS_TTS_INCLUDED_MINUTES = 200;
export const ELEVENLABS_TTS_EXTRA_PRICE_PER_MIN = 0.15;

export const ELEVENLABS_STT_INCLUDED_HOURS = 48;
export const ELEVENLABS_STT_INCLUDED_PRICE_PER_HOUR = 0.46;
export const ELEVENLABS_STT_EXTRA_PRICE_PER_HOUR = 0.63;

/** Chars per minute for TTS duration estimation (~150 words/min * 6 chars/word) */
export const TTS_CHARS_PER_MINUTE = 900;
