/**
 * Client-safe utilities for mental models (no fs/Node APIs).
 * Use this in client components.
 */

export interface MentalModelForUtils {
  quick_introduction: string;
  how_can_you_spot_it?: Record<string, string>;
  one_liner?: string;
  try_this?: string[];
}

/** Derive one-liner from quick_introduction if not set. */
export function getOneLiner(model: MentalModelForUtils): string {
  if (model.one_liner?.trim()) return model.one_liner.trim();
  const first = model.quick_introduction.split(/[.!?]/)[0]?.trim();
  return first ? `${first}.` : model.quick_introduction.slice(0, 80);
}

/** Normalize array items that may be strings or objects (YAML parses "Ask yourself: ..." as key-value). */
function toStringArray(arr: unknown[]): string[] {
  return arr
    .map((item) =>
      typeof item === "string"
        ? item
        : typeof item === "object" && item !== null
          ? Object.values(item as Record<string, unknown>)[0]
          : String(item)
    )
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Derive try_this from how_can_you_spot_it if not set. */
export function getTryThis(model: MentalModelForUtils): string[] {
  if (model.try_this?.length)
    return toStringArray(model.try_this as unknown[]);
  const entries = Object.entries(model.how_can_you_spot_it ?? {});
  return entries.slice(0, 2).map(([, v]) => {
    const s = v.trim();
    return s.startsWith("Notice") ? s : `Notice when ${s.toLowerCase()}`;
  });
}
