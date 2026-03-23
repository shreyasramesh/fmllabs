/** User type / conversation style. Affects only chat tone, not concepts/summary/etc. */

export const USER_TYPES = [
  { id: "genz", name: "Gen Z", icon: "📱", description: "Slang, memes, relatable vibes" },
  { id: "millennial", name: "Millennial", icon: "☕", description: "Burnout-friendly, self-aware, slightly ironic" },
  { id: "genx", name: "Gen X", icon: "📼", description: "Straight-forward, no fluff, 80s/90s nostalgia" },
  { id: "boomer", name: "Baby Boomer", icon: "🪴", description: "Warm, patient, traditional values" },
  { id: "professional", name: "Professional", icon: "💼", description: "Polished, structured, career-focused" },
  { id: "casual", name: "Casual", icon: "😌", description: "Extra relaxed, like texting a friend" },
  { id: "thoughtful", name: "Thoughtful", icon: "🤔", description: "Reflective, philosophical, invites contemplation" },
  { id: "direct", name: "Direct", icon: "🎯", description: "Brevity first, get to the point" },
] as const;

export type UserTypeId = (typeof USER_TYPES)[number]["id"];

const USER_TYPE_STYLE_PROMPTS: Record<UserTypeId, string> = {
  genz: "Use Gen Z slang sparingly when it fits (e.g., 'lowkey', 'vibes', 'no cap'). Keep it relatable and meme-adjacent. Stay authentic.",
  millennial:
    "Reference millennial culture when relevant (e.g., burnout, side hustles, work-life balance). Keep it self-aware and slightly ironic.",
  genx: "Straight-forward, slightly skeptical tone. Reference 80s/90s nostalgia when it fits. No fluff. Call it like you see it.",
  boomer: "Warm, patient, traditional values. Use familiar analogies and life experience. Avoid slang. Steady and reassuring.",
  professional:
    "Polished but still warm. Slightly more structured. Use business and career metaphors when relevant. Clear and organized.",
  casual: "Extra relaxed, use 'like' and 'you know' naturally. Very conversational. Feels like texting a friend.",
  thoughtful:
    "More reflective and philosophical. Pause for depth. Use 'I wonder' and 'it seems'. Invite contemplation.",
  direct:
    "Brevity first—short sentences, no hedging—but stay kind: acknowledge the feeling in one beat, then get to the point.",
};

/** Style for follow-up options specifically - how the user would phrase them. */
const USER_TYPE_OPTIONS_PROMPTS: Record<UserTypeId, string> = {
  genz: "Use Gen Z slang when natural (e.g., 'lowkey wanna...', 'no cap I need to...', 'vibes are...'). Keep options relatable.",
  millennial:
    "Self-aware, slightly ironic. Reference burnout, side hustles, or work-life balance when relevant (e.g., 'I need to touch grass').",
  genx: "Straight-forward, no fluff. Short. Maybe a touch of 80s/90s reference if it fits.",
  boomer: "Warm, steady phrasing. No slang. Traditional, reassuring tone.",
  professional:
    "Polished, clear. Slightly structured. Business/career metaphors when relevant.",
  casual: "Relaxed, like texting. Use 'like' and 'you know' naturally. Very conversational.",
  thoughtful:
    "Reflective, philosophical. Use 'I wonder...', 'it seems...'. Invite contemplation.",
  direct: "Very brief first-person options (2–8 words when possible). No hedging, but not harsh.",
};

export function getUserTypeStylePrompt(id: UserTypeId): string {
  return USER_TYPE_STYLE_PROMPTS[id] ?? "";
}

export function getUserTypeOptionsPrompt(id: UserTypeId): string {
  return USER_TYPE_OPTIONS_PROMPTS[id] ?? USER_TYPE_STYLE_PROMPTS[id] ?? "";
}

export function getUserTypeName(id: UserTypeId): string {
  return USER_TYPES.find((t) => t.id === id)?.name ?? id;
}

export function isValidUserTypeId(id: string): id is UserTypeId {
  return USER_TYPES.some((t) => t.id === id);
}
