import type { HabitBucket } from "./habit-buckets";
import type { LanguageCode } from "./languages";

export interface UiTranslations {
  conversations: string;
  mentalModels: string;
  longTermMemory: string;
  concepts: string;
  groups: string;
  famousFigures: string;
  habits: string;
  promoteToHabit: string;
  habitLifeArea: string;
  habitBucketCreative: string;
  habitBucketIntellectual: string;
  habitBucketWellbeing: string;
  habitBucketConnection: string;
  habitBucketOther: string;
  createHabit: string;
  habitSourceManual: string;
  habitSourceFromConcept: string;
  habitSourceFromMemory: string;
  habitSource: string;
  habitCreateInputHelper: string;
  habitCreateReviewHelper: string;
  settings: string;
  close: string;
  cancel: string;
  promptGames: string;
}

const EN: UiTranslations = {
  conversations: "Conversations",
  mentalModels: "Mental Models",
  longTermMemory: "Memory",
  concepts: "Concepts",
  groups: "Frameworks",
  famousFigures: "Personas",
  habits: "Habits",
  promoteToHabit: "Promote to Habit",
  habitLifeArea: "Life area",
  habitBucketCreative: "Creative (e.g. art, music, writing)",
  habitBucketIntellectual: "Intellectual (e.g. reading, learning, travel)",
  habitBucketWellbeing: "Well-being (e.g. yoga, meditation, sports)",
  habitBucketConnection: "Connection (e.g. social clubs, rituals, shared meals)",
  habitBucketOther: "Other",
  createHabit: "Create habit",
  habitSourceManual: "Created manually",
  habitSourceFromConcept: "From a concept",
  habitSourceFromMemory: "From memory",
  habitSource: "Source",
  habitCreateInputHelper:
    "Choose a life area and describe the habit in your own words. The AI will sharpen the name and description and write follow-through steps and tips.",
  habitCreateReviewHelper:
    "Review and edit. Follow-through and tips were generated for you—you can change anything before saving.",
  settings: "Settings",
  close: "Close",
  cancel: "Cancel",
  promptGames: "Ways of Looking At",
};

