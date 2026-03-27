import type { LanguageCode } from "./languages";
import { PRODUCT_TAGLINE } from "./product-tagline";

export interface LandingTranslations {
  whatShouldIDo: string;
  ideas: string;
  /** Primary value proposition (aligned with SEO / manifest). */
  productTagline: string;
  letsDigIn: string;
  readyToConversation: string;
  drawPerspectiveCard: string;
  shiftHowYouLook: string;
  browseMentalModels: string;
  frameworksAndBiases: string;
  noConversationsMatch: string;
  noConversationsYet: string;
  newConversation: string;
  conversation: string;
  deleteConversation: string;
  deleteConversationConfirm: string;
  deleteConversationPermanent: string;
  searchConversations: string;
  /** 1:1 mentor tile & picker */
  mentorOneOnOneTitle: string;
  mentorOneOnOneSubtitle: string;
  mentorOneOnOneModalTitle: string;
  mentorOneOnOneSearchPlaceholder: string;
  mentorOneOnOneTapToChat: string;
  mentorOneOnOneAllCategories: string;
  /** New conversation chooser + second-order mode */
  conversationChooserTitle: string;
  secondOrderThinkingTitle: string;
  secondOrderThinkingSubtitle: string;
  secondOrderChipLabel: string;
  /** Second-order plain (no index / user-library context in prompt) */
  secondOrderPlainTitle: string;
  secondOrderPlainSubtitle: string;
  /** Second-order with mental models & saved context (citations) */
  secondOrderWithCitationsTitle: string;
  secondOrderWithCitationsSubtitle: string;
  secondOrderChipLabelPlain: string;
  secondOrderChipLabelWithCitations: string;
  /** Toggle on second-order start card: mental models & saved context in the thread */
  secondOrderCitationsToggleLabel: string;
  /** Freeform journal save (landing / chooser; not chat) */
  journalEntryButtonLabel: string;
  /** Short line under landing / chooser tile */
  journalEntryButtonSubtitle: string;
  journalEntryModalTitle: string;
  journalEntryModalSubtitle: string;
  /** Optional calendar date for the entry (defaults to today on save). */
  journalEntryDateHint: string;
  journalEntryBodyPlaceholder: string;
  journalEntrySave: string;
  journalEntryCancel: string;
  journalEntrySaveError: string;
  journalEntrySavedHint: string;
  journalEntryBack: string;
  journalEntrySignInPrompt: string;
  calorieTrackerChipLabel: string;
  calorieTrackerModalTitle: string;
  calorieTrackerModalSubtitle: string;
  calorieTrackerContinue: string;
  calorieTrackerBack: string;
  calorieTrackerGetEstimate: string;
  calorieTrackerDone: string;
  calorieTrackerSavedEntry: string;
  calorieTrackerSavedEntries: string;
  nutritionGoalsButtonLabel: string;
  nutritionGoalsModalTitle: string;
  nutritionGoalCaloriesLabel: string;
  nutritionGoalCarbsLabel: string;
  nutritionGoalProteinLabel: string;
  nutritionGoalFatLabel: string;
  nutritionGoalsSaveError: string;
  nutritionAnalysisButtonLabel: string;
  nutritionAnalysisModalTitle: string;
  nutritionAnalysisModalSubtitle: string;
  nutritionAnalysisFocusLabel: string;
  nutritionAnalysisFocusPlaceholder: string;
  nutritionAnalysisScopeToday: string;
  nutritionAnalysisScopeSelectedDay: string;
  nutritionAnalysisGenerate: string;
  nutritionAnalysisGenerating: string;
  nutritionAnalysisNoDataError: string;
  nutritionAnalysisRequestError: string;
  nutritionAnalysisSummaryHeading: string;
  nutritionAnalysisGoalStatusHeading: string;
  nutritionAnalysisHighlightsHeading: string;
  nutritionAnalysisTipsHeading: string;
}

