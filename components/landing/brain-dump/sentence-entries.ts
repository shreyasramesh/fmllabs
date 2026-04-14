/** Normalize body text so typed Quick Note lines match Gemini-titled journal rows (case, spacing). */
export function normalizeQuickNoteBodyForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Split completed sentences from the current draft while typing.
 * Commits when . ! ? are followed by whitespace, or when the only segment ends with . ! ?
 */
export function flushSentencesFromTyping(draft: string): { commits: string[]; rest: string } {
  if (!draft) return { commits: [], rest: "" };
  const segments = draft.split(/(?<=[.!?])\s+/);
  if (segments.length === 0) return { commits: [], rest: draft };

  const lastSegment = segments[segments.length - 1] ?? "";
  const trimmedLast = lastSegment.trimEnd();
  const lastIsComplete = trimmedLast.length > 0 && /[.!?]$/.test(trimmedLast);

  const complete = segments
    .slice(0, -1)
    .map((s) => s.trim())
    .filter(Boolean);

  if (complete.length > 0) {
    if (lastIsComplete) {
      return { commits: [...complete, trimmedLast], rest: "" };
    }
    return { commits: complete, rest: lastSegment.trimStart() };
  }

  if (segments.length === 1 && lastIsComplete) {
    return { commits: [trimmedLast], rest: "" };
  }

  return { commits: [], rest: draft };
}

/** Split stored nutrition text into sentences (newlines + sentence boundaries). */
export function splitIntoSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const byLine = text.split(/\n/).flatMap((line) => {
    const s = line.trim();
    if (!s) return [];
    const parts = s.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts : [s];
  });
  return byLine;
}

export function looksLikeFoodSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 280) return false;
  const foodish =
    /\b(ate|eating|eaten|breakfast|lunch|dinner|snack|drink|coffee|tea|protein|kcal|calories|\bcal\b|bowl|shake|eggs|chicken|salad|rice|oatmeal|smoothie|burger|fries|latte|ramen|noodles?|pasta|pho|udon|soba|spaghetti|dumplings?|taco|burrito|curry|steak|salmon|tofu|waffles?|pancakes?|croissant|bagel|cereal|soup|sandwich|toast|pizza|fruit|yogurt|bar\b|meal|had|grams?|oz\b|cup|slice|scoop)\b/i;
  return foodish.test(t) || /\d/.test(t);
}

/** Sleep / rest preview — handled locally (no nutrition-quick-estimate call). */
export function looksLikeSleepSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 280) return false;
  if (
    /\b(slept|sleep|sleeping|asleep|insomnia|overslept|underslept|nap|napped|naps|napping|bedtime|bed\s*time|wake\s*up|woke\s*up|couldn'?t\s*sleep|rested|REM)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (/\b(bed|pillow|dream)\b/i.test(t) && /\d/.test(t)) return true;
  return false;
}

/**
 * Best-effort hours from a sleep-typed line (e.g. "slept 7.5 hours", "8h nap").
 * Returns null if no plausible duration in 0–24h.
 */
export function parseSleepHoursFromLine(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const withUnit = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (withUnit) {
    const v = parseFloat(withUnit[1]);
    if (Number.isFinite(v) && v > 0 && v <= 24) return v;
  }
  const contextNum = /\b(?:slept|sleep|sleeping|nap|napped|naps|napping)\w*\s+(?:for\s+)?(\d+(?:\.\d+)?)\b/i.exec(
    t
  );
  if (contextNum) {
    const v = parseFloat(contextNum[1]);
    if (Number.isFinite(v) && v > 0 && v <= 24) return v;
  }
  return null;
}

/** Activity / workout phrasing — triggers quick estimate for calories burned (shown negative in UI). */
export function looksLikeExerciseSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 280) return false;
  if (looksLikeSleepSentence(t)) return false;
  return /\b(run|ran|running|jog|jogging|jogged|walk|walked|walking|hike|hiked|hiking|bike|biked|biking|cycling|cycle|swim|swam|swimming|gym|workout|work\s*out|lifting|lifted|squat|squats|deadlift|cardio|rowing|rowed|elliptical|treadmill|exercise|exercised|yoga|pilates|stretch|hiit|crossfit|sports|tennis|golf|ski|skied|surf|climb|climbing|push\s*ups|pull\s*ups|reps|sets)\b/i.test(
    t
  ) || /\b\d+(\.\d+)?\s*(mi|mile|miles|km|k|min|mins|minutes|hr|hrs|hours)\b/i.test(t);
}

/** Call nutrition-quick-estimate when the line could be food intake or exercise burn. */
export function shouldRunQuickEstimate(s: string): boolean {
  if (looksLikeSleepSentence(s)) return false;
  return looksLikeFoodSentence(s) || looksLikeExerciseSentence(s);
}

/** Food / exercise API estimate or local sleep summary — drives the right-column estimate UI. */
export function shouldShowQuickNoteEstimateColumn(s: string): boolean {
  return shouldRunQuickEstimate(s) || looksLikeSleepSentence(s);
}
