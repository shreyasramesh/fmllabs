/**
 * Cost configuration for paid services (gemini-2.5-flash-lite).
 * Used by usage tracking and admin analytics.
 */

export const GEMINI_INPUT_PRICE_PER_1M = 0.1;
export const GEMINI_OUTPUT_PRICE_PER_1M = 0.4;

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
