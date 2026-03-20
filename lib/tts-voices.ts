import type { LanguageCode } from "./languages";

/** Default voice (Sarah - British female). Used for English and as fallback. */
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * Maps app language codes to ElevenLabs voice IDs for native-sounding speech.
 * Use voices that match the language's typical accent (e.g. Tamil voice for Tamil).
 * Add voice IDs from https://elevenlabs.io/voice-library as you discover them.
 */
const LANGUAGE_TO_VOICE: Partial<Record<LanguageCode, string>> = {
  en: "EXAVITQu4vr4xnSDxMaL", // Sarah - British female
  // Add native voice IDs below for authentic accents. Fallback: Sarah + language_code
  // hi: "...",  // Hindi native
  // ta: "...",  // Tamil native (e.g. Damodar from voice library)
  // es: "...",  // Spanish native
  // fr: "...",  // French native
  // ja: "...",  // Japanese native
  // etc.
};

/**
 * Maps app language codes to ElevenLabs language_code (ISO 639-1).
 * Used for text normalization and pronunciation.
 * Note: eleven_flash_v2_5 supports 32 languages. Unsupported ones (kn, bn, ur)
 * are mapped to the closest supported language.
 */
const LANGUAGE_TO_ELEVENLABS_CODE: Record<LanguageCode, string> = {
  en: "en",
  hi: "hi",
  ta: "ta",
  kn: "ta", // Kannada not supported; use Tamil (Dravidian)
  ja: "ja",
  es: "es",
  fr: "fr",
  bn: "hi", // Bengali not supported; use Hindi (Indo-Aryan)
  pt: "pt",
  ur: "hi", // Urdu not supported; use Hindi (closely related)
  de: "de",
  it: "it",
  pl: "pl",
  uk: "uk",
  ro: "ro",
  nl: "nl",
  tr: "tr",
};

export function getVoiceIdForLanguage(language: LanguageCode): string {
  return LANGUAGE_TO_VOICE[language] ?? DEFAULT_VOICE_ID;
}

export function getLanguageCodeForTts(language: LanguageCode): string {
  return LANGUAGE_TO_ELEVENLABS_CODE[language] ?? "en";
}
