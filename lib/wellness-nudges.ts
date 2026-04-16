export type WellnessCategory = "oxytocin" | "endorphins" | "dopamine" | "serotonin";

export interface WellnessNudge {
  id: string;
  action: string;
  category: WellnessCategory;
  /** Column in the 3×3 infographic grid (0 = left, 1 = center, 2 = right). */
  gridCol: number;
  /** Row in the 3×3 infographic grid (0 = top, 1 = middle, 2 = bottom). */
  gridRow: number;
}

export interface WellnessCategoryMeta {
  label: string;
  /** Infographic image path under /public. */
  image: string;
  /** Marker-highlight background for action text (matches infographic). */
  highlight: string;
  /** Tab accent color. */
  tabAccent: string;
}

export const WELLNESS_CATEGORIES: WellnessCategory[] = [
  "oxytocin",
  "endorphins",
  "dopamine",
  "serotonin",
];

export const WELLNESS_CATEGORY_META: Record<WellnessCategory, WellnessCategoryMeta> = {
  oxytocin: {
    label: "Oxytocin",
    image: "/images/wellness-nudges/oxytocin.png",
    highlight: "rgba(206,160,228,0.48)",
    tabAccent: "#b57ed8",
  },
  endorphins: {
    label: "Endorphins",
    image: "/images/wellness-nudges/endorphins.png",
    highlight: "rgba(228,190,140,0.52)",
    tabAccent: "#d4a373",
  },
  dopamine: {
    label: "Dopamine",
    image: "/images/wellness-nudges/dopamine.png",
    highlight: "rgba(240,210,100,0.48)",
    tabAccent: "#c9a84c",
  },
  serotonin: {
    label: "Serotonin",
    image: "/images/wellness-nudges/serotonin.png",
    highlight: "rgba(130,196,152,0.48)",
    tabAccent: "#5a9e70",
  },
};

/**
 * CSS background-position values to crop individual illustrations from
 * the 819×1024 infographic images (3 columns × 3 rows of items, with
 * a title bar at the top).  Used with `background-size: 300%`.
 */
export const CROP_COL_X_PCT = [0, 50, 100] as const;
export const CROP_ROW_Y_PCT = [14, 49, 85] as const;

export const WELLNESS_NUDGES: WellnessNudge[] = [
  // ─── Oxytocin ───────────────────────────────────────────
  { id: "oxy-1", action: "Cook for someone",   category: "oxytocin",   gridCol: 0, gridRow: 0 },
  { id: "oxy-2", action: "Start journalling",  category: "oxytocin",   gridCol: 1, gridRow: 0 },
  { id: "oxy-3", action: "Give more hugs",     category: "oxytocin",   gridCol: 2, gridRow: 0 },
  { id: "oxy-4", action: "Help a stranger",    category: "oxytocin",   gridCol: 0, gridRow: 1 },
  { id: "oxy-5", action: "Be vulnerable",      category: "oxytocin",   gridCol: 1, gridRow: 1 },
  { id: "oxy-6", action: "Live in the present",category: "oxytocin",   gridCol: 2, gridRow: 1 },
  { id: "oxy-7", action: "Pet an animal",      category: "oxytocin",   gridCol: 0, gridRow: 2 },
  { id: "oxy-8", action: "Give a compliment",  category: "oxytocin",   gridCol: 1, gridRow: 2 },
  { id: "oxy-9", action: "Make eye contact",   category: "oxytocin",   gridCol: 2, gridRow: 2 },

  // ─── Endorphins ─────────────────────────────────────────
  { id: "end-1", action: "Play sport",         category: "endorphins", gridCol: 0, gridRow: 0 },
  { id: "end-2", action: "Take the stairs",    category: "endorphins", gridCol: 1, gridRow: 0 },
  { id: "end-3", action: "Lift weights",       category: "endorphins", gridCol: 2, gridRow: 0 },
  { id: "end-4", action: "Dance to music",     category: "endorphins", gridCol: 0, gridRow: 1 },
  { id: "end-5", action: "Learn martial arts", category: "endorphins", gridCol: 1, gridRow: 1 },
  { id: "end-6", action: "Go climbing",        category: "endorphins", gridCol: 2, gridRow: 1 },
  { id: "end-7", action: "Go for a run",       category: "endorphins", gridCol: 0, gridRow: 2 },
  { id: "end-8", action: "Stretch your body",  category: "endorphins", gridCol: 1, gridRow: 2 },
  { id: "end-9", action: "Do pull-ups",        category: "endorphins", gridCol: 2, gridRow: 2 },

  // ─── Dopamine ───────────────────────────────────────────
  { id: "dop-1", action: "Make your bed",       category: "dopamine",  gridCol: 0, gridRow: 0 },
  { id: "dop-2", action: "Have a cold shower",  category: "dopamine",  gridCol: 1, gridRow: 0 },
  { id: "dop-3", action: "Sit in silence",      category: "dopamine",  gridCol: 2, gridRow: 0 },
  { id: "dop-4", action: "Write a to-do list",  category: "dopamine",  gridCol: 0, gridRow: 1 },
  { id: "dop-5", action: "Eat tech free",       category: "dopamine",  gridCol: 1, gridRow: 1 },
  { id: "dop-6", action: "Read a book",         category: "dopamine",  gridCol: 2, gridRow: 1 },
  { id: "dop-7", action: "Empty dishwasher",    category: "dopamine",  gridCol: 0, gridRow: 2 },
  { id: "dop-8", action: "Focus for 15+ mins",  category: "dopamine",  gridCol: 1, gridRow: 2 },
  { id: "dop-9", action: "Create a vision board",category: "dopamine", gridCol: 2, gridRow: 2 },

  // ─── Serotonin ──────────────────────────────────────────
  { id: "ser-1", action: "Go camping",         category: "serotonin",  gridCol: 0, gridRow: 0 },
  { id: "ser-2", action: "Play an instrument", category: "serotonin",  gridCol: 1, gridRow: 0 },
  { id: "ser-3", action: "Sit by the ocean",   category: "serotonin",  gridCol: 2, gridRow: 0 },
  { id: "ser-4", action: "Climb a tree",       category: "serotonin",  gridCol: 0, gridRow: 1 },
  { id: "ser-5", action: "Watch a sunset",     category: "serotonin",  gridCol: 1, gridRow: 1 },
  { id: "ser-6", action: "Stargaze at night",  category: "serotonin",  gridCol: 2, gridRow: 1 },
  { id: "ser-7", action: "Do some gardening",  category: "serotonin",  gridCol: 0, gridRow: 2 },
  { id: "ser-8", action: "Swim in the ocean",  category: "serotonin",  gridCol: 1, gridRow: 2 },
  { id: "ser-9", action: "Hike in a forest",   category: "serotonin",  gridCol: 2, gridRow: 2 },
];

/** All nudges grouped by category (pre-computed). */
export const NUDGES_BY_CATEGORY: Record<WellnessCategory, WellnessNudge[]> =
  WELLNESS_NUDGES.reduce(
    (acc, n) => {
      (acc[n.category] ??= []).push(n);
      return acc;
    },
    {} as Record<WellnessCategory, WellnessNudge[]>,
  );

/**
 * Deterministic daily pick: returns one nudge per category for the given day.
 * Same date always yields the same 4 nudges.
 */
export function dailyNudges(date: Date = new Date()): WellnessNudge[] {
  const dayOrd =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate();

  return WELLNESS_CATEGORIES.map((cat) => {
    const pool = NUDGES_BY_CATEGORY[cat];
    return pool[dayOrd % pool.length]!;
  });
}