const TRANSLATIONS: Partial<Record<LanguageCode, Partial<UiTranslations>>> = {
  en: EN,
  hi: {
    conversations: "बातचीत",
    mentalModels: "मानसिक मॉडल",
    longTermMemory: "दीर्घकालिक स्मृति",
    concepts: "अवधारणाएं",
    groups: "फ्रेमवर्क",
    famousFigures: "प्रसिद्ध हस्तियां",
    settings: "सेटिंग्स",
    close: "बंद करें",
    cancel: "रद्द करें",
    promptGames: "देखने के तरीके",
  },
  ta: {
    conversations: "உரையாடல்கள்",
    mentalModels: "மன மாதிரிகள்",
    longTermMemory: "நீண்டகால நினைவு",
    concepts: "கருத்துகள்",
    groups: "கட்டமைப்புகள்",
    famousFigures: "பிரபலங்கள்",
    settings: "அமைப்புகள்",
    close: "மூடு",
    cancel: "ரத்து",
    promptGames: "பார்ப்பதற்கான வழிகள்",
  },
  kn: {
    conversations: "ಸಂಭಾಷಣೆಗಳು",
    mentalModels: "ಮಾನಸಿಕ ಮಾದರಿಗಳು",
    longTermMemory: "ದೀರ್ಘಕಾಲೀನ ಸ್ಮರಣೆ",
    concepts: "ಪರಿಕಲ್ಪನೆಗಳು",
    groups: "ಚೌಕಟ್ಟುಗಳು",
    famousFigures: "ಪ್ರಸಿದ್ಧ ವ್ಯಕ್ತಿಗಳು",
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    close: "ಮುಚ್ಚಿ",
    cancel: "ರದ್ದು",
    promptGames: "ನೋಡುವ ವಿಧಾನಗಳು",
  },
  ja: {
    conversations: "会話",
    mentalModels: "メンタルモデル",
    longTermMemory: "長期記憶",
    concepts: "概念",
    groups: "フレームワーク",
    famousFigures: "著名人",
    settings: "設定",
    close: "閉じる",
    cancel: "キャンセル",
    promptGames: "見る視点",
  },
  es: {
    conversations: "Conversaciones",
    mentalModels: "Modelos mentales",
    longTermMemory: "Memoria a largo plazo",
    concepts: "Conceptos",
    groups: "Grupos",
    famousFigures: "Figuras famosas",
    settings: "Ajustes",
    close: "Cerrar",
    cancel: "Cancelar",
    promptGames: "Formas de mirar",
  },
  fr: {
    conversations: "Conversations",
    mentalModels: "Modèles mentaux",
    longTermMemory: "Mémoire à long terme",
    concepts: "Concepts",
    groups: "Groupes",
    famousFigures: "Personnalités célèbres",
    settings: "Paramètres",
    close: "Fermer",
    cancel: "Annuler",
    promptGames: "Jeux de prompts",
  },
  bn: {
    conversations: "আলাপ",
    mentalModels: "মানসিক মডেল",
    longTermMemory: "দীর্ঘমেয়াদী স্মৃতি",
    concepts: "ধারণা",
    groups: "ফ্রেমওয়ার্ক",
    famousFigures: "বিখ্যাত ব্যক্তিত্ব",
    settings: "সেটিংস",
    close: "বন্ধ করুন",
    cancel: "বাতিল",
    promptGames: "দেখার উপায়",
  },
  pt: {
    conversations: "Conversas",
    mentalModels: "Modelos mentais",
    longTermMemory: "Memória de longo prazo",
    concepts: "Conceitos",
    groups: "Grupos",
    famousFigures: "Figuras famosas",
    settings: "Configurações",
    close: "Fechar",
    cancel: "Cancelar",
    promptGames: "Formas de olhar",
  },
  ur: {
    conversations: "بات چیتیں",
    mentalModels: "ذہنی ماڈل",
    longTermMemory: "طویل مدتی یادداشت",
    concepts: "تصورات",
    groups: "فریم ورکس",
    famousFigures: "مشہور شخصیات",
    settings: "ترتیبات",
    close: "بند کریں",
    cancel: "منسوخ",
    promptGames: "پرامپٹ گیمز",
  },
  de: {
    conversations: "Gespräche",
    mentalModels: "Mentale Modelle",
    longTermMemory: "Langzeitgedächtnis",
    concepts: "Konzepte",
    groups: "Rahmen",
    famousFigures: "Berühmte Persönlichkeiten",
    settings: "Einstellungen",
    close: "Schließen",
    cancel: "Abbrechen",
    promptGames: "Wege des Betrachtens",
  },
  it: {
    conversations: "Conversazioni",
    mentalModels: "Modelli mentali",
    longTermMemory: "Memoria a lungo termine",
    concepts: "Concetti",
    groups: "Framework",
    famousFigures: "Figure famose",
    settings: "Impostazioni",
    close: "Chiudi",
    cancel: "Annulla",
    promptGames: "Modi di guardare",
  },
  pl: {
    conversations: "Rozmowy",
    mentalModels: "Modele mentalne",
    longTermMemory: "Pamięć długotrwała",
    concepts: "Koncepcje",
    groups: "Ramy",
    famousFigures: "Sławne postacie",
    settings: "Ustawienia",
    close: "Zamknij",
    cancel: "Anuluj",
    promptGames: "Gry z promptami",
  },
  uk: {
    conversations: "Розмови",
    mentalModels: "Ментальні моделі",
    longTermMemory: "Довготривала пам'ять",
    concepts: "Концепції",
    groups: "Фреймворки",
    famousFigures: "Відомі особистості",
    settings: "Налаштування",
    close: "Закрити",
    cancel: "Скасувати",
    promptGames: "Способи дивитися",
  },
  ro: {
    conversations: "Conversații",
    mentalModels: "Modele mentale",
    longTermMemory: "Memorie pe termen lung",
    concepts: "Concepte",
    groups: "Cadre",
    famousFigures: "Personalități celebre",
    settings: "Setări",
    close: "Închide",
    cancel: "Anulare",
    promptGames: "Moduri de a privi",
  },
  nl: {
    conversations: "Gesprekken",
    mentalModels: "Mentale modellen",
    longTermMemory: "Langetermijngeheugen",
    concepts: "Concepten",
    groups: "Kaders",
    famousFigures: "Beroemde figuren",
    settings: "Instellingen",
    close: "Sluiten",
    cancel: "Annuleren",
    promptGames: "Manieren van kijken",
  },
  tr: {
    conversations: "Sohbetler",
    mentalModels: "Zihinsel modeller",
    longTermMemory: "Uzun süreli bellek",
    concepts: "Kavramlar",
    groups: "Çerçeveler",
    famousFigures: "Ünlü kişiler",
    settings: "Ayarlar",
    close: "Kapat",
    cancel: "İptal",
    promptGames: "Bakış açıları",
  },
};

export function getUiTranslations(language: LanguageCode): UiTranslations {
  const t = TRANSLATIONS[language];
  return t ? { ...EN, ...t } : EN;
}

export function getHabitBucketLabel(t: UiTranslations, bucket: HabitBucket): string {
  switch (bucket) {
    case "creative":
      return t.habitBucketCreative;
    case "intellectual":
      return t.habitBucketIntellectual;
    case "wellbeing":
      return t.habitBucketWellbeing;
    case "connection":
      return t.habitBucketConnection;
    default:
      return t.habitBucketOther;
  }
}
