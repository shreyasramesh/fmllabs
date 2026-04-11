import type { BrainDumpCategory } from "@/lib/gemini";

/** Shared chrome for journal category tags (Nutrition, Exercise, Weight, Sleep, …). */
export const JOURNAL_CATEGORY_TAG_PILL_CLASS =
  "inline-block rounded-full px-2 py-px text-[10px] font-medium";

/** Prefix dot before entry text (Quick Note, recents). */
export const JOURNAL_CATEGORY_DOT_BASE = "h-1.5 w-1.5 shrink-0 rounded-full";

export function journalTypeDotClass(cat: BrainDumpCategory): string {
  switch (cat) {
    case "nutrition":
      return "bg-orange-500 dark:bg-orange-400";
    case "exercise":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "reflection":
      return "bg-neutral-400 dark:bg-neutral-500";
    case "concept":
      return "bg-violet-500 dark:bg-violet-400";
    case "experiment":
      return "bg-amber-500 dark:bg-amber-400";
    case "weight":
      return "bg-teal-500 dark:bg-teal-400";
    case "sleep":
      return "bg-indigo-500 dark:bg-indigo-400";
    default:
      return "bg-neutral-400 dark:bg-neutral-500";
  }
}

export function journalContextDotClass(
  journalCategory: "nutrition" | "exercise" | "spend" | "weight" | "sleep" | "reflection" | undefined
): string {
  if (journalCategory === "nutrition") return journalTypeDotClass("nutrition");
  if (journalCategory === "exercise") return journalTypeDotClass("exercise");
  if (journalCategory === "spend") return journalTypeDotClass("experiment");
  if (journalCategory === "weight") return journalTypeDotClass("weight");
  if (journalCategory === "sleep") return journalTypeDotClass("sleep");
  return journalTypeDotClass("reflection");
}

/** Inline quick-estimate row intent (nutrition / exercise / mixed / sleep). */
export function quickNoteIntentDotClass(intent: string): string {
  switch (intent) {
    case "exercise":
      return journalTypeDotClass("exercise");
    case "mixed":
      return "bg-amber-500 dark:bg-amber-400";
    case "sleep":
      return journalTypeDotClass("sleep");
    default:
      return journalTypeDotClass("nutrition");
  }
}
