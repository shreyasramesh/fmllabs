/** Supported conversation languages. ISO 639-1 codes. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "kn", name: "Kannada" },
  { code: "ja", name: "Japanese" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "bn", name: "Bengali" },
  { code: "pt", name: "Portuguese" },
  { code: "ur", name: "Urdu" },
  // European
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ro", name: "Romanian" },
  { code: "nl", name: "Dutch" },
  { code: "tr", name: "Turkish" },
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

const RTL_LANGUAGES: LanguageCode[] = ["ur"];

export function isRtlLanguage(code: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(code);
}

/** Region groupings for language selection UI. Languages appear in the first region they belong to. */
export const LANGUAGE_REGIONS = [
  {
    id: "global",
    label: "Global",
    icon: "🌐",
    languages: ["en"] as LanguageCode[],
  },
  {
    id: "europe",
    label: "Europe",
    icon: "🌍",
    languages: ["de", "es", "fr", "it", "nl", "pl", "pt", "ro", "uk", "tr"] as LanguageCode[],
  },
  {
    id: "japan",
    label: "Japan",
    icon: "🇯🇵",
    languages: ["ja"] as LanguageCode[],
  },
  {
    id: "south-asia",
    label: "South Asia",
    icon: "🇮🇳",
    languages: ["hi", "ta", "kn", "bn", "ur"] as LanguageCode[],
  },
] as const;
