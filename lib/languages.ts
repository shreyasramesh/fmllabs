/** Supported conversation languages. ISO 639-1 codes. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "kn", name: "Kannada" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Mandarin" },
  { code: "es", name: "Spanish" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "bn", name: "Bengali" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ur", name: "Urdu" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const LANGUAGE_NAMES: Record<LanguageCode, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.name])
) as Record<LanguageCode, string>;

export function getLanguageName(code: LanguageCode): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export function isValidLanguageCode(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

const RTL_LANGUAGES: LanguageCode[] = ["ar", "ur"];

export function isRtlLanguage(code: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(code);
}