const EN: LandingTranslations = {
  whatShouldIDo: "What should I do?",
  ideas: "Ideas",
  productTagline: PRODUCT_TAGLINE,
  letsDigIn: "Let's get into it — mental models that actually stick, designed for life outside the textbook",
  readyToConversation: "Ready to have a conversation whenever you say something",
  drawPerspectiveCard: "Draw a perspective card",
  shiftHowYouLook: "Shift how you look at something—art, decisions, or any topic",
  browseMentalModels: "Browse Mental Models",
  frameworksAndBiases: "Frameworks and biases for better decision-making",
  noConversationsMatch: "No conversations match",
  noConversationsYet: "No conversations yet",
  newConversation: "New conversation",
  conversation: "Conversation",
  deleteConversation: "Delete conversation",
  deleteConversationConfirm: "Delete conversation?",
  deleteConversationPermanent: "will be permanently deleted. This cannot be undone.",
  searchConversations: "Search conversations",
  mentorOneOnOneTitle: "1:1 with a mentor",
  mentorOneOnOneSubtitle: "Full coach mode—grounded in their voice, ideas, and worldview",
  mentorOneOnOneModalTitle: "Choose a mentor",
  mentorOneOnOneSearchPlaceholder: "Search by name or topic…",
  mentorOneOnOneTapToChat: "Tap to start",
  mentorOneOnOneAllCategories: "All",
  conversationChooserTitle: "How would you like to start?",
  secondOrderThinkingTitle: "Second-order thinking",
  secondOrderThinkingSubtitle: "Consequences, incentives, and what happens next after that",
  secondOrderChipLabel: "Second-order thinking",
  secondOrderPlainTitle: "Second-order (plain)",
  secondOrderPlainSubtitle: "Same reasoning frame—no models, memories, or citation tags",
  secondOrderWithCitationsTitle: "Second-order (with citations)",
  secondOrderWithCitationsSubtitle: "Second-order reasoning plus your mental models & saved context",
  secondOrderChipLabelPlain: "Second-order (plain)",
  secondOrderChipLabelWithCitations: "Second-order (with citations)",
  secondOrderCitationsToggleLabel: "Citations",
  journalEntryButtonLabel: "Add Journal Entry",
  journalEntryButtonSubtitle: "Write freely; saved to your library—not sent as chat.",
  journalEntryModalTitle: "Add a Journal Entry",
  journalEntryModalSubtitle:
    "Write freely. This is saved to your library—not sent as a chat message. A short title is generated from what you write. You can extract concepts from it later if you want.",
  journalEntryDateHint: "Entry date",
  journalEntryBodyPlaceholder: "Write whatever you feel…",
  journalEntrySave: "Save",
  journalEntryCancel: "Cancel",
  journalEntrySaveError: "Couldn’t save. Try again.",
  journalEntrySavedHint: "Saved to your library.",
  journalEntryBack: "Back",
  journalEntrySignInPrompt: "Sign in to save journal entries to your library.",
  calorieTrackerChipLabel: "Calorie tracker",
  calorieTrackerModalTitle: "Calorie tracker journal",
  calorieTrackerModalSubtitle:
    "Tell me what you ate or exercised and I'll calculate the nutritional content or calories burned",
  calorieTrackerContinue: "Continue",
  calorieTrackerBack: "Back",
  calorieTrackerGetEstimate: "Get estimate",
  calorieTrackerDone: "Done",
  calorieTrackerSavedEntry: "Saved to journal entry.",
  calorieTrackerSavedEntries: "Saved to journal entries.",
  nutritionGoalsButtonLabel: "Set goals",
  nutritionGoalsModalTitle: "Nutrition goals",
  nutritionGoalCaloriesLabel: "Calories target",
  nutritionGoalCarbsLabel: "Carbs target (g)",
  nutritionGoalProteinLabel: "Protein target (g)",
  nutritionGoalFatLabel: "Fat target (g)",
  nutritionGoalsSaveError: "Couldn’t save goals. Try again.",
  nutritionAnalysisButtonLabel: "Analyze nutrition",
  nutritionAnalysisModalTitle: "Nutrition analysis",
  nutritionAnalysisModalSubtitle:
    "Get a simple report based on your goals and your nutrition/exercise logs for the day.",
  nutritionAnalysisFocusLabel: "Optional focus",
  nutritionAnalysisFocusPlaceholder:
    "e.g. Focus on protein balance, late-night eating, and workout fuel",
  nutritionAnalysisScopeToday: "Today",
  nutritionAnalysisScopeSelectedDay: "Selected day",
  nutritionAnalysisGenerate: "Generate report",
  nutritionAnalysisGenerating: "Generating report...",
  nutritionAnalysisNoDataError: "Add a nutrition or exercise log first for this day.",
  nutritionAnalysisRequestError: "Couldn’t generate report. Try again.",
  nutritionAnalysisSummaryHeading: "Summary",
  nutritionAnalysisGoalStatusHeading: "Goal status",
  nutritionAnalysisHighlightsHeading: "Highlights",
  nutritionAnalysisTipsHeading: "Tips for tomorrow",
};

