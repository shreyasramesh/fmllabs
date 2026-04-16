export type PromptCategory =
  | "morning_evening"
  | "relationships"
  | "future"
  | "body"
  | "routine"
  | "money"
  | "spirituality"
  | "big_life";

export interface JournalPrompt {
  id: string;
  prompt: string;
  category: PromptCategory;
}

export interface PromptCategoryMeta {
  label: string;
  highlight: string;
  tabAccent: string;
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "morning_evening",
  "relationships",
  "future",
  "body",
  "routine",
  "money",
  "spirituality",
  "big_life",
];

export const PROMPT_CATEGORY_META: Record<PromptCategory, PromptCategoryMeta> = {
  morning_evening: {
    label: "Morning / Evening",
    highlight: "rgba(240,180,100,0.45)",
    tabAccent: "#d4a050",
  },
  relationships: {
    label: "Relationships",
    highlight: "rgba(220,140,160,0.45)",
    tabAccent: "#c87090",
  },
  future: {
    label: "Future",
    highlight: "rgba(230,130,110,0.42)",
    tabAccent: "#d07060",
  },
  body: {
    label: "Body",
    highlight: "rgba(210,150,130,0.45)",
    tabAccent: "#c08060",
  },
  routine: {
    label: "Routine",
    highlight: "rgba(160,190,140,0.45)",
    tabAccent: "#7a9e60",
  },
  money: {
    label: "Money",
    highlight: "rgba(220,190,100,0.45)",
    tabAccent: "#b8962e",
  },
  spirituality: {
    label: "Spirituality",
    highlight: "rgba(190,160,210,0.42)",
    tabAccent: "#9a78b8",
  },
  big_life: {
    label: "Big Life Q's",
    highlight: "rgba(210,140,150,0.42)",
    tabAccent: "#c06878",
  },
};

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  // ─── Morning / Evening ──────────────────────────────────
  { id: "me-1",  category: "morning_evening", prompt: "Today reminded me that I..." },
  { id: "me-2",  category: "morning_evening", prompt: "An unexpected joy from today is..." },
  { id: "me-3",  category: "morning_evening", prompt: "Today's low point was..." },
  { id: "me-4",  category: "morning_evening", prompt: "The thing that gave me energy today was..." },
  { id: "me-5",  category: "morning_evening", prompt: "I felt most inspired today when..." },
  { id: "me-6",  category: "morning_evening", prompt: "I am most proud that I did _________ today..." },
  { id: "me-7",  category: "morning_evening", prompt: "One way I stayed in touch with my authenticity today was..." },
  { id: "me-8",  category: "morning_evening", prompt: "I know today helped me move toward my dream because I..." },
  { id: "me-9",  category: "morning_evening", prompt: "Something that threw me off today was..." },
  { id: "me-10", category: "morning_evening", prompt: "Today I intend to..." },
  { id: "me-11", category: "morning_evening", prompt: "Two joys I am going to bring to today are..." },
  { id: "me-12", category: "morning_evening", prompt: "How true does this statement feel: I am creating the life I love" },
  { id: "me-13", category: "morning_evening", prompt: "Today I am looking forward to..." },

  // ─── Relationships ──────────────────────────────────────
  { id: "rel-1",  category: "relationships", prompt: "The friendship I am working on right now is..." },
  { id: "rel-2",  category: "relationships", prompt: "The person who inspires me often is..." },
  { id: "rel-3",  category: "relationships", prompt: "Sometimes I feel envious of..." },
  { id: "rel-4",  category: "relationships", prompt: "What my envy is telling me is..." },
  { id: "rel-5",  category: "relationships", prompt: "I want to spend more time with..." },
  { id: "rel-6",  category: "relationships", prompt: "I could use some space from..." },
  { id: "rel-7",  category: "relationships", prompt: "I feel most connected to my partner when..." },
  { id: "rel-8",  category: "relationships", prompt: "I know I need to connect to my partner when..." },
  { id: "rel-9",  category: "relationships", prompt: "If I revisited my communication boundaries right now, these are the shifts I would make..." },
  { id: "rel-10", category: "relationships", prompt: "Do I have boundaries in my relationships? Do they feel true to me? Are they rigid? Are they porous?" },
  { id: "rel-11", category: "relationships", prompt: "The pattern that usually arises for me in relationships is..." },
  { id: "rel-12", category: "relationships", prompt: "Have I cleansed my energetic cords recently? Where could I create more freedom in these connections?" },
  { id: "rel-13", category: "relationships", prompt: "Where am I not expressing my needs?" },
  { id: "rel-14", category: "relationships", prompt: "Where have I made assumptions?" },
  { id: "rel-15", category: "relationships", prompt: "My favorite way to spend time with friends is..." },
  { id: "rel-16", category: "relationships", prompt: "My favorite way to spend time with my partner is..." },
  { id: "rel-17", category: "relationships", prompt: "My favorite way to spend time with my family is..." },

  // ─── Future ─────────────────────────────────────────────
  { id: "fut-1", category: "future", prompt: "How true does this statement feel: I am looking forward to the future I am building" },
  { id: "fut-2", category: "future", prompt: "Have I spent time dreaming recently?" },
  { id: "fut-3", category: "future", prompt: "Do I let myself dream big?" },
  { id: "fut-4", category: "future", prompt: "What is my relationship to: drive, inspiration, imagination, creativity, action?" },
  { id: "fut-5", category: "future", prompt: "What feelings come up for me when I lean into letting go?" },
  { id: "fut-6", category: "future", prompt: "What inklings come to mind when I let myself get quiet?" },
  { id: "fut-7", category: "future", prompt: "Where can I dream bigger?" },
  { id: "fut-8", category: "future", prompt: "What is my process for leaning into what is possible?" },

  // ─── Body ───────────────────────────────────────────────
  { id: "bod-1",  category: "body", prompt: "Where do I feel my \"yeses\" in my body?" },
  { id: "bod-2",  category: "body", prompt: "Where do I feel my \"no's\"?" },
  { id: "bod-3",  category: "body", prompt: "Do I allow myself to feel pleasure?" },
  { id: "bod-4",  category: "body", prompt: "Do I lean into my own needs when it comes to pleasure?" },
  { id: "bod-5",  category: "body", prompt: "When do I feel most aroused?" },
  { id: "bod-6",  category: "body", prompt: "What is my relationship with my sexuality? My sensuality? My sexual expression?" },
  { id: "bod-7",  category: "body", prompt: "Am I allowed to express myself with my body?" },
  { id: "bod-8",  category: "body", prompt: "When I am most aligned and in my \"essence\" how does my body feel?" },
  { id: "bod-9",  category: "body", prompt: "What clothes make me feel most \"me\"?" },
  { id: "bod-10", category: "body", prompt: "What is my relationship with being with my naked self?" },
  { id: "bod-11", category: "body", prompt: "What makes me feel most connected to my body?" },
  { id: "bod-12", category: "body", prompt: "What makes me feel disconnected to my body?" },
  { id: "bod-13", category: "body", prompt: "What is my relationship with movement? Do I move with and in my body throughout the day or do I feel disconnected from my body?" },
  { id: "bod-14", category: "body", prompt: "How do I honor my body daily?" },
  { id: "bod-15", category: "body", prompt: "How can I honor and respect my body even more?" },

  // ─── Routine + Daily Life ───────────────────────────────
  { id: "rtn-1",  category: "routine", prompt: "What is my daily routine?" },
  { id: "rtn-2",  category: "routine", prompt: "What parts of my routine are wonderful and what parts are challenging?" },
  { id: "rtn-3",  category: "routine", prompt: "How does having a routine help me?" },
  { id: "rtn-4",  category: "routine", prompt: "Does it?" },
  { id: "rtn-5",  category: "routine", prompt: "What small simple joys are part of my daily life?" },
  { id: "rtn-6",  category: "routine", prompt: "What shifts do I want to make to my daily experience?" },
  { id: "rtn-7",  category: "routine", prompt: "What big categories are important to me? (Choose your top three-four)" },
  { id: "rtn-8",  category: "routine", prompt: "Am I comparing my routine to someone else's?" },
  { id: "rtn-9",  category: "routine", prompt: "Does my routine work for me?" },
  { id: "rtn-10", category: "routine", prompt: "How much do I trust myself when it comes to following through?" },
  { id: "rtn-11", category: "routine", prompt: "Do I put pressure on myself to do this?" },
  { id: "rtn-12", category: "routine", prompt: "Does this bring me joy?" },

  // ─── Money ──────────────────────────────────────────────
  { id: "mon-1",  category: "money", prompt: "Do I love my current spending habits?" },
  { id: "mon-2",  category: "money", prompt: "Where do I feel most stuck with my money story?" },
  { id: "mon-3",  category: "money", prompt: "I always come back to _______ when it comes to money" },
  { id: "mon-4",  category: "money", prompt: "I love seeing abundance in..." },
  { id: "mon-5",  category: "money", prompt: "When I think of the word \"abundance\" I think..." },
  { id: "mon-6",  category: "money", prompt: "When I imagine having exactly what I need I..." },
  { id: "mon-7",  category: "money", prompt: "Is there a part of me that's afraid of success?" },
  { id: "mon-8",  category: "money", prompt: "What if everything I desire is meant for me?" },
  { id: "mon-9",  category: "money", prompt: "I could be more optimistic when it comes to..." },
  { id: "mon-10", category: "money", prompt: "I notice myself creating negative self-talk around..." },
  { id: "mon-11", category: "money", prompt: "I am inspired by..." },
  { id: "mon-12", category: "money", prompt: "Money feels like..." },
  { id: "mon-13", category: "money", prompt: "The story I've always heard about money is..." },
  { id: "mon-14", category: "money", prompt: "One thing I can do today to be more authentic to financial dreams is..." },

  // ─── Spirituality ───────────────────────────────────────
  { id: "spi-1",  category: "spirituality", prompt: "When do I feel most connected to my spirituality?" },
  { id: "spi-2",  category: "spirituality", prompt: "Do I know what my spiritual practices are?" },
  { id: "spi-3",  category: "spirituality", prompt: "What is important to me, spiritually speaking?" },
  { id: "spi-4",  category: "spirituality", prompt: "Where do I feel trust in my body?" },
  { id: "spi-5",  category: "spirituality", prompt: "I know I am connecting to my spiritual self when..." },
  { id: "spi-6",  category: "spirituality", prompt: "I tend to create the idea that I have to...to be spiritual" },
  { id: "spi-7",  category: "spirituality", prompt: "One way I practice seeing the magic in the every day is..." },
  { id: "spi-8",  category: "spirituality", prompt: "What words come to mind when I feel into my spiritual self?" },
  { id: "spi-9",  category: "spirituality", prompt: "Something I love to do that isn't traditionally considered spiritual but feels spiritual to me is..." },
  { id: "spi-10", category: "spirituality", prompt: "\"Flow\" to me is..." },
  { id: "spi-11", category: "spirituality", prompt: "I feel most connected to my intuition when..." },
  { id: "spi-12", category: "spirituality", prompt: "Do I allow myself to feel into my intuition?" },
  { id: "spi-13", category: "spirituality", prompt: "What is my relationship with faith? With trust? With a greater purpose?" },

  // ─── Big Life Q's ───────────────────────────────────────
  { id: "blq-1",  category: "big_life", prompt: "Where do I feel most inspired right now in my life?" },
  { id: "blq-2",  category: "big_life", prompt: "What is the fear that continues to arise for me?" },
  { id: "blq-3",  category: "big_life", prompt: "Where do I hold back?" },
  { id: "blq-4",  category: "big_life", prompt: "Where am I most lit up?" },
  { id: "blq-5",  category: "big_life", prompt: "What makes me feel seen and heard?" },
  { id: "blq-6",  category: "big_life", prompt: "Who am I with when I feel safest?" },
  { id: "blq-7",  category: "big_life", prompt: "What am I doing when I feel most myself?" },
  { id: "blq-8",  category: "big_life", prompt: "Is there anything I keep replaying in my mind? Can I let any part of that go?" },
  { id: "blq-9",  category: "big_life", prompt: "If I wasn't worried about the outcome, what would I do?" },
  { id: "blq-10", category: "big_life", prompt: "Where can I be more bold in my life?" },
  { id: "blq-11", category: "big_life", prompt: "If I saw someone who I haven't seen for 10 years, would I feel proud of my life? What feelings arise for me?" },
  { id: "blq-12", category: "big_life", prompt: "How can I be more authentic in my life right now?" },
  { id: "blq-13", category: "big_life", prompt: "What does authenticity mean to me?" },
  { id: "blq-14", category: "big_life", prompt: "When do I feel most connected to my body?" },
  { id: "blq-15", category: "big_life", prompt: "What is my relationship with my sensual side?" },
  { id: "blq-16", category: "big_life", prompt: "Where do I hold back in my creativity?" },
  { id: "blq-17", category: "big_life", prompt: "If I didn't feel anxious about it, would it still be scary?" },
];

export const PROMPTS_BY_CATEGORY: Record<PromptCategory, JournalPrompt[]> =
  JOURNAL_PROMPTS.reduce(
    (acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    },
    {} as Record<PromptCategory, JournalPrompt[]>,
  );

export const JOURNAL_PROMPTS_TOTAL = JOURNAL_PROMPTS.length;