const TRANSLATIONS: Partial<Record<LanguageCode, Partial<LandingTranslations>>> = {
  en: EN,
  hi: {
    whatShouldIDo: "मुझे क्या करना चाहिए?",
    ideas: "विचार",
    letsDigIn: "शुरू करें—ऐसे मानसिक मॉडल के साथ जो वाकई काम करते हैं",
    readyToConversation: "जब भी आप कुछ कहेंगे, बातचीत के लिए तैयार",
    drawPerspectiveCard: "एक परिप्रेक्ष्य कार्ड निकालें",
    shiftHowYouLook: "किसी चीज़ को देखने का नज़रिया बदलें—कला, फैसले या कोई भी विषय",
    browseMentalModels: "मानसिक मॉडल देखें",
    frameworksAndBiases: "बेहतर निर्णय के लिए फ्रेमवर्क और पूर्वाग्रह",
    noConversationsMatch: "कोई बातचीत मेल नहीं खाती",
    noConversationsYet: "अभी तक कोई बातचीत नहीं",
    newConversation: "नई बातचीत",
    conversation: "बातचीत",
    deleteConversation: "बातचीत हटाएं",
    deleteConversationConfirm: "बातचीत हटाएं?",
    deleteConversationPermanent: "स्थायी रूप से हटा दी जाएगी। इसे पूर्ववत नहीं किया जा सकता।",
    searchConversations: "बातचीत खोजें",
  },
  ta: {
    whatShouldIDo: "நான் என்ன செய்ய வேண்டும்?",
    ideas: "யோசனைகள்",
    letsDigIn: "தொடங்குவோம்—உண்மையில் வேலை செய்யும் மன மாதிரிகளுடன்",
    readyToConversation: "நீங்கள் எதையாவது சொல்லும்போதெல்லாம் உரையாட தயார்",
    drawPerspectiveCard: "ஒரு முன்னோக்கு அட்டை வரையவும்",
    shiftHowYouLook: "எதையாவது பார்க்கும் விதத்தை மாற்றுங்கள்—கலை, முடிவுகள் அல்லது எந்த தலைப்பும்",
    browseMentalModels: "மன மாதிரிகளை உலாவுங்கள்",
    frameworksAndBiases: "சிறந்த முடிவெடுப்புக்கான கட்டமைப்புகள் மற்றும் சார்புகள்",
    noConversationsMatch: "உரையாடல்கள் பொருந்தவில்லை",
    noConversationsYet: "இன்னும் உரையாடல்கள் இல்லை",
    newConversation: "புதிய உரையாடல்",
    conversation: "உரையாடல்",
    deleteConversation: "உரையாடலை நீக்கு",
    deleteConversationConfirm: "உரையாடலை நீக்கவா?",
    deleteConversationPermanent: "நிரந்தரமாக நீக்கப்படும். இதை மீளமைக்க முடியாது.",
    searchConversations: "உரையாடல்களை தேடுங்கள்",
  },
  kn: {
    whatShouldIDo: "ನಾನು ಏನು ಮಾಡಬೇಕು?",
    ideas: "ಕಲ್ಪನೆಗಳು",
    letsDigIn: "ಪ್ರಾರಂಭಿಸೋಣ—ನಿಜವಾಗಿಯೂ ಕೆಲಸ ಮಾಡುವ ಮಾನಸಿಕ ಮಾದರಿಗಳೊಂದಿಗೆ",
    readyToConversation: "ನೀವು ಏನನ್ನಾದರೂ ಹೇಳಿದಾಗಲೆಲ್ಲಾ ಸಂಭಾಷಣೆಗೆ ಸಿದ್ಧರಾಗಿರಿ",
    drawPerspectiveCard: "ಒಂದು ದೃಷ್ಟಿಕೋನ ಕಾರ್ಡ್ ಎಳೆಯಿರಿ",
    shiftHowYouLook: "ಏನನ್ನಾದರೂ ನೋಡುವ ರೀತಿಯನ್ನು ಬದಲಾಯಿಸಿ—ಕಲೆ, ನಿರ್ಧಾರಗಳು ಅಥವಾ ಯಾವುದೇ ವಿಷಯ",
    browseMentalModels: "ಮಾನಸಿಕ ಮಾದರಿಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
    frameworksAndBiases: "ಉತ್ತಮ ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳಲು ಚೌಕಟ್ಟುಗಳು ಮತ್ತು ಪಕ್ಷಪಾತಗಳು",
    noConversationsMatch: "ಸಂಭಾಷಣೆಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ",
    noConversationsYet: "ಇನ್ನೂ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ",
    newConversation: "ಹೊಸ ಸಂಭಾಷಣೆ",
    conversation: "ಸಂಭಾಷಣೆ",
    deleteConversation: "ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸಿ",
    deleteConversationConfirm: "ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸುವುದೇ?",
    deleteConversationPermanent: "ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಲ್ಪಡುತ್ತದೆ. ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    searchConversations: "ಸಂಭಾಷಣೆಗಳನ್ನು ಹುಡುಕಿ",
  },
  ja: {
    whatShouldIDo: "何をすればいいですか？",
    ideas: "アイデア",
    letsDigIn: "始めましょう—本当に役立つメンタルモデルとともに",
    readyToConversation: "何か言うときはいつでも会話の準備ができています",
    drawPerspectiveCard: "視点カードを引く",
    shiftHowYouLook: "ものの見方を変える—芸術、決断、あらゆるテーマ",
    browseMentalModels: "メンタルモデルを閲覧",
    frameworksAndBiases: "より良い意思決定のためのフレームワークとバイアス",
    noConversationsMatch: "一致する会話がありません",
    noConversationsYet: "まだ会話がありません",
    newConversation: "新しい会話",
    conversation: "会話",
    deleteConversation: "会話を削除",
    deleteConversationConfirm: "会話を削除しますか？",
    deleteConversationPermanent: "完全に削除されます。元に戻せません。",
    searchConversations: "会話を検索",
  },
  es: {
    whatShouldIDo: "¿Qué debería hacer?",
    ideas: "Ideas",
    letsDigIn: "Empecemos—con modelos mentales que realmente funcionan",
    readyToConversation: "Listo para conversar cuando digas algo",
    drawPerspectiveCard: "Sacar una carta de perspectiva",
    shiftHowYouLook: "Cambia cómo miras algo—arte, decisiones o cualquier tema",
    browseMentalModels: "Explorar modelos mentales",
    frameworksAndBiases: "Marcos y sesgos para mejores decisiones",
    noConversationsMatch: "No hay conversaciones que coincidan",
    noConversationsYet: "Aún no hay conversaciones",
    newConversation: "Nueva conversación",
    conversation: "Conversación",
    deleteConversation: "Eliminar conversación",
    deleteConversationConfirm: "¿Eliminar conversación?",
    deleteConversationPermanent: "se eliminará permanentemente. No se puede deshacer.",
    searchConversations: "Buscar conversaciones",
  },
  fr: {
    whatShouldIDo: "Que dois-je faire ?",
    ideas: "Idées",
    letsDigIn: "Allons-y—avec des modèles mentaux qui fonctionnent vraiment",
    readyToConversation: "Prêt à converser dès que vous dites quelque chose",
    drawPerspectiveCard: "Tirer une carte de perspective",
    shiftHowYouLook: "Changez votre regard sur quelque chose—art, décisions ou tout sujet",
    browseMentalModels: "Parcourir les modèles mentaux",
    frameworksAndBiases: "Cadres et biais pour de meilleures décisions",
    noConversationsMatch: "Aucune conversation ne correspond",
    noConversationsYet: "Pas encore de conversations",
    newConversation: "Nouvelle conversation",
    conversation: "Conversation",
    deleteConversation: "Supprimer la conversation",
    deleteConversationConfirm: "Supprimer la conversation ?",
    deleteConversationPermanent: "sera définitivement supprimée. Cette action est irréversible.",
    searchConversations: "Rechercher des conversations",
  },
  bn: {
    whatShouldIDo: "আমার কী করা উচিত?",
    ideas: "ধারণা",
    letsDigIn: "শুরু করি—যে মানসিক মডেল সত্যিই কাজ করে",
    readyToConversation: "আপনি কিছু বললেই আলাপের জন্য প্রস্তুত",
    drawPerspectiveCard: "একটি দৃষ্টিভঙ্গি কার্ড টানুন",
    shiftHowYouLook: "কোনো কিছুর দিকে তাকানোর ভঙ্গি বদলান—শিল্প, সিদ্ধান্ত বা যেকোনো বিষয়",
    browseMentalModels: "মানসিক মডেল ব্রাউজ করুন",
    frameworksAndBiases: "ভালো সিদ্ধান্তের জন্য ফ্রেমওয়ার্ক এবং পক্ষপাত",
    noConversationsMatch: "কোনো আলাপ মিলছে না",
    noConversationsYet: "এখনও কোনো আলাপ নেই",
    newConversation: "নতুন আলাপ",
    conversation: "আলাপ",
    deleteConversation: "আলাপ মুছুন",
    deleteConversationConfirm: "আলাপ মুছবেন?",
    deleteConversationPermanent: "স্থায়ীভাবে মুছে যাবে। এটা ফেরানো যাবে না।",
    searchConversations: "আলাপ খুঁজুন",
  },
  pt: {
    whatShouldIDo: "O que devo fazer?",
    ideas: "Ideias",
    letsDigIn: "Vamos lá—com modelos mentais que realmente funcionam",
    readyToConversation: "Pronto para conversar sempre que você disser algo",
    drawPerspectiveCard: "Tirar uma carta de perspectiva",
    shiftHowYouLook: "Mude como você olha para algo—arte, decisões ou qualquer tema",
    browseMentalModels: "Explorar modelos mentais",
    frameworksAndBiases: "Estruturas e vieses para melhores decisões",
    noConversationsMatch: "Nenhuma conversa corresponde",
    noConversationsYet: "Ainda não há conversas",
    newConversation: "Nova conversa",
    conversation: "Conversa",
    deleteConversation: "Excluir conversa",
    deleteConversationConfirm: "Excluir conversa?",
    deleteConversationPermanent: "será excluída permanentemente. Isso não pode ser desfeito.",
    searchConversations: "Buscar conversas",
  },
  ur: {
    whatShouldIDo: "مجھے کیا کرنا چاہیے؟",
    ideas: "خیالات",
    letsDigIn: "شروع کریں—ذہنی ماڈل کے ساتھ جو واقعی کام کرتے ہیں",
    readyToConversation: "جب بھی آپ کچھ کہیں گے بات چیت کے لیے تیار",
    drawPerspectiveCard: "ایک نقطہ نظر کارڈ نکالیں",
    shiftHowYouLook: "کسی چیز کو دیکھنے کا انداز بدلیں—فن، فیصلے یا کوئی بھی موضوع",
    browseMentalModels: "ذہنی ماڈل دیکھیں",
    frameworksAndBiases: "بہتر فیصلے کے لیے فریم ورک اور تعصبات",
    noConversationsMatch: "کوئی بات چیت میل نہیں کھاتی",
    noConversationsYet: "ابھی تک کوئی بات چیت نہیں",
    newConversation: "نئی بات چیت",
    conversation: "بات چیت",
    deleteConversation: "بات چیت حذف کریں",
    deleteConversationConfirm: "بات چیت حذف کریں؟",
    deleteConversationPermanent: "مستقل طور پر حذف ہو جائے گی۔ اسے واپس نہیں لایا جا سکتا۔",
    searchConversations: "بات چیتیں تلاش کریں",
  },
  de: {
    whatShouldIDo: "Was soll ich tun?",
    ideas: "Ideen",
    letsDigIn: "Lass uns loslegen—mit mentalen Modellen, die wirklich funktionieren",
    readyToConversation: "Bereit für ein Gespräch, sobald du etwas sagst",
    drawPerspectiveCard: "Eine Perspektivkarte ziehen",
    shiftHowYouLook: "Ändere deinen Blickwinkel—Kunst, Entscheidungen oder jedes Thema",
    browseMentalModels: "Mentale Modelle durchsuchen",
    frameworksAndBiases: "Rahmen und Verzerrungen für bessere Entscheidungen",
    noConversationsMatch: "Keine passenden Gespräche",
    noConversationsYet: "Noch keine Gespräche",
    newConversation: "Neues Gespräch",
    conversation: "Gespräch",
    deleteConversation: "Gespräch löschen",
    deleteConversationConfirm: "Gespräch löschen?",
    deleteConversationPermanent: "wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
    searchConversations: "Gespräche suchen",
  },
  it: {
    whatShouldIDo: "Cosa dovrei fare?",
    ideas: "Idee",
    letsDigIn: "Iniziamo—con modelli mentali che funzionano davvero",
    readyToConversation: "Pronto a conversare quando dici qualcosa",
    drawPerspectiveCard: "Pesca una carta di prospettiva",
    shiftHowYouLook: "Cambia il modo di guardare qualcosa—arte, decisioni o qualsiasi argomento",
    browseMentalModels: "Esplora i modelli mentali",
    frameworksAndBiases: "Strutture e bias per decisioni migliori",
    noConversationsMatch: "Nessuna conversazione corrisponde",
    noConversationsYet: "Ancora nessuna conversazione",
    newConversation: "Nuova conversazione",
    conversation: "Conversazione",
    deleteConversation: "Elimina conversazione",
    deleteConversationConfirm: "Eliminare la conversazione?",
    deleteConversationPermanent: "verrà eliminata permanentemente. Non può essere annullato.",
    searchConversations: "Cerca conversazioni",
  },
  pl: {
    whatShouldIDo: "Co powinienem zrobić?",
    ideas: "Pomysły",
    letsDigIn: "Zaczynajmy—z modelami mentalnymi, które naprawdę działają",
    readyToConversation: "Gotowy do rozmowy, gdy coś powiesz",
    drawPerspectiveCard: "Wylosuj kartę perspektywy",
    shiftHowYouLook: "Zmień sposób patrzenia na coś—sztukę, decyzje lub dowolny temat",
    browseMentalModels: "Przeglądaj modele mentalne",
    frameworksAndBiases: "Ramy i uprzedzenia dla lepszych decyzji",
    noConversationsMatch: "Brak pasujących rozmów",
    noConversationsYet: "Jeszcze brak rozmów",
    newConversation: "Nowa rozmowa",
    conversation: "Rozmowa",
    deleteConversation: "Usuń rozmowę",
    deleteConversationConfirm: "Usunąć rozmowę?",
    deleteConversationPermanent: "zostanie trwale usunięta. Nie można tego cofnąć.",
    searchConversations: "Szukaj rozmów",
  },
  uk: {
    whatShouldIDo: "Що мені робити?",
    ideas: "Ідеї",
    letsDigIn: "Почнімо—з ментальними моделями, які справді працюють",
    readyToConversation: "Готовий до розмови, коли ви щось скажете",
    drawPerspectiveCard: "Витягнути картку перспективи",
    shiftHowYouLook: "Змініть погляд на щось—мистецтво, рішення або будь-яку тему",
    browseMentalModels: "Переглянути ментальні моделі",
    frameworksAndBiases: "Фреймворки та упередження для кращих рішень",
    noConversationsMatch: "Немає відповідних розмов",
    noConversationsYet: "Поки немає розмов",
    newConversation: "Нова розмова",
    conversation: "Розмова",
    deleteConversation: "Видалити розмову",
    deleteConversationConfirm: "Видалити розмову?",
    deleteConversationPermanent: "буде остаточно видалено. Це не можна скасувати.",
    searchConversations: "Пошук розмов",
  },
  ro: {
    whatShouldIDo: "Ce ar trebui să fac?",
    ideas: "Idei",
    letsDigIn: "Să începem—cu modele mentale care funcționează cu adevărat",
    readyToConversation: "Gata de conversație ori de câte ori spui ceva",
    drawPerspectiveCard: "Trage o carte de perspectivă",
    shiftHowYouLook: "Schimbă modul în care privești ceva—artă, decizii sau orice subiect",
    browseMentalModels: "Explorează modelele mentale",
    frameworksAndBiases: "Cadre și prejudecăți pentru decizii mai bune",
    noConversationsMatch: "Nicio conversație nu corespunde",
    noConversationsYet: "Încă nu există conversații",
    newConversation: "Conversație nouă",
    conversation: "Conversație",
    deleteConversation: "Șterge conversația",
    deleteConversationConfirm: "Șterge conversația?",
    deleteConversationPermanent: "va fi ștearsă permanent. Nu poate fi anulat.",
    searchConversations: "Caută conversații",
  },
  nl: {
    whatShouldIDo: "Wat moet ik doen?",
    ideas: "Ideeën",
    letsDigIn: "Laten we beginnen—met mentale modellen die echt werken",
    readyToConversation: "Klaar voor een gesprek zodra je iets zegt",
    drawPerspectiveCard: "Trek een perspectiefkaart",
    shiftHowYouLook: "Verander hoe je naar iets kijkt—kunst, beslissingen of elk onderwerp",
    browseMentalModels: "Mentale modellen bekijken",
    frameworksAndBiases: "Kaders en biases voor betere beslissingen",
    noConversationsMatch: "Geen overeenkomende gesprekken",
    noConversationsYet: "Nog geen gesprekken",
    newConversation: "Nieuw gesprek",
    conversation: "Gesprek",
    deleteConversation: "Gesprek verwijderen",
    deleteConversationConfirm: "Gesprek verwijderen?",
    deleteConversationPermanent: "wordt permanent verwijderd. Dit kan niet ongedaan worden gemaakt.",
    searchConversations: "Gesprekken zoeken",
  },
  tr: {
    whatShouldIDo: "Ne yapmalıyım?",
    ideas: "Fikirler",
    letsDigIn: "Başlayalım—gerçekten işe yarayan zihinsel modellerle",
    readyToConversation: "Bir şey söylediğinizde sohbet etmeye hazır",
    drawPerspectiveCard: "Bir perspektif kartı çek",
    shiftHowYouLook: "Bir şeye bakış açınızı değiştirin—sanat, kararlar veya herhangi bir konu",
    browseMentalModels: "Zihinsel modellere göz at",
    frameworksAndBiases: "Daha iyi kararlar için çerçeveler ve önyargılar",
    noConversationsMatch: "Eşleşen sohbet yok",
    noConversationsYet: "Henüz sohbet yok",
    newConversation: "Yeni sohbet",
    conversation: "Sohbet",
    deleteConversation: "Sohbeti sil",
    deleteConversationConfirm: "Sohbet silinsin mi?",
    deleteConversationPermanent: "kalıcı olarak silinecektir. Bu işlem geri alınamaz.",
    searchConversations: "Sohbetleri ara",
  },
};

export function getLandingTranslations(language: LanguageCode): LandingTranslations {
  return { ...EN, ...(TRANSLATIONS[language] ?? {}) };
}
